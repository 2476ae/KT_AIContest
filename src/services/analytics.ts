import { CATEGORIES, DEMO_MONTH } from "../constants";
import { formatDate, parseMonthId } from "./date";
import type {
  BudgetStatus,
  Category,
  CategoryPlan,
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

export function getSubscriptionCandidates(transactions: Transaction[], goal?: Goal): SubscriptionCandidate[] {
  const grouped = transactions.reduce<Record<string, Transaction[]>>((record, transaction) => {
    if (transaction.isSubscription || transaction.category === "구독") {
      record[transaction.merchant] = [...(record[transaction.merchant] ?? []), transaction];
    }
    return record;
  }, {});
  const subscriptionTotal = Object.values(grouped)
    .flat()
    .reduce((sum, transaction) => sum + transaction.amount, 0);
  const subscriptionLimit = goal?.subscriptionLimit ?? 0;
  const limitRatio = subscriptionLimit > 0 ? subscriptionTotal / subscriptionLimit : 0;
  const spendingRatio = goal?.spendingLimit ? subscriptionTotal / goal.spendingLimit : 0;
  const isOverallFixedCostMeaningful = spendingRatio >= 0.12;

  return Object.values(grouped)
    .map((items) => {
      const first = items[0];
      const monthlyAmount = items.reduce((sum, item) => sum + item.amount, 0);
      const paymentDay = toDate(first.date).getDate();
      const itemLimitRatio = subscriptionLimit > 0 ? monthlyAmount / subscriptionLimit : 0;
      const itemSpendingRatio = goal?.spendingLimit ? monthlyAmount / goal.spendingLimit : 0;
      const isLargeItem = itemLimitRatio >= 0.28 && itemSpendingRatio >= 0.045;
      const isMeaningfulNearLimitItem = limitRatio >= 0.85 && isOverallFixedCostMeaningful && itemLimitRatio >= 0.18;
      const isOverLimitItem = limitRatio >= 1 && isOverallFixedCostMeaningful && itemLimitRatio >= 0.18;
      const recommendation: SubscriptionCandidate["recommendation"] =
        isOverLimitItem || itemLimitRatio >= 0.36
          ? "해지 검토"
          : isMeaningfulNearLimitItem || isLargeItem
            ? "점검"
            : "유지";

      return {
        merchant: first.merchant,
        monthlyAmount,
        paymentDay,
        recommendation,
        reason:
          recommendation === "해지 검토"
            ? limitRatio >= 1
              ? "구독 상한을 넘어 우선순위 확인이 필요합니다."
              : "단일 정기 결제 비중이 높아 사용 빈도 확인이 필요합니다."
            : recommendation === "점검"
              ? limitRatio >= 0.85
                ? "구독 상한에 가까워 큰 항목만 확인해보세요."
                : "단일 정기 결제 비중이 조금 높은 편입니다."
              : "구독 상한 안에서 안정적으로 유지 중입니다.",
      };
    })
    .sort((a, b) => b.monthlyAmount - a.monthlyAmount);
}

function getPrimaryFocus(goal: Goal, categorySummaries: CategorySummary[]) {
  const focused = categorySummaries.find((summary) => goal.focusCategories.includes(summary.category));
  return focused ?? categorySummaries[0];
}

function getDailyTarget(goal: Goal) {
  return goal.spendingLimit > 0 ? goal.spendingLimit / 30 : 0;
}

function hasAmpleBudgetRoom(goal: Goal, summary: Summary) {
  const dailyTarget = getDailyTarget(goal);

  return summary.status === "stable" && summary.remainingBudget > 0 && (dailyTarget === 0 || summary.dailyBudget >= dailyTarget * 2);
}

function buildMissions(
  goal: Goal,
  summary: Summary,
  categories: CategorySummary[],
  subscriptions: SubscriptionCandidate[],
): CoachMission[] {
  const focus = getPrimaryFocus(goal, categories);
  const hasAmpleRoom = hasAmpleBudgetRoom(goal, summary);
  const missions: CoachMission[] = [];

  if (hasAmpleRoom) {
    missions.push({
      id: "mission-record",
      title: "계획한 소비 기록하기",
      reason: `오늘은 ${formatWon(summary.dailyBudget)}까지 여유가 있어 감액보다 기록 유지가 우선입니다.`,
      expectedSaving: 0,
      impactLabel: "실행",
      impactText: "기록",
      action: "필요한 결제는 진행하되 결제 후 바로 기록하세요.",
      completed: false,
    });
  } else if (focus) {
    const saving = Math.max(6000, Math.round(focus.amount * 0.12 / 1000) * 1000);
    missions.push({
      id: "mission-focus",
      title: `${focus.category} 한 번 줄이기`,
      reason: `${focus.category} 지출이 이번 달 상위 항목입니다.`,
      expectedSaving: saving,
      impactLabel: "예상 절감",
      action: `이번 주 ${focus.category} 결제를 한 번만 다른 선택지로 바꿔보세요.`,
      completed: false,
    });
  }

  const subscriptionPressure = goal.subscriptionLimit > 0 ? summary.subscriptionTotal / goal.subscriptionLimit : 0;
  const subscriptionSpendingRatio = goal.spendingLimit > 0 ? summary.subscriptionTotal / goal.spendingLimit : 0;
  const subscription =
    subscriptions.find((item) => item.recommendation === "해지 검토") ??
    (subscriptionPressure >= 0.85 && subscriptionSpendingRatio >= 0.12 ? subscriptions.find((item) => item.recommendation === "점검") : undefined);
  if (subscription) {
    missions.push({
      id: "mission-subscription",
      title: `${subscription.merchant} 사용 빈도 확인`,
      reason: subscriptionPressure >= 1 ? "정기 결제 합계가 구독 상한을 넘었어요." : "정기 결제 합계가 구독 상한에 가까워요.",
      expectedSaving: subscription.monthlyAmount,
      impactLabel: "점검 금액",
      action: "최근 사용 빈도와 다음 결제일만 확인해보세요.",
      completed: false,
    });
  }

  missions.push({
    id: "mission-daily-budget",
    title: hasAmpleRoom ? "큰 결제 전 한도 확인" : summary.status === "stable" ? "하루 한도 안에서 쓰기" : "선택 소비 하루 쉬기",
    reason:
      hasAmpleRoom
        ? "여유가 커도 큰 결제는 월 목표와 한 번 비교하세요."
        : summary.status === "stable"
        ? `오늘은 ${formatWon(summary.dailyBudget)} 안에서 흐름을 유지해요.`
        : `남은 ${summary.daysLeft}일 동안 하루 예산을 지키기 위한 완충일입니다.`,
    expectedSaving: hasAmpleRoom ? summary.dailyBudget : Math.min(12000, Math.max(5000, Math.round(summary.dailyBudget * 0.25 / 1000) * 1000)),
    impactLabel: hasAmpleRoom ? "남은 한도" : "예상 절감",
    action: hasAmpleRoom
      ? "큰 결제를 추가하기 전 남은 한도와 저축 예상을 확인하세요."
      : summary.status === "stable"
        ? "예정된 소비만 기록하고 추가 결제는 한 번 더 확인하세요."
        : "교통비를 제외한 선택 소비를 하루 쉬어가세요.",
    completed: false,
  });

  return missions.slice(0, 3);
}

function getCategoryAction(category: Category, hasAmpleRoom: boolean) {
  if (hasAmpleRoom) {
    const relaxedActions: Record<Category, string> = {
      식비: "식사는 예정대로 쓰고 결제 후 바로 기록하세요.",
      "카페/간식": "간식은 계획한 만큼 쓰고 추가 결제만 확인하세요.",
      교통: "이동비는 유지하되 큰 이동 전에 한도만 확인하세요.",
      쇼핑: "필요한 구매는 진행하고 충동 결제만 한 번 더 보세요.",
      여가: "예정된 여가는 유지하고 월말 한도만 확인하세요.",
      구독: "정기 결제는 유지하되 다음 결제일만 확인하세요.",
      교육: "필요한 학습비는 유지하고 중복 결제만 확인하세요.",
      의료: "필수 의료비는 그대로 기록하세요.",
      생활: "필요한 생활비는 쓰고 재고만 확인하세요.",
      기타: "용도를 메모해두고 월말에 다시 분류하세요.",
    };

    return relaxedActions[category];
  }

  const actions: Record<Category, string> = {
    식비: "배달/외식을 한 끼만 집밥이나 학식으로 바꾸기",
    "카페/간식": "커피나 간식 결제를 하루 한 번 쉬기",
    교통: "택시나 추가 이동을 한 번 줄이기",
    쇼핑: "장바구니 결제를 하루 보류하기",
    여가: "이번 주 유료 여가 결제를 한 번 쉬기",
    구독: "최근 안 쓴 정기 결제 1건 해지 검토",
    교육: "중복 강의나 자료 결제 전 재확인",
    의료: "필수 의료비는 유지하고 비급한 지출만 미루기",
    생활: "생활용품 묶음 구매 전 재고 확인",
    기타: "용도가 흐린 결제는 메모 후 재구매 판단",
  };

  return actions[category];
}

function buildCategoryPlans(categories: CategorySummary[], summary: Summary, goal: Goal): CategoryPlan[] {
  const hasAmpleRoom = hasAmpleBudgetRoom(goal, summary);
  const priorityCategories = hasAmpleRoom ? [] : categories.filter((category) => category.status !== "stable");
  const visibleCategories = priorityCategories.length > 0 ? priorityCategories : categories.slice(0, 3);
  const totalVisibleAmount = visibleCategories.reduce((sum, category) => sum + category.amount, 0);
  const remainingBudget = Math.max(0, summary.remainingBudget);

  return visibleCategories.slice(0, 3).map((category) => {
    const weight = totalVisibleAmount > 0 ? category.amount / totalVisibleAmount : 1 / Math.max(visibleCategories.length, 1);
    const futureRoom = remainingBudget * weight;
    const roomRate = hasAmpleRoom ? 1 : category.status === "over" ? 0.42 : category.status === "watch" ? 0.62 : 0.78;
    const plannedAmount = Math.max(category.amount, Math.round((category.amount + futureRoom * roomRate) / 1000) * 1000);
    const expectedSaving = hasAmpleRoom ? 0 : Math.max(0, Math.round((futureRoom - futureRoom * roomRate) / 1000) * 1000);
    const planStatus: BudgetStatus =
      summary.remainingBudget < 0 ? "over" : !hasAmpleRoom && category.status !== "stable" ? category.status : "stable";

    return {
      category: category.category,
      status: planStatus,
      currentAmount: category.amount,
      plannedAmount,
      expectedSaving,
      reason: hasAmpleRoom
        ? `${category.category}은(는) 전체의 ${Math.round(category.ratio)}%지만 현재 한도 여유가 충분합니다.`
        : `${category.category}은(는) 전체의 ${Math.round(category.ratio)}%입니다. 남은 한도 안에서 추가 지출만 조정하세요.`,
      action: getCategoryAction(category.category, hasAmpleRoom),
    };
  });
}

export function getCoachReport(transactions: Transaction[], goal: Goal, monthId = DEMO_MONTH.id): CoachReport {
  const summary = getSummary(transactions, goal, monthId);
  const categories = getCategorySummaries(transactions);
  const subscriptions = getSubscriptionCandidates(transactions, goal);
  const focus = getPrimaryFocus(goal, categories);
  const targetSavingGoal = goal.savingGoal;
  const savingPossibility: CoachReport["savingPossibility"] =
    summary.savingProjection >= targetSavingGoal ? "높음" : summary.savingProjection >= targetSavingGoal * 0.75 ? "보통" : "낮음";
  const status = summary.status;
  const missions = buildMissions(goal, summary, categories, subscriptions);
  const categoryPlans = buildCategoryPlans(categories, summary, goal);
  const subscriptionPressure = goal.subscriptionLimit > 0 ? summary.subscriptionTotal / goal.subscriptionLimit : 0;
  const subscriptionSpendingRatio = goal.spendingLimit > 0 ? summary.subscriptionTotal / goal.spendingLimit : 0;
  const focusText = focus ? `${focus.category} 지출` : "선택 소비";
  const hasAmpleRoom = hasAmpleBudgetRoom(goal, summary);
  const todayAction =
    summary.remainingBudget < 0
      ? `월수입 기준으로도 남은 한도가 부족해요. 오늘은 필수 지출만 남기고 추가 결제를 멈춰보세요.`
      : summary.isAdjusted
        ? `초기 소비 목표를 ${formatWon(Math.abs(summary.originalRemainingBudget))} 넘겼지만, 월 목표를 ${formatWon(summary.adjustedSpendingLimit)}으로 조정하면 오늘 ${formatWon(summary.dailyBudget)}까지는 사용할 수 있어요.`
      : hasAmpleRoom
        ? `오늘은 ${formatWon(summary.dailyBudget)}까지 여유가 있어 줄이기보다 계획한 소비를 기록하는 데 집중하세요.`
      : `${focusText}을 이번 주 한 번만 줄이면 목표 저축에 더 가까워져요.`;

  return {
    headline:
      summary.isAdjusted
        ? `초기 목표 ${formatWon(goal.spendingLimit)}을 넘겨 현실 조정 목표를 ${formatWon(summary.adjustedSpendingLimit)}으로 다시 잡았어요.`
        : summary.remainingBudget >= 0
        ? `남은 ${summary.daysLeft}일 동안 하루 ${formatWon(summary.dailyBudget)} 안에서 쓰면 목표 소비액 안에 머물 수 있어요.`
        : `월수입 기준 조정 한도도 ${formatWon(Math.abs(summary.remainingBudget))} 부족해요. 이번 주는 고정비보다 선택 소비 조정이 먼저예요.`,
    status,
    dailyBudget: summary.dailyBudget,
    savingPossibility,
    todayAction,
    insights: [
      hasAmpleRoom
        ? `남은 한도가 커서 ${focusText} 감액보다 지출 기록 유지가 더 중요합니다.`
        : focus
        ? `${focus.category}이(가) 이번 달 지출의 ${Math.round(focus.ratio)}%를 차지합니다.`
        : "소비 데이터가 들어오면 우선 조정 항목을 계산합니다.",
      subscriptionPressure >= 0.85 && subscriptionSpendingRatio >= 0.12
        ? `정기 결제 합계가 구독 상한의 ${Math.round(subscriptionPressure * 100)}%입니다.`
        : summary.subscriptionTotal > 0
          ? "정기 결제는 전체 예산 대비 안정적입니다."
        : "구독으로 보이는 고정 지출은 아직 없습니다.",
      summary.isAdjusted
        ? `조정 후 예상 저축은 ${formatWon(summary.adjustedSavingGoal)}입니다. 원래 저축 목표와 함께 비교해보세요.`
        : `목표 저축액 ${formatWon(goal.savingGoal)} 기준 현재 예상 저축은 ${formatWon(summary.savingProjection)}입니다.`,
    ],
    categoryPlans,
    missions,
    subscriptionAdvice:
      subscriptions.length > 0
        ? subscriptions
            .slice(0, subscriptionPressure >= 0.85 && subscriptionSpendingRatio >= 0.12 ? 2 : 1)
            .map((item) => `${item.merchant}은(는) ${item.paymentDay}일 결제, 월 ${formatWon(item.monthlyAmount)} 수준입니다.`)
        : ["구독 후보가 생기면 결제일과 예상 절약액을 함께 보여줄게요."],
    basis: `${monthId} 소비 ${transactions.length}건, 목표 소비액 ${formatWon(goal.spendingLimit)}, 현실 조정 목표 ${formatWon(summary.adjustedSpendingLimit)}, 조정 후 예상 저축 ${formatWon(summary.adjustedSavingGoal)}`,
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
    categoryPlans: localReport.categoryPlans,
    missions: localReport.missions,
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
