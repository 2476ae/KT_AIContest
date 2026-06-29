import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL } from "../constants";
import { formatMoneyInput, isValidIsoDate, parseMoneyInput, validateGoal, validateTransactionDraft } from "./formValidation";

describe("form validation service", () => {
  it("parses and formats money inputs", () => {
    expect(parseMoneyInput("12,300원")).toBe(12300);
    expect(formatMoneyInput("12300")).toBe("12,300");
    expect(formatMoneyInput("abc")).toBe("");
  });

  it("validates transaction draft fields", () => {
    expect(validateTransactionDraft({ amount: "0", date: "2026-06-01", merchant: "카페" })).toContain(
      "금액은 0원보다 크게 입력해주세요.",
    );
    expect(validateTransactionDraft({ amount: "3,000", date: "2026-02-31", merchant: "카페" })).toContain(
      "날짜는 YYYY-MM-DD 형식의 실제 날짜여야 합니다.",
    );
    expect(validateTransactionDraft({ amount: "3,000", date: "2026-06-01", merchant: "카페" })).toEqual([]);
  });

  it("validates goal errors and warnings separately", () => {
    const invalid = validateGoal({ ...DEFAULT_GOAL, monthlyIncome: 0 });
    expect(invalid.errors[0]).toContain("월 수입");

    const aggressive = validateGoal({ ...DEFAULT_GOAL, monthlyIncome: 800000, spendingLimit: 720000, savingGoal: 200000 });
    expect(aggressive.errors).toEqual([]);
    expect(aggressive.warnings[0]).toContain("목표 저축액");
  });

  it("accepts only real ISO dates", () => {
    expect(isValidIsoDate("2026-06-29")).toBe(true);
    expect(isValidIsoDate("2026-13-01")).toBe(false);
    expect(isValidIsoDate("2026/06/29")).toBe(false);
  });
});
