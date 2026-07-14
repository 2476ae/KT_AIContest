import {
  assertAiRateLimit,
  assertPost,
  coachEnhancementSchema,
  createOpenAiJsonResponse,
  handleCors,
  handleProxyError,
  readJson,
  sendJson,
  validateCoachInput,
} from "../_openaiProxy.js";

const systemPrompt = [
  "모든 응답은 자연스러운 한국어 완결 문장으로 작성한다.",
  "너는 대학생과 사회초년생을 위한 목표 기반 소비 코치다.",
  "payload.baseReport는 앱이 검증한 최종 계산 결과다. 숫자, 상태, 판단 방향을 바꾸거나 반박하지 않는다.",
  "insights, categoryCopy, missionCopy, subscriptionAdvice의 문장만 더 친절하고 구체적으로 다듬는다.",
  "비중 상승과 금액 초과를 구분한다. 금액이 계획 안이면 '초과', '줄이기', '절감 필요'라고 쓰지 않는다.",
  "지난달보다 비중이 낮거나 같은 분야에는 현재 수준 유지나 기록을 제안한다.",
  "문장 조각이나 '~위해'로 끝나는 문장을 쓰지 않고, 각 문장은 35자 안팎으로 짧게 쓴다.",
  "과장된 금융 조언, 투자 권유, 계좌 연결 요청은 하지 않는다.",
].join("\n");

function mergeEnhancement(baseReport, enhancement) {
  const categoryCopy = new Map((enhancement.categoryCopy || []).map((item) => [item.category, item]));
  const missionCopy = new Map((enhancement.missionCopy || []).map((item) => [item.id, item]));

  return {
    ...baseReport,
    insights: enhancement.insights?.length ? enhancement.insights : baseReport.insights,
    categoryPlans: baseReport.categoryPlans.map((plan) => {
      const copy = categoryCopy.get(plan.category);
      return copy ? { ...plan, reason: copy.reason, action: copy.action } : plan;
    }),
    missions: baseReport.missions.map((mission) => {
      const copy = missionCopy.get(mission.id);
      return copy ? { ...mission, title: copy.title, reason: copy.reason, action: copy.action } : mission;
    }),
    subscriptionAdvice: enhancement.subscriptionAdvice?.length
      ? enhancement.subscriptionAdvice
      : baseReport.subscriptionAdvice,
  };
}

export default async function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  const startedAt = Date.now();

  try {
    assertPost(req);
    assertAiRateLimit(req, "coach");
    const payload = validateCoachInput(await readJson(req));
    const promptPayload = {
      currentDate: payload.currentDate,
      monthId: payload.monthId,
      baseReport: {
        headline: payload.baseReport.headline,
        status: payload.baseReport.status,
        todayAction: payload.baseReport.todayAction,
        insights: payload.baseReport.insights,
        categoryPlans: payload.baseReport.categoryPlans,
        missions: payload.baseReport.missions,
        subscriptionAdvice: payload.baseReport.subscriptionAdvice,
      },
    };
    const enhancement = await createOpenAiJsonResponse({
      name: "money_routine_coach_copy",
      payload: promptPayload,
      schema: coachEnhancementSchema,
      system: systemPrompt,
      maxOutputTokens: 420,
    });

    res.setHeader("Server-Timing", `openai;dur=${Date.now() - startedAt}`);
    res.setHeader("X-Money-Routine-AI", "openai-enhancement");
    sendJson(res, 200, mergeEnhancement(payload.baseReport, enhancement));
  } catch (error) {
    res.setHeader("Server-Timing", `openai;dur=${Date.now() - startedAt}`);
    res.setHeader("X-Money-Routine-AI", "fallback-required");
    handleProxyError(res, error);
  }
}
