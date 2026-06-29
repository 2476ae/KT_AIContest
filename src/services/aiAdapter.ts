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

export interface AiProvider {
  classifyTransaction(input: ClassificationInput): ClassificationResult;
  createCoachReport(input: CoachReportInput): CoachReport;
}

export const localAiProvider: AiProvider = {
  classifyTransaction(input) {
    return classifyWithRules(input.merchant, input.memo, input.isSubscription);
  },
  createCoachReport(input) {
    return getCoachReport(input.transactions, input.goal, input.monthId);
  },
};

let activeProvider: AiProvider = localAiProvider;

export function setAiProvider(provider: AiProvider) {
  activeProvider = provider;
}

export function getAiProvider() {
  return activeProvider;
}

export function classifyTransaction(input: ClassificationInput) {
  return activeProvider.classifyTransaction(input);
}

export function createCoachReport(input: CoachReportInput) {
  return activeProvider.createCoachReport(input);
}
