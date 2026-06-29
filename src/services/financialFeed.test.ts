import { describe, expect, it } from "vitest";
import { CATEGORIES } from "../constants";
import {
  MAX_FINANCIAL_FEED_BATCH_SIZE,
  normalizeFinancialFeedTransactions,
  type FinancialFeedTransactionInput,
} from "./financialFeed";

describe("financial feed service", () => {
  it("deduplicates feed updates and skips unsafe rows", () => {
    const rows = [
      undefined,
      {
        externalId: "bad-date",
        postedAt: "not-a-date",
        merchant: "Cafe",
        amount: -1000,
      },
      {
        externalId: "salary",
        postedAt: "2026-06-30",
        merchant: "Salary",
        amount: 1_200_000,
        direction: "credit",
      },
      {
        externalId: "too-large",
        postedAt: "2026-06-30",
        merchant: "Luxury Shop",
        amount: 999_999_999,
      },
      {
        externalId: "card-001",
        postedAt: "2026-06-30",
        merchant: "Pending Cafe",
        amount: -1500,
        memo: "pending",
      },
      {
        externalId: "card-001",
        postedAt: "2026-06-30T12:00:00+09:00",
        merchant: "Final Cafe",
        amount: "-2500",
        memo: "settled",
        category: CATEGORIES[1],
      },
    ] as unknown as FinancialFeedTransactionInput[];

    const result = normalizeFinancialFeedTransactions(rows, "linked-card");

    expect(result.skipped).toHaveLength(4);
    expect(result.transactions).toHaveLength(1);
    expect(result.transactions[0]).toMatchObject({
      id: "tx-feed-linked-card-card-001",
      date: "2026-06-30",
      merchant: "Final Cafe",
      amount: 2500,
      memo: "settled",
      category: CATEGORIES[1],
    });
  });

  it("limits oversized feed batches so the app stays responsive", () => {
    const rows = Array.from({ length: MAX_FINANCIAL_FEED_BATCH_SIZE + 5 }, (_, index) => ({
      externalId: `bulk-${index}`,
      postedAt: "2026-06-30",
      merchant: `Merchant ${index}`,
      amount: -1000 - index,
    }));

    const result = normalizeFinancialFeedTransactions(rows, "bulk-card");

    expect(result.transactions).toHaveLength(MAX_FINANCIAL_FEED_BATCH_SIZE);
    expect(result.skipped.some((item) => item.reason.includes(String(MAX_FINANCIAL_FEED_BATCH_SIZE)))).toBe(true);
  });
});
