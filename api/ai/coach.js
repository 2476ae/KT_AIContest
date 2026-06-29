import {
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
  "missions는 바로 실행 가능한 행동으로 작성하고 expectedSaving은 원 단위 숫자로 쓴다.",
  "basis에는 어떤 입력값을 근거로 판단했는지 짧게 설명한다.",
].join("\n");

export default async function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  try {
    assertPost(req);
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
