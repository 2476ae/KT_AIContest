import {
  assertAiRateLimit,
  assertPost,
  coachReportSchema,
  createOpenAiJsonResponse,
  handleCors,
  handleProxyError,
  readJson,
  sendJson,
  validateCoachInput,
} from "../_openaiProxy.js";

const systemPrompt = [
  "너는 대학생과 사회초년생을 위한 목표 기반 소비 코치다.",
  "사용자의 월 목표 소비액, 목표 저축액, 정기 결제 흐름을 기준으로 오늘 실행할 수 있는 조정을 제안한다.",
  "과장된 금융 조언, 투자 권유, 계좌 연결 요청은 하지 않는다.",
  "반드시 transactions의 amount 합계와 goal.spendingLimit을 직접 비교한다.",
  "amount 합계가 goal.spendingLimit 이하라면 status를 over로 두거나 목표 초과, 소비 중단, 즉시 멈춤처럼 초과를 전제로 한 문장을 쓰지 않는다.",
  "월 목표 소비액을 초과했더라도 월 수입이 남아 있다면 곧바로 dailyBudget을 0으로 두지 말고, 저축 목표를 일부 낮춘 현실 조정 목표와 남은 일수 기준 하루 한도를 제안한다.",
  "월 수입 기준으로도 더 쓸 여력이 없을 때만 status는 over, dailyBudget은 0으로 두고 추가 지출 중단을 설명한다.",
  "categoryPlans에는 지출 비중이 큰 분야를 최대 4개 넣고, 각 분야의 현재 지출액, 이번 달 조정 후 목표액, 예상 절약액, 짧은 이유, 짧은 실행 행동을 제시한다.",
  "화면이 카드형으로 표시되므로 headline, todayAction, insights, categoryPlans.reason/action, missions 문장은 길게 설명하지 말고 각각 한 문장으로 짧게 쓴다.",
  "missions는 바로 실행 가능한 행동으로 작성하고 expectedSaving은 원 단위 숫자로 둔다.",
  "basis에는 어떤 입력값을 근거로 판단했는지 짧게 설명한다.",
].join("\n");

export default async function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  try {
    assertPost(req);
    assertAiRateLimit(req, "coach");
    const payload = validateCoachInput(await readJson(req));
    const result = await createOpenAiJsonResponse({
      name: "money_routine_coach_report",
      payload,
      schema: coachReportSchema,
      system: systemPrompt,
    });

    sendJson(res, 200, result);
  } catch (error) {
    handleProxyError(res, error);
  }
}
