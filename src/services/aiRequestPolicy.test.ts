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
  it("requests coach AI only from the coach tab", () => {
    expect(shouldRequestCoachReportAi("coach")).toBe(true);
    expect(shouldRequestCoachReportAi("home")).toBe(false);
    expect(shouldRequestCoachReportAi("calendar")).toBe(false);
    expect(shouldRequestCoachReportAi("add")).toBe(false);
    expect(shouldRequestCoachReportAi("goals")).toBe(false);
    expect(shouldRequestCoachReportAi("settings")).toBe(false);
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

    expect(createCoachReportCacheKey(baseInput, "external-ai")).toBe(createCoachReportCacheKey(sameInput, "external-ai"));
    expect(createCoachReportCacheKey(baseInput, "external-ai")).not.toBe(createCoachReportCacheKey(changedInput, "external-ai"));
    expect(createCoachReportCacheKey(baseInput, "external-ai")).not.toBe(createCoachReportCacheKey(baseInput, "other-ai"));
  });
});
