import { CATEGORIES } from "../constants";
import type { BudgetStatus, Category, CategoryPlan, CoachBasisItem, CoachMission, CoachReport } from "../types";
import type { AiProvider, ClassificationInput, ClassificationResult, CoachReportInput } from "./aiAdapter";

export interface OpenAiProxyProviderOptions {
  baseUrl?: string;
  classifyDailyLimit?: number;
  coachDailyLimit?: number;
  dailyRequestLimit?: number;
  disableClientRateLimit?: boolean;
  enableClientRateLimit?: boolean;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 45000;
const DEFAULT_DAILY_REQUEST_LIMIT = 8;
const DEFAULT_CLASSIFY_DAILY_LIMIT = 8;
const DEFAULT_COACH_DAILY_LIMIT = 5;
const CLASSIFY_PATH = "/api/ai/classify";
const COACH_PATH = "/api/ai/coach";
const AI_USAGE_KEY = "money-routine-ai-usage:v1";

function buildEndpoint(baseUrl: string | undefined, path: string) {
  const normalizedBaseUrl = baseUrl?.trim().replace(/\/$/, "") ?? "";
  return `${normalizedBaseUrl}${path}`;
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getEnvNumber(name: string, fallback: number) {
  const value = (import.meta.env as Record<string, string | undefined>)[name];
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function getEnvBoolean(name: string, fallback = false) {
  const value = (import.meta.env as Record<string, string | undefined>)[name]?.trim().toLowerCase();
  if (value === "true" || value === "1" || value === "yes") {
    return true;
  }
  if (value === "false" || value === "0" || value === "no") {
    return false;
  }

  return fallback;
}

function readUsageRecord(): { classify: number; coach: number; date: string; total: number } {
  if (typeof window === "undefined") {
    return { classify: 0, coach: 0, date: getTodayKey(), total: 0 };
  }

  try {
    const parsed = JSON.parse(window.localStorage.getItem(AI_USAGE_KEY) ?? "{}");
    if (parsed?.date === getTodayKey()) {
      return {
        classify: Number(parsed.classify) || 0,
        coach: Number(parsed.coach) || 0,
        date: parsed.date,
        total: Number(parsed.total) || 0,
      };
    }
  } catch {
    // Ignore corrupt local usage data and start a fresh daily counter.
  }

  return { classify: 0, coach: 0, date: getTodayKey(), total: 0 };
}

function reserveClientAiRequest(kind: "classify" | "coach", options: OpenAiProxyProviderOptions) {
  if (options.disableClientRateLimit || typeof window === "undefined") {
    return;
  }

  const isRateLimitEnabled =
    options.enableClientRateLimit ?? getEnvBoolean("VITE_AI_CLIENT_RATE_LIMIT_ENABLED", false);
  if (!isRateLimitEnabled) {
    return;
  }

  const dailyLimit = options.dailyRequestLimit ?? getEnvNumber("VITE_AI_DAILY_REQUEST_LIMIT", DEFAULT_DAILY_REQUEST_LIMIT);
  const kindLimit =
    kind === "coach"
      ? options.coachDailyLimit ?? getEnvNumber("VITE_AI_COACH_DAILY_LIMIT", DEFAULT_COACH_DAILY_LIMIT)
      : options.classifyDailyLimit ?? getEnvNumber("VITE_AI_CLASSIFY_DAILY_LIMIT", DEFAULT_CLASSIFY_DAILY_LIMIT);
  const usage = readUsageRecord();

  if (usage.total >= dailyLimit || usage[kind] >= kindLimit) {
    throw new Error("오늘 AI 분석 호출 한도에 도달했습니다. 비용 보호를 위해 내일 다시 시도하세요.");
  }

  const next = {
    ...usage,
    [kind]: usage[kind] + 1,
    total: usage.total + 1,
  };
  window.localStorage.setItem(AI_USAGE_KEY, JSON.stringify(next));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function clipText(value: unknown, fallback: string, maxLength: number) {
  const normalized = ensureString(value, fallback).replace(/\s+/g, " ").trim();
  return normalized.length > maxLength ? `${normalized.slice(0, maxLength - 1)}…` : normalized;
}

function polishCompactSentence(value: unknown, fallback: string, maxLength: number) {
  const clipped = clipText(value, fallback, maxLength);
  const completed = clipped.endsWith("위해") ? `${clipped} 오늘 한 가지 행동을 정해보세요.` : clipped;

  return completed.length > maxLength ? `${completed.slice(0, maxLength - 1)}…` : completed;
}

function ensureNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function ensureBoolean(value: unknown, fallback = false) {
  return typeof value === "boolean" ? value : fallback;
}

function ensureStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function ensureClippedStringArray(value: unknown, maxItems: number, maxLength: number) {
  return ensureStringArray(value).slice(0, maxItems).map((item) => clipText(item, "", maxLength)).filter(Boolean);
}

function ensureCategory(value: unknown, fallback: Category = "기타"): Category {
  if (typeof value === "string" && CATEGORIES.includes(value as Category)) {
    return value as Category;
  }

  return fallback;
}

function safelyMapItems<T>(value: unknown, maxItems: number, mapper: (item: unknown, index: number) => T): T[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.slice(0, maxItems).reduce<T[]>((items, item, index) => {
    try {
      items.push(mapper(item, index));
    } catch {
      // Drop only the malformed card item instead of discarding the whole AI report.
    }

    return items;
  }, []);
}

function ensureCoachMission(value: unknown, index: number): CoachMission {
  if (!isRecord(value)) {
    throw new Error("OpenAI proxy returned an invalid mission.");
  }

  return {
    id: clipText(value.id, `openai-mission-${index}`, 40),
    title: polishCompactSentence(value.title, "소비 미션", 24),
    reason: polishCompactSentence(value.reason, "목표 조정", 36),
    expectedSaving: Math.max(0, Math.round(ensureNumber(value.expectedSaving))),
    impactLabel: "예상 절감",
    action: polishCompactSentence(value.action, "오늘 실행할 행동 선택", 40),
    completed: ensureBoolean(value.completed),
  };
}

function ensureCategoryPlan(value: unknown): CategoryPlan {
  if (!isRecord(value)) {
    throw new Error("OpenAI proxy returned an invalid category plan.");
  }

  const status = value.status === "stable" || value.status === "watch" || value.status === "over" ? value.status : "watch";

  return {
    category: ensureCategory(value.category),
    status,
    currentAmount: Math.max(0, Math.round(ensureNumber(value.currentAmount))),
    plannedAmount: Math.max(0, Math.round(ensureNumber(value.plannedAmount))),
    expectedSaving: Math.max(0, Math.round(ensureNumber(value.expectedSaving))),
    reason: polishCompactSentence(value.reason, "분야 비중 기준", 34),
    action: polishCompactSentence(value.action, "결제 1건만 점검", 38),
  };
}

function ensureBasisTone(value: unknown): BudgetStatus | "primary" {
  return value === "primary" || value === "stable" || value === "watch" || value === "over" ? value : "primary";
}

function ensureCoachBasisItem(value: unknown, index: number): CoachBasisItem {
  if (!isRecord(value)) {
    throw new Error("OpenAI proxy returned an invalid basis item.");
  }

  return {
    id: clipText(value.id, `openai-basis-${index}`, 40),
    title: polishCompactSentence(value.title, "분석 기준", 18),
    value: clipText(value.value, "계산됨", 20),
    detail: polishCompactSentence(value.detail, "현재 거래 기준", 38),
    tone: ensureBasisTone(value.tone),
  };
}

function ensureCoachReport(value: unknown): CoachReport {
  if (!isRecord(value)) {
    throw new Error("OpenAI proxy returned an invalid coach report.");
  }

  const status = value.status === "stable" || value.status === "watch" || value.status === "over" ? value.status : "watch";
  const savingPossibility =
    value.savingPossibility === "높음" || value.savingPossibility === "보통" || value.savingPossibility === "낮음"
      ? value.savingPossibility
      : "보통";

  return {
    headline: polishCompactSentence(value.headline, "오늘 소비 흐름 점검", 44),
    status,
    dailyBudget: Math.max(0, Math.round(ensureNumber(value.dailyBudget))),
    savingPossibility,
    todayAction: polishCompactSentence(value.todayAction, "오늘 할 일 1개 선택", 52),
    insights: ensureStringArray(value.insights).slice(0, 4).map((item) => polishCompactSentence(item, "", 58)).filter(Boolean),
    categoryPlans: safelyMapItems(value.categoryPlans, 4, ensureCategoryPlan),
    missions: safelyMapItems(value.missions, 4, ensureCoachMission),
    subscriptionAdvice: ensureClippedStringArray(value.subscriptionAdvice, 3, 58),
    basis: clipText(value.basis, "월 거래와 목표 기준", 64),
    basisItems: safelyMapItems(value.basisItems, 5, ensureCoachBasisItem),
  };
}

async function postJson<T>(path: string, payload: unknown, options: OpenAiProxyProviderOptions): Promise<T> {
  reserveClientAiRequest(path === COACH_PATH ? "coach" : "classify", options);

  const fetcher = options.fetcher ?? fetch;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  try {
    const response = await fetcher(buildEndpoint(options.baseUrl, path), {
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`OpenAI proxy request failed with ${response.status}.`);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeoutId);
  }
}

export function createOpenAiProxyProvider(options: OpenAiProxyProviderOptions = {}): AiProvider {
  return {
    async classifyTransaction(input: ClassificationInput): Promise<ClassificationResult> {
      const response = await postJson<unknown>(CLASSIFY_PATH, input, options);

      if (!isRecord(response)) {
        throw new Error("OpenAI proxy returned an invalid classification.");
      }

      return {
        category: ensureCategory(response.category),
        reason: clipText(response.reason, "OpenAI가 거래 사용처와 메모를 기준으로 분류했습니다.", 72),
      };
    },
    async createCoachReport(input: CoachReportInput): Promise<CoachReport> {
      return ensureCoachReport(await postJson<unknown>(COACH_PATH, input, options));
    },
  };
}
