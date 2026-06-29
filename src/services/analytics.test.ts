import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import { loadSampleTransactions } from "../data";
import { alignCoachReportBudgetFields, getCalendarDays, getCoachReport, getSummary, getSubscriptionCandidates } from "./analytics";

describe("analytics service", () => {
  const transactions = loadSampleTransactions();

  it("calculates sample spending summary", () => {
    const summary = getSummary(transactions, DEFAULT_GOAL, DEMO_MONTH.id);

    expect(summary.totalSpent).toBe(397790);
    expect(summary.subscriptionTotal).toBe(63690);
    expect(Math.round(summary.progress)).toBe(55);
    expect(summary.dailyBudget).toBe(322210);
  });

  it("explains overspending as an exceeded amount", () => {
    const overGoal = { ...DEFAULT_GOAL, spendingLimit: 300000 };
    const summary = getSummary(transactions, overGoal, DEMO_MONTH.id);
    const report = getCoachReport(transactions, overGoal, DEMO_MONTH.id);

    expect(summary.status).toBe("over");
    expect(summary.remainingBudget).toBeLessThan(0);
    expect(summary.dailyBudget).toBe(0);
    expect(report.headline).toContain("초과");
    expect(report.todayAction).toContain("초과");
  });

  it("builds a full month calendar grid", () => {
    const days = getCalendarDays(transactions, DEFAULT_GOAL, DEMO_MONTH.id);
    const june10 = days.find((day) => day.date === "2026-06-10");

    expect(days).toHaveLength(35);
    expect(june10?.amount).toBe(52000);
    expect(june10?.status).toBe("over");
  });

  it("detects subscription candidates", () => {
    const subscriptions = getSubscriptionCandidates(transactions);

    expect(subscriptions).toHaveLength(5);
    expect(subscriptions[0].merchant).toBe("노션AI");
  });

  it("creates coach report display data", () => {
    const report = getCoachReport(transactions, DEFAULT_GOAL, DEMO_MONTH.id);

    expect(report.headline).toContain("하루");
    expect(report.missions.length).toBeGreaterThanOrEqual(2);
    expect(report.subscriptionAdvice[0]).toContain("월");
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
