import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import { loadSampleTransactions } from "../data";
import { getCalendarDays, getCoachReport, getSummary, getSubscriptionCandidates } from "./analytics";

describe("analytics service", () => {
  const transactions = loadSampleTransactions();

  it("calculates sample spending summary", () => {
    const summary = getSummary(transactions, DEFAULT_GOAL, DEMO_MONTH.id);

    expect(summary.totalSpent).toBe(397790);
    expect(summary.subscriptionTotal).toBe(63690);
    expect(Math.round(summary.progress)).toBe(55);
    expect(summary.dailyBudget).toBe(322210);
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
});
