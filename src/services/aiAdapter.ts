import { getCoachReport } from "./analytics";
import { parseDate } from "./date";
import { classifyTransaction as classifyWithRules } from "./classifier";
import type { Category, CoachReport, Goal, Transaction } from "../types";

export interface ClassificationInput {
  merchant: string;
  memo: string;
  isSubscription: boolean;
}

export interface ClassificationResult {
  category: Category;
  reason: string;
}

export interface CoachReportInput {
  transactions: Transaction[];
  previousMonthTransactions?: Transaction[];
  goal: Goal;
  monthId: string;
  currentDate?: string;
  baseReport?: CoachReport;
}

export type MaybePromise<T> = T | Promise<T>;

export type AiProviderMode = "local" | "external";

export type AiResponseStatus = "ready" | "loading" | "fallback" | "error";

export interface AiProviderMetadata {
  id: string;
  label: string;
  mode: AiProviderMode;
}

export interface AiResponse<T> {
  data: T;
  error?: string;
  generatedAt: string;
  provider: AiProviderMetadata;
  status: AiResponseStatus;
}

export interface AiProvider {
  classifyTransaction(input: ClassificationInput): MaybePromise<ClassificationResult>;
  createCoachReport(input: CoachReportInput): MaybePromise<CoachReport>;
}

export const localAiProviderMetadata: AiProviderMetadata = {
  id: "local-rules",
  label: "로컬 규칙 기반 분석",
  mode: "local",
};

function classifyTransactionLocal(input: ClassificationInput): ClassificationResult {
  return classifyWithRules(input.merchant, input.memo, input.isSubscription);
}

function createCoachReportLocal(input: CoachReportInput): CoachReport {
  return getCoachReport(
    input.transactions,
    input.goal,
    input.monthId,
    input.previousMonthTransactions ?? [],
    input.currentDate ? parseDate(input.currentDate) : new Date(),
  );
}

export const localAiProvider: AiProvider = {
  classifyTransaction(input) {
    return classifyTransactionLocal(input);
  },
  createCoachReport(input) {
    return createCoachReportLocal(input);
  },
};

let activeProvider: AiProvider = localAiProvider;
let activeProviderMetadata: AiProviderMetadata = localAiProviderMetadata;

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI provider 응답을 처리하지 못했습니다.";
}

function isPromiseLike<T>(value: MaybePromise<T>): value is Promise<T> {
  return Boolean(value) && typeof (value as Promise<T>).then === "function";
}

export function createAiResponse<T>(data: T, provider: AiProviderMetadata, status: AiResponseStatus, error?: string): AiResponse<T> {
  return {
    data,
    error,
    generatedAt: new Date().toISOString(),
    provider,
    status,
  };
}

export function setAiProvider(provider: AiProvider, metadata?: AiProviderMetadata) {
  activeProvider = provider;
  activeProviderMetadata = metadata ?? (provider === localAiProvider ? localAiProviderMetadata : {
    id: "external-ai",
    label: "외부 AI 분석",
    mode: "external",
  });
}

export function getAiProvider() {
  return activeProvider;
}

export function getAiProviderMetadata() {
  return activeProviderMetadata;
}

export function classifyTransactionResponse(input: ClassificationInput): AiResponse<ClassificationResult> {
  try {
    const result = activeProvider.classifyTransaction(input);
    if (isPromiseLike(result)) {
      throw new Error("Async AI provider requires classifyTransactionResponseAsync.");
    }

    return createAiResponse<ClassificationResult>(result, activeProviderMetadata, "ready");
  } catch (error) {
    return createAiResponse(
      classifyTransactionLocal(input),
      localAiProviderMetadata,
      "fallback",
      toErrorMessage(error),
    );
  }
}

export function createCoachReportResponse(input: CoachReportInput): AiResponse<CoachReport> {
  try {
    const result = activeProvider.createCoachReport(input);
    if (isPromiseLike(result)) {
      throw new Error("Async AI provider requires createCoachReportResponseAsync.");
    }

    return createAiResponse<CoachReport>(result, activeProviderMetadata, "ready");
  } catch (error) {
    return createAiResponse(
      createCoachReportLocal(input),
      localAiProviderMetadata,
      "fallback",
      toErrorMessage(error),
    );
  }
}

export async function classifyTransactionResponseAsync(input: ClassificationInput): Promise<AiResponse<ClassificationResult>> {
  try {
    return createAiResponse<ClassificationResult>(await activeProvider.classifyTransaction(input), activeProviderMetadata, "ready");
  } catch (error) {
    return createAiResponse(
      classifyTransactionLocal(input),
      localAiProviderMetadata,
      "fallback",
      toErrorMessage(error),
    );
  }
}

export async function createCoachReportResponseAsync(input: CoachReportInput): Promise<AiResponse<CoachReport>> {
  try {
    return createAiResponse<CoachReport>(await activeProvider.createCoachReport(input), activeProviderMetadata, "ready");
  } catch (error) {
    return createAiResponse(
      createCoachReportLocal(input),
      localAiProviderMetadata,
      "fallback",
      toErrorMessage(error),
    );
  }
}

export function createCoachReportLoadingResponse(input: CoachReportInput, previousReport?: CoachReport): AiResponse<CoachReport> {
  return createAiResponse<CoachReport>(
    previousReport ?? createCoachReportLocal(input),
    activeProviderMetadata,
    "loading",
  );
}

export function createCoachReportPreviewResponse(input: CoachReportInput): AiResponse<CoachReport> {
  return createAiResponse<CoachReport>(
    createCoachReportLocal(input),
    localAiProviderMetadata,
    "ready",
  );
}

export function classifyTransaction(input: ClassificationInput) {
  // CSV and linked financial feeds can contain many rows. Keep their synchronous
  // classification local so importing data never starts one external request per row.
  return classifyTransactionLocal(input);
}

export function createCoachReport(input: CoachReportInput) {
  return createCoachReportResponse(input).data;
}
