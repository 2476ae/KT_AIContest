import { describe, expect, it } from "vitest";
import { loadSampleTransactions } from "../data";
import { parseTransactionsCsvWithValidation, transactionsToCsv } from "./csv";

describe("csv service", () => {
  it("parses valid transaction CSV and classifies empty categories", () => {
    const csv = [
      "id,date,merchant,amount,memo,paymentType,category,isSubscription",
      "tx-1,2026-06-01,스타벅스,5800,커피,card,,false",
      "tx-2,2026-06-02,넷플릭스,13500,OTT,card,,true",
    ].join("\n");

    const result = parseTransactionsCsvWithValidation(csv);

    expect(result.errors).toEqual([]);
    expect(result.transactions).toHaveLength(2);
    expect(result.transactions[0].category).toBe("카페/간식");
    expect(result.transactions[1].category).toBe("구독");
  });

  it("reports missing required headers and invalid rows", () => {
    const missingHeader = parseTransactionsCsvWithValidation("date,merchant\n2026-06-01,카페");
    expect(missingHeader.errors[0]).toContain("필수 필드");

    const noRows = parseTransactionsCsvWithValidation("date,merchant,amount");
    expect(noRows.errors[0]).toContain("거래 데이터");

    const invalidRows = parseTransactionsCsvWithValidation(
      ["date,merchant,amount", "2026/06/01,카페,0", "2026-06-02,,3000"].join("\n"),
    );

    expect(invalidRows.transactions).toHaveLength(0);
    expect(invalidRows.errors).toHaveLength(2);
  });

  it("accepts quoted comma amounts", () => {
    const result = parseTransactionsCsvWithValidation('date,merchant,amount\n2026-06-01,카페,"4,300"');

    expect(result.errors).toEqual([]);
    expect(result.transactions[0].amount).toBe(4300);
  });

  it("keeps the bundled sample CSV deploy-ready", () => {
    const transactions = loadSampleTransactions();
    const total = transactions.reduce((sum, transaction) => sum + transaction.amount, 0);
    const subscriptions = transactions.filter((transaction) => transaction.isSubscription || transaction.category === "구독");

    expect(transactions).toHaveLength(35);
    expect(total).toBe(397790);
    expect(subscriptions.length).toBeGreaterThanOrEqual(5);
  });

  it("serializes transactions back to CSV", () => {
    const result = parseTransactionsCsvWithValidation("date,merchant,amount\n2026-06-01,카페,4300");
    const csv = transactionsToCsv(result.transactions);

    expect(csv).toContain("id,date,merchant,amount,memo,paymentType,category,isSubscription");
    expect(csv).toContain("카페");
  });
});
