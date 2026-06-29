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

        return jsonResponse({
          headline: "정기 결제와 카페 지출을 점검해요",
          status: "watch",
          dailyBudget: 12345.6,
          savingPossibility: "보통",
          todayAction: "카페 지출을 한 번 줄여보세요.",
          insights: ["카페 지출 비중이 높습니다."],
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
        });
      },
    });

    const result = await provider.createCoachReport({
      transactions: loadSampleTransactions(),
      goal: DEFAULT_GOAL,
      monthId: DEMO_MONTH.id,
    });

    expect(result.status).toBe("watch");
    expect(result.dailyBudget).toBe(12346);
    expect(result.missions[0].title).toBe("카페 1회 줄이기");
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
