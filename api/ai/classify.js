import {
  assertAiRateLimit,
  assertPost,
  classificationSchema,
  createOpenAiJsonResponse,
  handleCors,
  handleProxyError,
  readJson,
  sendJson,
  validateClassificationInput,
} from "../_openaiProxy.js";

const systemPrompt = [
  "너는 한국어 소비 내역을 분류하는 금융 코칭 보조 AI다.",
  "반드시 허용된 카테고리 중 하나만 선택한다.",
  "정기 결제, OTT, 멤버십, 클라우드, 앱스토어형 사용처는 구독으로 분류한다.",
  "reason은 사용자가 이해하기 쉬운 한국어 한 문장으로 작성한다.",
].join("\n");

export default async function handler(req, res) {
  if (handleCors(req, res)) {
    return;
  }

  try {
    assertPost(req);
    assertAiRateLimit(req, "classify");
    const payload = validateClassificationInput(await readJson(req));
    const result = await createOpenAiJsonResponse({
      name: "money_routine_classification",
      payload,
      schema: classificationSchema,
      system: systemPrompt,
    });

    sendJson(res, 200, result);
  } catch (error) {
    handleProxyError(res, error);
  }
}
