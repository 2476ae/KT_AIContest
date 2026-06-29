import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import { loadSampleTransactions } from "../data";
import { createCoachReport, getAiProvider, localAiProvider, setAiProvider } from "./aiAdapter";

describe("ai adapter", () => {
  it("uses replaceable provider contract for coach reports", () => {
    const previous = getAiProvider();

    setAiProvider({
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
    });

    const report = createCoachReport({
      transactions: loadSampleTransactions(),
      goal: DEFAULT_GOAL,
      monthId: DEMO_MONTH.id,
    });

    expect(report.headline).toBe("외부 AI 결과");
    setAiProvider(previous);
  });
});
