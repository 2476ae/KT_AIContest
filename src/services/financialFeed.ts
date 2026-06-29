import { CATEGORIES } from "../constants";
import type { Category, PaymentType, Transaction } from "../types";
import { classifyTransaction } from "./aiAdapter";

export type FinancialFeedDirection = "credit" | "debit";

export interface FinancialFeedTransactionInput {
  externalId: string;
  postedAt: string;
  merchant: string;
  amount: number;
  accountName?: string;
  category?: Category;
  direction?: FinancialFeedDirection;
  isSubscription?: boolean;
  memo?: string;
  paymentType?: PaymentType;
  source?: string;
}

export interface FinancialFeedNormalizeResult {
  skipped: Array<{ externalId?: string; reason: string }>;
  transactions: Transaction[];
}

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.includes(value as Category);
}

function asPaymentType(value: unknown): PaymentType {
  if (value === "cash" || value === "transfer" || value === "transport") {
    return value;
  }

  return "card";
}

function normalizeDate(postedAt: string) {
  const trimmed = postedAt.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

function stableFeedId(source: string, externalId: string) {
  const normalizedSource = source.toLowerCase().replace(/[^a-z0-9가-힣_-]+/gi, "-").replace(/^-|-$/g, "") || "feed";
  const normalizedExternalId = externalId.toLowerCase().replace(/[^a-z0-9가-힣_-]+/gi, "-").replace(/^-|-$/g, "");

  return `tx-feed-${normalizedSource}-${normalizedExternalId || "unknown"}`;
}

function isExpense(input: FinancialFeedTransactionInput) {
  if (input.direction === "credit") {
    return false;
  }

  return input.direction === "debit" || input.amount < 0 || input.amount > 0;
}

export function normalizeFinancialFeedTransactions(
  inputs: FinancialFeedTransactionInput[],
  defaultSource = "financial-feed",
): FinancialFeedNormalizeResult {
  const skipped: FinancialFeedNormalizeResult["skipped"] = [];
  const transactions = inputs.flatMap((input): Transaction[] => {
    if (!input || typeof input !== "object") {
      skipped.push({ reason: "거래 형식이 올바르지 않습니다." });
      return [];
    }

    const externalId = String(input.externalId ?? "").trim();
    const merchant = String(input.merchant ?? "").trim();
    const date = normalizeDate(String(input.postedAt ?? ""));
    const rawAmount = Number(input.amount);

    if (!externalId) {
      skipped.push({ reason: "외부 거래 ID가 없습니다." });
      return [];
    }

    if (!date) {
      skipped.push({ externalId, reason: "거래 일시가 올바르지 않습니다." });
      return [];
    }

    if (!merchant) {
      skipped.push({ externalId, reason: "사용처가 비어 있습니다." });
      return [];
    }

    if (!Number.isFinite(rawAmount) || rawAmount === 0) {
      skipped.push({ externalId, reason: "금액이 올바르지 않습니다." });
      return [];
    }

    if (!isExpense(input)) {
      skipped.push({ externalId, reason: "입금 거래는 소비 내역에 반영하지 않습니다." });
      return [];
    }

    const amount = Math.abs(Math.round(rawAmount));
    const memoParts = [input.memo, input.accountName].filter(Boolean);
    const memo = memoParts.join(" · ");
    const source = input.source ?? defaultSource;
    const hintedSubscription = Boolean(input.isSubscription) || input.category === "구독";
    const classified = isCategory(input.category)
      ? { category: input.category, reason: "연결 금융 데이터의 카테고리를 반영했습니다." }
      : classifyTransaction({
          merchant,
          memo,
          isSubscription: hintedSubscription,
        });
    const isSubscription = hintedSubscription || classified.category === "구독";

    return [
      {
        id: stableFeedId(source, externalId),
        date,
        merchant,
        amount,
        memo,
        paymentType: asPaymentType(input.paymentType),
        category: classified.category,
        isSubscription,
        classificationReason: classified.reason,
      },
    ];
  });

  return {
    skipped,
    transactions,
  };
}
