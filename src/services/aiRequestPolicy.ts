import type { CoachReportInput } from "./aiAdapter";
import type { TabId } from "../types";

export const COACH_AI_DEBOUNCE_MS = 250;

export function shouldRequestCoachReportAi(activeTab: TabId, isUserRequested: boolean) {
  return activeTab === "coach" && isUserRequested;
}

export function createCoachReportCacheKey(input: CoachReportInput, providerId: string) {
  return JSON.stringify({
    providerId,
    monthId: input.monthId,
    goal: input.goal,
    transactions: input.transactions.map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      merchant: transaction.merchant,
      amount: transaction.amount,
      category: transaction.category,
      isSubscription: transaction.isSubscription,
    })),
  });
}
