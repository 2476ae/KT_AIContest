import { CATEGORIES, DEMO_MONTH } from "../constants";
import { formatDate, parseMonthId } from "./date";
import type {
  BudgetStatus,
  Category,
  CategorySummary,
  CoachMission,
  CoachReport,
  DaySummary,
  Goal,
  Summary,
  SubscriptionCandidate,
  Transaction,
} from "../types";

const DAY_MS = 24 * 60 * 60 * 1000;

export function toDate(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function endOfMonth(monthId: string) {
  const { year, month } = parseMonthId(monthId);
  return new Date(year, month + 1, 0);
}

function getReferenceDate(transactions: Transaction[], monthId: string) {
  if (transactions.length === 0) {
    return endOfMonth(monthId);
  }

  return transactions
    .map((transaction) => toDate(transaction.date))
    .sort((a, b) => b.getTime() - a.getTime())[0];
}

export function getDaysLeft(transactions: Transaction[], monthId = DEMO_MONTH.id) {
  const reference = getReferenceDate(transactions, monthId);
  const end = endOfMonth(monthId);
  const diff = Math.ceil((end.getTime() - reference.getTime()) / DAY_MS);
  return Math.max(diff, 1);
}

function getPracticalDailyBudget(goal: Goal) {
  const raw = goal.spendingLimit * 0.02;
  const clamped = Math.min(30000, Math.max(10000, raw));

  return Math.round(clamped / 1000) * 1000;
}

function getAdjustedBudgetTarget(totalSpent: number, goal: Goal, daysLeft: number) {
  const originalRemainingBudget = goal.spendingLimit - totalSpent;

  if (originalRemainingBudget >= 0) {
    return {
      adjustedSavingGoal: goal.savingGoal,
      adjustedSpendingLimit: goal.spendingLimit,
      isAdjusted: false,
      remainingBudget: originalRemainingBudget,
    };
  }

  const incomeCap = Math.max(0, goal.monthlyIncome);
  const savingConcessionLimit = goal.spendingLimit + Math.max(0, goal.savingGoal * 0.2);
  const practicalLimit = totalSpent + getPracticalDailyBudget(goal) * daysLeft;
  const requestedLimit = Math.max(goal.spendingLimit, totalSpent, savingConcessionLimit, practicalLimit);
  const adjustedSpendingLimit = incomeCap > 0 ? Math.min(incomeCap, requestedLimit) : requestedLimit;

  return {
    adjustedSavingGoal: Math.max(0, incomeCap - adjustedSpendingLimit),
    adjustedSpendingLimit,
    isAdjusted: adjustedSpendingLimit > goal.spendingLimit,
    remainingBudget: adjustedSpendingLimit - totalSpent,
  };
}

export function getSummary(transactions: Transaction[], goal: Goal, monthId = DEMO_MONTH.id): Summary {
  const totalSpent = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const subscriptionTotal = transactions
    .filter((transaction) => transaction.isSubscription || transaction.category === "구독")
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const progress = goal.spendingLimit > 0 ? (totalSpent / goal.spendingLimit) * 100 : 0;
  const daysLeft = getDaysLeft(transactions, monthId);
  const originalRemainingBudget = goal.spendingLimit - totalSpent;
  const originalDailyBudget = Math.max(0, Math.floor(originalRemainingBudget / daysLeft));
  const adjustedTarget = getAdjustedBudgetTarget(totalSpent, goal, daysLeft);
  const remainingBudget = adjustedTarget.remainingBudget;
  const dailyBudget = Math.max(0, Math.floor(remainingBudget / daysLeft));
  const savingProjection = Math.max(0, goal.monthlyIncome - totalSpent);
  const status: BudgetStatus = remainingBudget < 0 ? "over" : adjustedTarget.isAdjusted || progress >= 78 ? "watch" : "stable";

  return {
    totalSpent,
    progress,
    remainingBudget,
    daysLeft,
    dailyBudget,
    savingProjection,
    subscriptionTotal,
    status,
    isAdjusted: adjustedTarget.isAdjusted,
    adjustedSpendingLimit: adjustedTarget.adjustedSpendingLimit,
    adjustedSavingGoal: adjustedTarget.adjustedSavingGoal,
    originalRemainingBudget,
    originalDailyBudget,
  };
}

export function getCalendarDays(transactions: Transaction[], goal: Goal, monthId = DEMO_MONTH.id): DaySummary[] {
  const { year, month } = parseMonthId(monthId);
  const firstDay = new Date(year, month, 1);
  const lastDay = endOfMonth(monthId);
  const start = new Date(firstDay);
  start.setDate(firstDay.getDate() - firstDay.getDay());

  const end = new Date(lastDay);
  end.setDate(lastDay.getDate() + (6 - lastDay.getDay()));

  const dailyBaseline = goal.spendingLimit / 30;
  const days: DaySummary[] = [];

  for (let cursor = new Date(start); cursor <= end; cursor.setDate(cursor.getDate() + 1)) {
    const date = formatDate(cursor);
    const dayTransactions = transactions.filter((transaction) => transaction.date === date);
    const amount = dayTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const hasSubscription = dayTransactions.some(
      (transaction) => transaction.isSubscription || transaction.category === "구독",
    );
    const isCurrentMonth = cursor.getMonth() === month;

    let status: DaySummary["status"] = "empty";
    if (amount > dailyBaseline && amount > 0) {
      status = "over";
    } else if (hasSubscription) {
      status = "subscription";
    } else if (amount === 0 || amount <= dailyBaseline * 0.5) {
      status = "safe";
    } else {
      status = "normal";
    }

    days.push({
      date,
      day: cursor.getDate(),
      amount,
      status,
      isCurrentMonth,
      transactions: dayTransactions,
    });
  }

  return days;
}

export function getCategorySummaries(transactions: Transaction[]): CategorySummary[] {
  const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);

  return CATEGORIES.map((category) => {
    const amount = transactions
      .filter((transaction) => transaction.category === category)
      .reduce((sum, transaction) => sum + transaction.amount, 0);
    const ratio = total > 0 ? (amount / total) * 100 : 0;
    const status: BudgetStatus = ratio >= 28 ? "over" : ratio >= 16 ? "watch" : "stable";

    return {
      category,
      amount,
      ratio,
      status,
    };
  })
    .filter((summary) => summary.amount > 0)
    .sort((a, b) => b.amount - a.amount);
}

export function getSubscriptionCandidates(transactions: Transaction[]): SubscriptionCandidate[] {
  const grouped = transactions.reduce<Record<string, Transaction[]>>((record, transaction) => {
    if (transaction.isSubscription || transaction.category === "구독") {
      record[transaction.merchant] = [...(record[transaction.merchant] ?? []), transaction];
    }
    return record;
  }, {});

  return Object.values(grouped)
    .map((items) => {
      const first = items[0];
      const monthlyAmount = items.reduce((sum, item) => sum + item.amount, 0);
      const paymentDay = toDate(first.date).getDate();
      const recommendation: SubscriptionCandidate["recommendation"] =
        monthlyAmount >= 15000 ? "점검" : monthlyAmount >= 11000 ? "해지 검토" : "유지";

      return {
        merchant: first.merchant,
        monthlyAmount,
        paymentDay,
        recommendation,
        reason:
          recommendation === "유지"
            ? "월 고정비 중 부담이 낮은 편입니다."
            : "고정 지출 비중을 낮출 여지가 있습니다.",
      };
    })
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

function getPrimaryFocus(goal: Goal, categorySummaries: CategorySummary[]) {
  const focused = categorySummaries.find((summary) => goal.focusCategories.includes(summary.category));
  return focused ?? categorySummaries[0];
}

function buildMissions(
  goal: Goal,
  summary: Summary,
  categories: CategorySummary[],
  subscriptions: SubscriptionCandidate[],
): CoachMission[] {
  const focus = getPrimaryFocus(goal, categories);
  const missions: CoachMission[] = [];

  if (focus) {
    const saving = Math.max(6000, Math.round(focus.amount * 0.12 / 1000) * 1000);
    missions.push({
      id: "mission-focus",
      title: `${focus.category} 한 번 줄이기`,
      reason: `${focus.category} 지출이 이번 달 상위 항목입니다.`,
      expectedSaving: saving,
      action: `이번 주 ${focus.category} 결제를 한 번만 다른 선택지로 바꿔보세요.`,
      completed: false,
    });
  }

  const subscription = subscriptions.find((item) => item.recommendation !== "유지");
  if (subscription) {
    missions.push({
      id: "mission-subscription",
      title: `${subscription.merchant} 점검하기`,
      reason: "반복 결제는 체감보다 월 예산에 크게 남습니다.",
      expectedSaving: subscription.monthlyAmount,
      action: "최근 사용 빈도와 다음 결제일을 함께 확인해보세요.",
      completed: false,
    });
  }

  missions.push({
    id: "mission-no-spend",
    title: "무지출 하루 만들기",
    reason: `남은 ${summary.daysLeft}일 동안 하루 예산을 지키기 위한 완충일입니다.`,
    expectedSaving: Math.min(12000, Math.max(5000, Math.round(summary.dailyBudget * 0.3 / 1000) * 1000)),
    action: "교통비를 제외한 선택 소비를 하루 쉬어가세요.",
    completed: false,
  });

  return missions.slice(0, 3);
}

export function getCoachReport(transactions: Transaction[], goal: Goal, monthId = DEMO_MONTH.id): CoachReport {
  const summary = getSummary(transactions, goal, monthId);
  const categories = getCategorySummaries(transactions);
  const subscriptions = getSubscriptionCandidates(transactions);
  const focus = getPrimaryFocus(goal, categories);
  const targetSavingGoal = summary.isAdjusted ? summary.adjustedSavingGoal : goal.savingGoal;
  const savingPossibility: CoachReport["savingPossibility"] =
    summary.savingProjection >= targetSavingGoal ? "높음" : summary.savingProjection >= targetSavingGoal * 0.75 ? "보통" : "낮음";
  const status = summary.status;
  const missions = buildMissions(goal, summary, categories, subscriptions);
  const focusText = focus ? `${focus.category} 지출` : "선택 소비";
  const todayAction =
    summary.remainingBudget < 0
      ? `월수입 기준으로도 남은 한도가 부족해요. 오늘은 필수 지출만 남기고 추가 결제를 멈춰보세요.`
      : summary.isAdjusted
        ? `초기 목표를 ${formatWon(Math.abs(summary.originalRemainingBudget))} 넘겼지만, 저축 목표를 ${formatWon(summary.adjustedSavingGoal)}로 조정하면 오늘 ${formatWon(summary.dailyBudget)}까지는 사용할 수 있어요.`
      : `${focusText}을 이번 주 한 번만 줄이면 목표 저축에 더 가까워져요.`;

  return {
    headline:
      summary.isAdjusted
        ? `초기 목표 ${formatWon(goal.spendingLimit)}을 넘겨 현실 조정 목표를 ${formatWon(summary.adjustedSpendingLimit)}로 다시 잡았어요.`
        : summary.remainingBudget >= 0
        ? `남은 ${summary.daysLeft}일 동안 하루 ${formatWon(summary.dailyBudget)} 안에서 쓰면 목표 소비액 안에 머물 수 있어요.`
        : `월수입 기준 조정 한도도 ${formatWon(Math.abs(summary.remainingBudget))} 부족해요. 이번 주는 고정비보다 선택 소비 조정이 먼저예요.`,
    status,
    dailyBudget: summary.dailyBudget,
    savingPossibility,
    todayAction,
    insights: [
      focus
        ? `${focus.category}이(가) 이번 달 지출의 ${Math.round(focus.ratio)}%를 차지합니다.`
        : "소비 데이터가 들어오면 우선 조정 항목을 계산합니다.",
      subscriptions.length > 0
        ? `구독/반복 결제로 보이는 항목이 ${subscriptions.length}건 있습니다.`
        : "구독으로 보이는 고정 지출은 아직 없습니다.",
      summary.isAdjusted
        ? `목표 저축액은 ${formatWon(goal.savingGoal)}에서 ${formatWon(summary.adjustedSavingGoal)}로 현실 조정했습니다.`
        : `목표 저축액 ${formatWon(goal.savingGoal)} 기준 현재 예상 저축은 ${formatWon(summary.savingProjection)}입니다.`,
    ],
    missions,
    subscriptionAdvice:
      subscriptions.length > 0
        ? subscriptions.slice(0, 2).map((item) => `${item.merchant}은(는) ${item.paymentDay}일 결제, 월 ${formatWon(item.monthlyAmount)} 수준입니다.`)
        : ["구독 후보가 생기면 결제일과 예상 절약액을 함께 보여줄게요."],
    basis: `${monthId} 소비 ${transactions.length}건, 목표 소비액 ${formatWon(goal.spendingLimit)}, 현실 조정 목표 ${formatWon(summary.adjustedSpendingLimit)}, 목표 저축액 ${formatWon(summary.adjustedSavingGoal)}`,
  };
}

export function alignCoachReportBudgetFields(report: CoachReport, transactions: Transaction[], goal: Goal, monthId = DEMO_MONTH.id): CoachReport {
  const localReport = getCoachReport(transactions, goal, monthId);

  return {
    ...report,
    headline: localReport.headline,
    status: localReport.status,
    dailyBudget: localReport.dailyBudget,
    savingPossibility: localReport.savingPossibility,
    todayAction: localReport.todayAction,
    basis: localReport.basis,
  };
}

export function formatWon(value: number) {
  return `${Math.round(value).toLocaleString("ko-KR")}원`;
}

export function formatShortWon(value: number) {
  if (value === 0) {
    return "0원";
  }

  const compact = (amount: number) => {
    const rounded = Math.round(amount * 10) / 10;
    return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
  };

  if (value >= 10000) {
    return `${compact(value / 10000)}만`;
  }

  return `${compact(value / 1000)}천`;
}

export function getTopCategory(transactions: Transaction[]): Category | undefined {
  return getCategorySummaries(transactions)[0]?.category;
}
