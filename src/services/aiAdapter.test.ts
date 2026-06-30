import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import { loadSampleTransactions } from "../data";
import {
  classifyTransactionResponse,
  classifyTransactionResponseAsync,
  createCoachReport,
  createCoachReportResponse,
  createCoachReportResponseAsync,
  getAiProvider,
  getAiProviderMetadata,
  localAiProvider,
  setAiProvider,
} from "./aiAdapter";

describe("ai adapter", () => {
  const sampleTransactions = loadSampleTransactions();
  const juneTransactions = sampleTransactions.filter((transaction) => transaction.date.startsWith("2026-06"));
  const mayTransactions = sampleTransactions.filter((transaction) => transaction.date.startsWith("2026-05"));

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
            categoryPlans: [],
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
        transactions: juneTransactions,
        previousMonthTransactions: mayTransactions,
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
        transactions: juneTransactions,
        previousMonthTransactions: mayTransactions,
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

  it("supports async provider responses for AI handoff", async () => {
    const previous = getAiProvider();

    try {
      setAiProvider(
        {
          classifyTransaction: async () => ({
            category: "카페/간식",
            reason: "async classification",
          }),
          createCoachReport: async () => ({
            headline: "비동기 AI 결과",
            status: "watch",
            dailyBudget: 12000,
            savingPossibility: "보통",
            todayAction: "비동기 액션",
            insights: ["비동기 인사이트"],
            categoryPlans: [],
            missions: [],
            subscriptionAdvice: [],
            basis: "async",
          }),
        },
        {
          id: "async-provider",
          label: "비동기 AI",
          mode: "external",
        },
      );

      const classification = await classifyTransactionResponseAsync({
        merchant: "테스트 카페",
        memo: "커피",
        isSubscription: false,
      });
      const report = await createCoachReportResponseAsync({
        transactions: juneTransactions,
        previousMonthTransactions: mayTransactions,
        goal: DEFAULT_GOAL,
        monthId: DEMO_MONTH.id,
      });

      expect(classification.status).toBe("ready");
      expect(classification.provider.label).toBe("비동기 AI");
      expect(classification.data.reason).toBe("async classification");
      expect(report.status).toBe("ready");
      expect(report.data.headline).toBe("비동기 AI 결과");
    } finally {
      setAiProvider(previous);
    }
  });
});
