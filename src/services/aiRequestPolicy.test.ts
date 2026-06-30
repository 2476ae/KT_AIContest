import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import type { Transaction } from "../types";
import { createCoachReportCacheKey, shouldRequestCoachReportAi } from "./aiRequestPolicy";

function transaction(amount: number): Transaction {
  return {
    id: "tx-cache",
    date: "2026-06-11",
    merchant: "테스트 카페",
    amount,
    memo: "커피",
    paymentType: "card",
    category: "카페/간식",
    isSubscription: false,
  };
}

describe("AI request policy", () => {
  it("requests coach AI only after an explicit coach-tab request", () => {
    expect(shouldRequestCoachReportAi("coach", true)).toBe(true);
    expect(shouldRequestCoachReportAi("coach", false)).toBe(false);
    expect(shouldRequestCoachReportAi("home", true)).toBe(false);
    expect(shouldRequestCoachReportAi("calendar", true)).toBe(false);
    expect(shouldRequestCoachReportAi("add", true)).toBe(false);
    expect(shouldRequestCoachReportAi("goals", true)).toBe(false);
    expect(shouldRequestCoachReportAi("settings", true)).toBe(false);
  });

  it("creates cache keys from provider and coach input", () => {
    const baseInput = {
      transactions: [transaction(4300)],
      goal: DEFAULT_GOAL,
      monthId: DEMO_MONTH.id,
    };
    const sameInput = {
      transactions: [transaction(4300)],
      goal: DEFAULT_GOAL,
      monthId: DEMO_MONTH.id,
    };
    const changedInput = {
      transactions: [transaction(5200)],
      goal: DEFAULT_GOAL,
      monthId: DEMO_MONTH.id,
    };
    const changedPreviousInput = {
      transactions: [transaction(4300)],
      previousMonthTransactions: [{ ...transaction(12000), id: "tx-cache-previous", date: "2026-05-11" }],
      goal: DEFAULT_GOAL,
      monthId: DEMO_MONTH.id,
    };

    expect(createCoachReportCacheKey(baseInput, "external-ai")).toBe(createCoachReportCacheKey(sameInput, "external-ai"));
    expect(createCoachReportCacheKey(baseInput, "external-ai")).not.toBe(createCoachReportCacheKey(changedInput, "external-ai"));
    expect(createCoachReportCacheKey(baseInput, "external-ai")).not.toBe(createCoachReportCacheKey(changedPreviousInput, "external-ai"));
    expect(createCoachReportCacheKey(baseInput, "external-ai")).not.toBe(createCoachReportCacheKey(baseInput, "other-ai"));
  });
});
