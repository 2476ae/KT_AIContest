import { getCoachReport } from "./analytics";
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
  goal: Goal;
  monthId: string;
}

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
  classifyTransaction(input: ClassificationInput): ClassificationResult;
  createCoachReport(input: CoachReportInput): CoachReport;
}

export const localAiProviderMetadata: AiProviderMetadata = {
  id: "local-rules",
  label: "로컬 규칙 기반 분석",
  mode: "local",
};

export const localAiProvider: AiProvider = {
  classifyTransaction(input) {
    return classifyWithRules(input.merchant, input.memo, input.isSubscription);
  },
  createCoachReport(input) {
    return getCoachReport(input.transactions, input.goal, input.monthId);
  },
};

let activeProvider: AiProvider = localAiProvider;
let activeProviderMetadata: AiProviderMetadata = localAiProviderMetadata;

function toErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "AI provider 응답을 처리하지 못했습니다.";
}

function createResponse<T>(data: T, provider: AiProviderMetadata, status: AiResponseStatus, error?: string): AiResponse<T> {
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
    return createResponse(activeProvider.classifyTransaction(input), activeProviderMetadata, "ready");
  } catch (error) {
    return createResponse(
      localAiProvider.classifyTransaction(input),
      localAiProviderMetadata,
      "fallback",
      toErrorMessage(error),
    );
  }
}

export function createCoachReportResponse(input: CoachReportInput): AiResponse<CoachReport> {
  try {
    return createResponse(activeProvider.createCoachReport(input), activeProviderMetadata, "ready");
  } catch (error) {
    return createResponse(
      localAiProvider.createCoachReport(input),
      localAiProviderMetadata,
      "fallback",
      toErrorMessage(error),
    );
  }
}

export function classifyTransaction(input: ClassificationInput) {
  return classifyTransactionResponse(input).data;
}

export function createCoachReport(input: CoachReportInput) {
  return createCoachReportResponse(input).data;
}
