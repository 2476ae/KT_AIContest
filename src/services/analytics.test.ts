import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import { loadSampleTransactions } from "../data";
import { alignCoachReportBudgetFields, getCalendarDays, getCoachReport, getDaysLeft, getSummary, getSubscriptionCandidates } from "./analytics";

describe("analytics service", () => {
  const allTransactions = loadSampleTransactions();
  const transactions = allTransactions.filter((transaction) => transaction.date.startsWith("2026-06"));
  const previousTransactions = allTransactions.filter((transaction) => transaction.date.startsWith("2026-05"));

  it("uses the actual day for the current month's remaining days", () => {
    expect(getDaysLeft([], "2026-07", new Date(2026, 6, 14))).toBe(17);
  });

  it("calculates sample spending summary", () => {
    const summary = getSummary(transactions, DEFAULT_GOAL, DEMO_MONTH.id);

    expect(summary.totalSpent).toBe(397790);
    expect(summary.subscriptionTotal).toBe(63690);
    expect(Math.round(summary.progress)).toBe(55);
    expect(summary.dailyBudget).toBe(322210);
  });

  it("creates a realistic adjusted budget after the original target is exceeded", () => {
    const overGoal = { ...DEFAULT_GOAL, spendingLimit: 300000 };
    const summary = getSummary(transactions, overGoal, DEMO_MONTH.id);
    const report = getCoachReport(transactions, overGoal, DEMO_MONTH.id);

    expect(summary.status).toBe("watch");
    expect(summary.isAdjusted).toBe(true);
    expect(summary.adjustedSpendingLimit).toBe(407790);
    expect(summary.remainingBudget).toBe(10000);
    expect(summary.dailyBudget).toBe(10000);
    expect(report.headline).toContain("조정 목표");
    expect(report.todayAction).toContain("괜찮아요");
  });

  it("keeps a practical daily budget by reducing the saving target within monthly income", () => {
    const goal = {
      ...DEFAULT_GOAL,
      monthlyIncome: 2000000,
      savingGoal: 1000000,
      spendingLimit: 1000000,
    };
    const heavySpending = [
      {
        id: "tx-heavy",
        date: "2026-06-25",
        merchant: "생활비",
        amount: 1100000,
        memo: "목표 초과",
        paymentType: "card" as const,
        category: "생활" as const,
        isSubscription: false,
      },
    ];
    const summary = getSummary(heavySpending, goal, DEMO_MONTH.id);

    expect(summary.isAdjusted).toBe(true);
    expect(summary.adjustedSpendingLimit).toBe(1200000);
    expect(summary.adjustedSavingGoal).toBe(800000);
    expect(summary.daysLeft).toBe(5);
    expect(summary.dailyBudget).toBe(20000);
  });

  it("uses non-adjusted basis copy when the target has not been adjusted", () => {
    const goal = {
      ...DEFAULT_GOAL,
      monthlyIncome: 1300000,
      savingGoal: 200000,
      spendingLimit: 700000,
    };
    const summary = getSummary(transactions, goal, DEMO_MONTH.id);
    const report = getCoachReport(transactions, goal, DEMO_MONTH.id);

    expect(summary.isAdjusted).toBe(false);
    expect(summary.adjustedSavingGoal).toBe(600000);
    expect(report.basis).toContain("목표 소비액 700,000원");
    expect(report.basis).toContain("현재 기준 남는 금액 902,210원");
    expect(report.basis).not.toContain("조정 목표");
    expect(report.basis).not.toContain("조정 후 예상 저축 200,000원");
  });

  it("builds a full month calendar grid", () => {
    const days = getCalendarDays(transactions, DEFAULT_GOAL, DEMO_MONTH.id);
    const june10 = days.find((day) => day.date === "2026-06-10");
    const currentMonthDays = days.filter((day) => day.isCurrentMonth);

    expect(days).toHaveLength(35);
    expect(june10?.amount).toBe(52000);
    expect(june10?.status).toBe("over");
    expect(currentMonthDays.every((day) => ["over", "subscription", "safe"].includes(day.status))).toBe(true);
    expect(currentMonthDays.some((day) => day.status === "empty")).toBe(false);
  });

  it("detects subscription candidates", () => {
    const subscriptions = getSubscriptionCandidates(transactions);

    expect(subscriptions).toHaveLength(5);
    expect(subscriptions[0].merchant).toBe("노션AI");
  });

  it("does not over-warn about subscriptions when the fixed-cost ratio is low", () => {
    const relaxedGoal = { ...DEFAULT_GOAL, subscriptionLimit: 200000 };
    const subscriptions = getSubscriptionCandidates(transactions, relaxedGoal);
    const report = getCoachReport(transactions, relaxedGoal, DEMO_MONTH.id);

    expect(subscriptions.every((item) => item.recommendation === "유지")).toBe(true);
    expect(report.missions.some((mission) => mission.id === "mission-subscription")).toBe(false);
    expect(report.insights).toContain("정기 결제는 전체 예산 대비 안정적입니다.");
  });

  it("creates coach report display data", () => {
    const report = getCoachReport(transactions, DEFAULT_GOAL, DEMO_MONTH.id, previousTransactions);

    expect(report.headline).toContain("오늘 한도");
    expect(report.categoryPlans.length).toBeGreaterThan(0);
    expect(report.categoryPlans[0].plannedAmount).toBeGreaterThanOrEqual(report.categoryPlans[0].currentAmount);
    expect(report.categoryPlans[0].previousRatio).toBeGreaterThan(0);
    expect(report.categoryPlans[0].reason).toContain("지난달");
    expect(report.missions.length).toBeGreaterThanOrEqual(2);
    expect(report.missions.some((mission) => mission.id === "mission-subscription")).toBe(false);
    expect(report.subscriptionAdvice[0]).toContain("월");
  });

  it("builds detailed coach basis items for the analysis section", () => {
    const report = getCoachReport(transactions, DEFAULT_GOAL, DEMO_MONTH.id, previousTransactions);

    expect(report.basisItems.map((item) => item.id)).toEqual([
      "budget-position",
      "daily-limit",
      "saving-outlook",
      "category-pattern",
      "subscription-pressure",
    ]);
    expect(report.basisItems.find((item) => item.id === "budget-position")?.value).toContain("% 사용");
    expect(report.basisItems.find((item) => item.id === "daily-limit")?.value).toBe("322,210원");
    expect(report.basisItems.find((item) => item.id === "saving-outlook")?.detail).toContain("원과 비교");
    expect(report.basisItems.find((item) => item.id === "category-pattern")?.detail).toContain("→");
    expect(report.basisItems.find((item) => item.id === "subscription-pressure")?.detail).toContain("상한 대비");
  });

  it("explains adjusted saving as income-based remaining money", () => {
    const overGoal = { ...DEFAULT_GOAL, spendingLimit: 300000 };
    const report = getCoachReport(transactions, overGoal, DEMO_MONTH.id, previousTransactions);
    const savingBasis = report.basisItems.find((item) => item.id === "saving-outlook");

    expect(savingBasis?.title).toBe("조정 후 저축 예상");
    expect(savingBasis?.detail).toBe("월수입 기준 남길 수 있는 금액");
  });

  it("uses previous month category ratios as category plan context", () => {
    const report = getCoachReport(transactions, DEFAULT_GOAL, DEMO_MONTH.id, previousTransactions);
    const patternPlan = report.categoryPlans.find((plan) => typeof plan.previousRatio === "number");

    expect(patternPlan).toBeDefined();
    expect(patternPlan?.previousRatio).toBeGreaterThan(0);
    expect(patternPlan?.currentRatio).toBeGreaterThan(0);
    expect(patternPlan?.guideRatio).toBeGreaterThan(0);
    expect(patternPlan?.reason).toMatch(/지난달 \d+% → 이번달 \d+%/);
    expect(report.basis).toContain("지난달 대비");
  });

  it("keeps category plans diverse when only one category needs extra attention", () => {
    const report = getCoachReport(transactions, DEFAULT_GOAL, DEMO_MONTH.id, previousTransactions);
    const planCategories = report.categoryPlans.map((plan) => plan.category);

    expect(report.categoryPlans.length).toBeGreaterThanOrEqual(3);
    expect(report.categoryPlans.length).toBeLessThanOrEqual(4);
    expect(new Set(planCategories).size).toBe(planCategories.length);
    expect(planCategories).toContain("쇼핑");
    expect(planCategories).not.toEqual(["쇼핑"]);
  });

  it("does not push reduction missions when the daily budget has ample room", () => {
    const report = getCoachReport(transactions, DEFAULT_GOAL, DEMO_MONTH.id);

    expect(report.dailyBudget).toBe(322210);
    expect(report.todayAction).toContain("기록");
    expect(report.missions.some((mission) => mission.title.includes("줄이기"))).toBe(false);
    expect(report.missions.some((mission) => mission.action.includes("쉬기"))).toBe(false);
    expect(report.missions.some((mission) => mission.impactLabel === "남은 한도")).toBe(true);
    expect(report.categoryPlans.every((plan) => plan.plannedAmount >= plan.currentAmount)).toBe(true);
    expect(report.categoryPlans.every((plan) => plan.expectedSaving === 0)).toBe(true);
  });

  it("keeps budget-critical coach copy aligned with local spending math", () => {
    const unsafeAiReport = {
      ...getCoachReport(transactions, DEFAULT_GOAL, DEMO_MONTH.id),
      headline: "목표 소비액을 초과했어요. 즉시 소비를 멈추세요.",
      status: "over" as const,
      dailyBudget: 0,
      todayAction: "추가 소비를 모두 중단하세요.",
    };
    const aligned = alignCoachReportBudgetFields(unsafeAiReport, transactions, DEFAULT_GOAL, DEMO_MONTH.id);

    expect(getSummary(transactions, DEFAULT_GOAL, DEMO_MONTH.id).remainingBudget).toBeGreaterThan(0);
    expect(aligned.status).not.toBe("over");
    expect(aligned.dailyBudget).toBe(322210);
    expect(aligned.headline).not.toContain("초과");
    expect(aligned.todayAction).not.toContain("중단");
  });
});
