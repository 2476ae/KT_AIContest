import { CATEGORIES } from "../constants";
import type { Category, PaymentType, Transaction } from "../types";
import { classifyTransaction } from "./aiAdapter";
import { getLinkedCategoryCopy } from "./transactionCopy";

export type FinancialFeedDirection = "credit" | "debit";

export interface FinancialFeedTransactionInput {
  externalId: string;
  postedAt: string;
  merchant: string;
  amount: number | string;
  accountName?: string;
  category?: Category | string;
  direction?: FinancialFeedDirection | string;
  isSubscription?: boolean;
  memo?: string;
  paymentType?: PaymentType | string;
  source?: string;
}

export interface FinancialFeedNormalizeResult {
  skipped: Array<{ externalId?: string; reason: string }>;
  transactions: Transaction[];
}

export const MAX_FINANCIAL_FEED_BATCH_SIZE = 200;

const MAX_FEED_AMOUNT = 50_000_000;
const MAX_SOURCE_LENGTH = 40;
const MAX_EXTERNAL_ID_LENGTH = 120;
const MAX_MERCHANT_LENGTH = 80;
const MAX_MEMO_LENGTH = 120;
const MAX_ACCOUNT_NAME_LENGTH = 60;
const FEED_ID_TOKEN_PATTERN = /[^a-z0-9\uac00-\ud7a3-]+/gi;

function isCategory(value: unknown): value is Category {
  return typeof value === "string" && CATEGORIES.includes(value as Category);
}

function asPaymentType(value: unknown): PaymentType {
  if (value === "cash" || value === "transfer" || value === "transport") {
    return value;
  }

  return "card";
}

function readText(value: unknown, maxLength: number) {
  return String(value ?? "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maxLength);
}

function normalizeDate(postedAt: unknown) {
  const trimmed = readText(postedAt, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    return trimmed;
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    return undefined;
  }

  return parsed.toISOString().slice(0, 10);
}

function hashToken(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) | 0;
  }

  return Math.abs(hash).toString(36);
}

function normalizeIdToken(value: string, fallback: string) {
  const token = value.toLowerCase().replace(FEED_ID_TOKEN_PATTERN, "-").replace(/^-|-$/g, "");

  if (!token) {
    return fallback;
  }

  if (token.length <= 72) {
    return token;
  }

  return `${token.slice(0, 72)}-${hashToken(value)}`;
}

function stableFeedId(source: string, externalId: string) {
  return `tx-feed-${normalizeIdToken(source, "feed")}-${normalizeIdToken(externalId, "unknown")}`;
}

function isExpense(input: FinancialFeedTransactionInput) {
  const direction = readText(input.direction, 12).toLowerCase();

  if (direction === "credit") {
    return false;
  }

  const amount = Number(input.amount);

  return direction === "debit" || amount < 0 || amount > 0;
}

export function normalizeFinancialFeedTransactions(
  inputs: FinancialFeedTransactionInput[],
  defaultSource = "financial-feed",
): FinancialFeedNormalizeResult {
  const skipped: FinancialFeedNormalizeResult["skipped"] = [];
  const normalizedById = new Map<string, Transaction>();
  const safeInputs = Array.isArray(inputs) ? inputs : [];
  const limitedInputs = safeInputs.slice(0, MAX_FINANCIAL_FEED_BATCH_SIZE);

  if (!Array.isArray(inputs)) {
    skipped.push({ reason: "거래 목록 형식이 올바르지 않습니다." });
  }

  if (safeInputs.length > MAX_FINANCIAL_FEED_BATCH_SIZE) {
    skipped.push({
      reason: `한 번에 최대 ${MAX_FINANCIAL_FEED_BATCH_SIZE}건까지만 반영하고 나머지는 다음 동기화에서 처리합니다.`,
    });
  }

  limitedInputs.forEach((input) => {
    if (!input || typeof input !== "object") {
      skipped.push({ reason: "거래 형식이 올바르지 않습니다." });
      return;
    }

    const externalId = readText(input.externalId, MAX_EXTERNAL_ID_LENGTH);
    const merchant = readText(input.merchant, MAX_MERCHANT_LENGTH);
    const date = normalizeDate(input.postedAt);
    const rawAmount = Number(input.amount);
    const source = readText(input.source ?? defaultSource, MAX_SOURCE_LENGTH) || "financial-feed";

    if (!externalId) {
      skipped.push({ reason: "외부 거래 ID가 없습니다." });
      return;
    }

    if (!date) {
      skipped.push({ externalId, reason: "거래 일시가 올바르지 않습니다." });
      return;
    }

    if (!merchant) {
      skipped.push({ externalId, reason: "사용처가 비어 있습니다." });
      return;
    }

    if (!Number.isFinite(rawAmount) || rawAmount === 0) {
      skipped.push({ externalId, reason: "금액이 올바르지 않습니다." });
      return;
    }

    if (Math.abs(rawAmount) > MAX_FEED_AMOUNT) {
      skipped.push({ externalId, reason: "단일 거래 금액이 너무 커서 확인 후 반영이 필요합니다." });
      return;
    }

    if (!isExpense(input)) {
      skipped.push({ externalId, reason: "입금 거래는 소비 내역에 반영하지 않습니다." });
      return;
    }

    const amount = Math.abs(Math.round(rawAmount));
    const memoParts = [readText(input.memo, MAX_MEMO_LENGTH), readText(input.accountName, MAX_ACCOUNT_NAME_LENGTH)].filter(Boolean);
    const memo = memoParts.join(" · ");
    const category = isCategory(input.category) ? input.category : undefined;
    const hintedSubscription = Boolean(input.isSubscription) || category === CATEGORIES[5];
    const classified = category
      ? { category, reason: getLinkedCategoryCopy(category) }
      : classifyTransaction({
          merchant,
          memo,
          isSubscription: hintedSubscription,
        });
    const isSubscription = hintedSubscription || classified.category === CATEGORIES[5];
    const id = stableFeedId(source, externalId);

    normalizedById.set(id, {
      id,
      date,
      merchant,
      amount,
      memo,
      paymentType: asPaymentType(input.paymentType),
      category: classified.category,
      isSubscription,
      classificationReason: classified.reason,
    });
  });

  return {
    skipped,
    transactions: [...normalizedById.values()].sort((a, b) => a.date.localeCompare(b.date)),
  };
}
