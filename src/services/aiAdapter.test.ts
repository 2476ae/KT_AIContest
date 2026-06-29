import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import { loadSampleTransactions } from "../data";
import {
  classifyTransactionResponse,
  createCoachReport,
  createCoachReportResponse,
  getAiProvider,
  getAiProviderMetadata,
  localAiProvider,
  setAiProvider,
} from "./aiAdapter";

describe("ai adapter", () => {
  it("uses replaceable provider contract for coach reports", () => {
    const previous = getAiProvider();

    try {
      setAiProvider(
        {
          classifyTransaction: localAiProvider.classifyTransaction,
          createCoachReport: () => ({
            headline: "외부 AI 결과",
            status: "stable",
            dailyBudget: 1000,
            savingPossibility: "높음",
            todayAction: "테스트 액션",
            insights: ["테스트"],
            missions: [],
            subscriptionAdvice: [],
            basis: "mock",
          }),
        },
        {
          id: "test-provider",
          label: "테스트 AI",
          mode: "external",
        },
      );

      const report = createCoachReport({
        transactions: loadSampleTransactions(),
        goal: DEFAULT_GOAL,
        monthId: DEMO_MONTH.id,
      });

      expect(report.headline).toBe("외부 AI 결과");
      expect(getAiProviderMetadata().label).toBe("테스트 AI");
    } finally {
      setAiProvider(previous);
    }
  });

  it("returns fallback responses when provider throws", () => {
    const previous = getAiProvider();

    try {
      setAiProvider(
        {
          classifyTransaction: () => {
            throw new Error("classification down");
          },
          createCoachReport: () => {
            throw new Error("coach down");
          },
        },
        {
          id: "broken-provider",
          label: "고장난 AI",
          mode: "external",
        },
      );

      const classification = classifyTransactionResponse({
        merchant: "넷플릭스",
        memo: "OTT",
        isSubscription: true,
      });
      const report = createCoachReportResponse({
        transactions: loadSampleTransactions(),
        goal: DEFAULT_GOAL,
        monthId: DEMO_MONTH.id,
      });

      expect(classification.status).toBe("fallback");
      expect(classification.data.category).toBe("구독");
      expect(report.status).toBe("fallback");
      expect(report.data.headline).toContain("하루");
    } finally {
      setAiProvider(previous);
    }
  });
});
