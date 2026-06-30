import { describe, expect, it } from "vitest";
import { DEFAULT_GOAL, DEMO_MONTH } from "../constants";
import { loadSampleTransactions } from "../data";
import { createOpenAiProxyProvider } from "./openAiProxyProvider";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    headers: { "Content-Type": "application/json" },
    status,
  });
}

describe("OpenAI proxy provider", () => {
  const validCoachReport = {
    headline: "정기 결제와 카페 지출을 점검해요",
    status: "watch" as const,
    dailyBudget: 12345.6,
    savingPossibility: "보통" as const,
    todayAction: "카페 지출을 한 번 줄여보세요.",
    insights: ["카페 지출 비중이 높습니다."],
    categoryPlans: [
      {
        category: "카페/간식",
        status: "watch",
        currentAmount: 54000,
        plannedAmount: 47000,
        expectedSaving: 7000,
        reason: "카페 지출 비중이 높습니다.",
        action: "커피 결제를 하루 한 번 줄이세요.",
      },
    ],
    missions: [
      {
        id: "mission-openai",
        title: "카페 1회 줄이기",
        reason: "목표 저축액에 가까워집니다.",
        expectedSaving: 5000,
        action: "오늘은 텀블러를 사용합니다.",
        completed: false,
      },
    ],
    subscriptionAdvice: ["정기 결제 후보 1건을 점검하세요."],
    basis: "월 목표와 현재 거래를 기준으로 분석했습니다.",
  };

  it("posts classification requests to the configured proxy", async () => {
    const calls: Array<{ body: unknown; url: string }> = [];
    const provider = createOpenAiProxyProvider({
      baseUrl: "https://ai.example.com/",
      fetcher: async (url, init) => {
        calls.push({
          body: JSON.parse(String(init?.body)),
          url: String(url),
        });

        return jsonResponse({
          category: "카페/간식",
          reason: "커피 메모가 있어 카페 소비로 분류했습니다.",
        });
      },
    });

    const result = await provider.classifyTransaction({
      merchant: "테스트 카페",
      memo: "커피",
      isSubscription: false,
    });

    expect(calls[0]).toEqual({
      body: {
        merchant: "테스트 카페",
        memo: "커피",
        isSubscription: false,
      },
      url: "https://ai.example.com/api/ai/classify",
    });
    expect(result.category).toBe("카페/간식");
  });

  it("posts coach report requests and validates the response shape", async () => {
    const provider = createOpenAiProxyProvider({
      fetcher: async (url, init) => {
        expect(String(url)).toBe("/api/ai/coach");
        expect(JSON.parse(String(init?.body)).monthId).toBe(DEMO_MONTH.id);

        return jsonResponse(validCoachReport);
      },
    });

    const result = await provider.createCoachReport({
      transactions: loadSampleTransactions(),
      goal: DEFAULT_GOAL,
      monthId: DEMO_MONTH.id,
    });

    expect(result.status).toBe("watch");
    expect(result.dailyBudget).toBe(12346);
    expect(result.categoryPlans[0].expectedSaving).toBe(7000);
    expect(result.missions[0].title).toBe("카페 1회 줄이기");
  });

  it("polishes incomplete compact coach sentences", async () => {
    const provider = createOpenAiProxyProvider({
      fetcher: async () =>
        jsonResponse({
          ...validCoachReport,
          todayAction: "카페/간식 지출 절감 위해",
          categoryPlans: [
            {
              ...validCoachReport.categoryPlans[0],
              reason: "카페 지출 조정 위해",
              action: "커피 결제 횟수 줄이기 위해",
            },
          ],
        }),
    });

    const result = await provider.createCoachReport({
      transactions: loadSampleTransactions(),
      goal: DEFAULT_GOAL,
      monthId: DEMO_MONTH.id,
    });

    expect(result.todayAction).toContain("정해보세요");
    expect(result.categoryPlans[0].reason).toContain("정해보세요");
    expect(result.categoryPlans[0].action).toContain("정해보세요");
  });

  it("keeps the coach report when optional card arrays contain malformed items", async () => {
    const provider = createOpenAiProxyProvider({
      fetcher: async () =>
        jsonResponse({
          ...validCoachReport,
          categoryPlans: [
            {
              ...validCoachReport.categoryPlans[0],
              category: "없는분야",
            },
            null,
          ],
          missions: [null, validCoachReport.missions[0]],
          basisItems: [null],
        }),
    });

    const result = await provider.createCoachReport({
      transactions: loadSampleTransactions(),
      goal: DEFAULT_GOAL,
      monthId: DEMO_MONTH.id,
    });

    expect(result.headline).toBe(validCoachReport.headline);
    expect(result.categoryPlans[0].category).toBe("기타");
    expect(result.missions).toHaveLength(1);
    expect(result.basisItems).toEqual([]);
  });

  it("does not block repeated client coach calls by default", async () => {
    const previousWindow = globalThis.window;
    const storage = new Map<string, string>();
    const calls: string[] = [];

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });

    try {
      const provider = createOpenAiProxyProvider({
        coachDailyLimit: 1,
        dailyRequestLimit: 1,
        fetcher: async (url) => {
          calls.push(String(url));
          return jsonResponse(validCoachReport);
        },
      });
      const input = {
        transactions: loadSampleTransactions(),
        goal: DEFAULT_GOAL,
        monthId: DEMO_MONTH.id,
      };

      await expect(provider.createCoachReport(input)).resolves.toMatchObject({ status: "watch" });
      await expect(provider.createCoachReport(input)).resolves.toMatchObject({ status: "watch" });
      expect(calls).toHaveLength(2);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  });

  it("blocks repeated client coach calls only when the daily limit is explicitly enabled", async () => {
    const previousWindow = globalThis.window;
    const storage = new Map<string, string>();
    const calls: string[] = [];

    Object.defineProperty(globalThis, "window", {
      configurable: true,
      value: {
        localStorage: {
          getItem: (key: string) => storage.get(key) ?? null,
          setItem: (key: string, value: string) => storage.set(key, value),
        },
      },
    });

    try {
      const provider = createOpenAiProxyProvider({
        coachDailyLimit: 1,
        dailyRequestLimit: 1,
        enableClientRateLimit: true,
        fetcher: async (url) => {
          calls.push(String(url));
          return jsonResponse(validCoachReport);
        },
      });
      const input = {
        transactions: loadSampleTransactions(),
        goal: DEFAULT_GOAL,
        monthId: DEMO_MONTH.id,
      };

      await expect(provider.createCoachReport(input)).resolves.toMatchObject({ status: "watch" });
      await expect(provider.createCoachReport(input)).rejects.toThrow("오늘 AI 분석 호출 한도");
      expect(calls).toHaveLength(1);
    } finally {
      Object.defineProperty(globalThis, "window", {
        configurable: true,
        value: previousWindow,
      });
    }
  });

  it("clips long OpenAI text before it reaches compact coach cards", async () => {
    const provider = createOpenAiProxyProvider({
      fetcher: async () =>
        jsonResponse({
          headline: "아주 긴 제목".repeat(20),
          status: "watch",
          dailyBudget: 12000,
          savingPossibility: "보통",
          todayAction: "너무 긴 실행 문장".repeat(20),
          insights: ["긴 인사이트".repeat(20)],
          categoryPlans: [
            {
              category: "식비",
              status: "watch",
              currentAmount: 120000,
              plannedAmount: 108000,
              expectedSaving: 12000,
              reason: "너무 긴 이유".repeat(20),
              action: "너무 긴 행동".repeat(20),
            },
          ],
          missions: [],
          subscriptionAdvice: [],
          basis: "긴 기준".repeat(30),
        }),
    });

    const result = await provider.createCoachReport({
      transactions: loadSampleTransactions(),
      goal: DEFAULT_GOAL,
      monthId: DEMO_MONTH.id,
    });

    expect(result.headline.length).toBeLessThanOrEqual(64);
    expect(result.todayAction.length).toBeLessThanOrEqual(78);
    expect(result.categoryPlans[0].reason.length).toBeLessThanOrEqual(48);
    expect(result.categoryPlans[0].action.length).toBeLessThanOrEqual(50);
    expect(result.basis.length).toBeLessThanOrEqual(96);
  });

  it("throws when the proxy response is not successful", async () => {
    const provider = createOpenAiProxyProvider({
      fetcher: async () => jsonResponse({ error: "missing key" }, 500),
    });

    await expect(
      provider.classifyTransaction({
        merchant: "테스트",
        memo: "",
        isSubscription: false,
      }),
    ).rejects.toThrow("OpenAI proxy request failed");
  });
});
