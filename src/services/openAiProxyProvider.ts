import { CATEGORIES } from "../constants";
import type { Category, CoachMission, CoachReport } from "../types";
import type { AiProvider, ClassificationInput, ClassificationResult, CoachReportInput } from "./aiAdapter";

export interface OpenAiProxyProviderOptions {
  baseUrl?: string;
  fetcher?: typeof fetch;
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15000;
const CLASSIFY_PATH = "/api/ai/classify";
const COACH_PATH = "/api/ai/coach";

function buildEndpoint(baseUrl: string | undefined, path: string) {
  const normalizedBaseUrl = baseUrl?.trim().replace(/\/$/, "") ?? "";
  return `${normalizedBaseUrl}${path}`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function ensureString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
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

function ensureCategory(value: unknown): Category {
  if (typeof value === "string" && CATEGORIES.includes(value as Category)) {
    return value as Category;
  }

  throw new Error("OpenAI proxy returned an unsupported category.");
}

function ensureCoachMission(value: unknown, index: number): CoachMission {
  if (!isRecord(value)) {
    throw new Error("OpenAI proxy returned an invalid mission.");
  }

  return {
    id: ensureString(value.id, `openai-mission-${index}`),
    title: ensureString(value.title, "소비 미션"),
    reason: ensureString(value.reason, "목표 달성을 위한 조정입니다."),
    expectedSaving: Math.max(0, Math.round(ensureNumber(value.expectedSaving))),
    action: ensureString(value.action, "오늘 실행할 수 있는 작은 조정을 선택하세요."),
    completed: ensureBoolean(value.completed),
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
    headline: ensureString(value.headline, "오늘 소비 흐름을 점검해요"),
    status,
    dailyBudget: Math.max(0, Math.round(ensureNumber(value.dailyBudget))),
    savingPossibility,
    todayAction: ensureString(value.todayAction, "오늘 줄일 수 있는 항목을 하나 정해보세요."),
    insights: ensureStringArray(value.insights).slice(0, 4),
    missions: (Array.isArray(value.missions) ? value.missions : []).slice(0, 4).map(ensureCoachMission),
    subscriptionAdvice: ensureStringArray(value.subscriptionAdvice).slice(0, 3),
    basis: ensureString(value.basis, "현재 월 거래, 목표 소비액, 목표 저축액을 기준으로 분석했습니다."),
  };
}

async function postJson<T>(path: string, payload: unknown, options: OpenAiProxyProviderOptions): Promise<T> {
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
        reason: ensureString(response.reason, "OpenAI가 거래 사용처와 메모를 기준으로 분류했습니다."),
      };
    },
    async createCoachReport(input: CoachReportInput): Promise<CoachReport> {
      return ensureCoachReport(await postJson<unknown>(COACH_PATH, input, options));
    },
  };
}
