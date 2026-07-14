import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import type { Transaction } from "../types";
import { getSummary } from "./analytics";
import { createAutomaticGoalAdjustment } from "./budgetAdjustment";

function transaction(amount: number): Transaction {
  return {
    id: "tx-over-goal",
    date: "2026-06-25",
    merchant: "생활비",
    amount,
    memo: "목표 초과",
    paymentType: "card",
    category: "생활",
    isSubscription: false,
  };
}

describe("automatic budget adjustment", () => {
  it("keeps the goal unchanged before spending exceeds it", () => {
    const summary = getSummary([transaction(300000)], DEFAULT_GOAL, DEMO_MONTH.id);
    expect(createAutomaticGoalAdjustment(DEFAULT_GOAL, summary)).toBe(DEFAULT_GOAL);
  });

  it("applies a practical rounded spending target and preserves possible saving", () => {
    const goal = {
      ...DEFAULT_GOAL,
      monthlyIncome: 2000000,
      spendingLimit: 1000000,
      savingGoal: 1000000,
    };
    const summary = getSummary([transaction(1100000)], goal, DEMO_MONTH.id);
    const adjusted = createAutomaticGoalAdjustment(goal, summary);

    expect(adjusted.spendingLimit).toBe(1200000);
    expect(adjusted.savingGoal).toBe(800000);
  });

  it("does not suggest extra spending after monthly income is already exceeded", () => {
    const summary = getSummary([transaction(1300000)], DEFAULT_GOAL, DEMO_MONTH.id);
    const adjusted = createAutomaticGoalAdjustment(DEFAULT_GOAL, summary);

    expect(adjusted.spendingLimit).toBe(1300000);
    expect(adjusted.savingGoal).toBe(0);
  });
});
