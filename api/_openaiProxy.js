const CATEGORIES = ["식비", "카페/간식", "교통", "쇼핑", "여가", "구독", "교육", "의료", "생활", "기타"];
const BUDGET_STATUSES = ["stable", "watch", "over"];
const SAVING_POSSIBILITIES = ["높음", "보통", "낮음"];
const DEFAULT_ALLOWED_ORIGINS = ["https://2476ae.github.io", "http://localhost:5173", "http://127.0.0.1:5173"];

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function handleCors(req, res) {
  const origin = req.headers.origin;
  const allowedOrigins = (process.env.AI_ALLOWED_ORIGINS || DEFAULT_ALLOWED_ORIGINS.join(","))
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const isAllowed = !origin || allowedOrigins.includes(origin);

  if (origin && isAllowed) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = isAllowed ? 204 : 403;
    res.end();
    return true;
  }

  if (!isAllowed) {
    sendJson(res, 403, { error: "Origin is not allowed." });
    return true;
  }

  return false;
}

export function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

export async function readJson(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    return JSON.parse(req.body);
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const body = Buffer.concat(chunks).toString("utf8");
  return body ? JSON.parse(body) : {};
}

export function assertPost(req) {
  if (req.method !== "POST") {
    throw new HttpError(405, "Only POST requests are supported.");
  }
}

export function validateClassificationInput(input) {
  if (!input || typeof input !== "object") {
    throw new HttpError(400, "Invalid classification input.");
  }

  return {
    merchant: String(input.merchant || "").trim().slice(0, 80),
    memo: String(input.memo || "").trim().slice(0, 120),
    isSubscription: Boolean(input.isSubscription),
  };
}

export function validateCoachInput(input) {
  if (!input || typeof input !== "object") {
    throw new HttpError(400, "Invalid coach input.");
  }

  return {
    goal: input.goal,
    monthId: String(input.monthId || "").slice(0, 20),
    transactions: Array.isArray(input.transactions)
      ? input.transactions.slice(0, 80).map((transaction) => ({
          date: String(transaction.date || "").slice(0, 10),
          merchant: String(transaction.merchant || "").slice(0, 60),
          amount: Number(transaction.amount) || 0,
          category: CATEGORIES.includes(transaction.category) ? transaction.category : "기타",
          isSubscription: Boolean(transaction.isSubscription),
        }))
      : [],
  };
}

export const classificationSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    category: { type: "string", enum: CATEGORIES },
    reason: { type: "string" },
  },
  required: ["category", "reason"],
};

export const coachReportSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    headline: { type: "string" },
    status: { type: "string", enum: BUDGET_STATUSES },
    dailyBudget: { type: "number" },
    savingPossibility: { type: "string", enum: SAVING_POSSIBILITIES },
    todayAction: { type: "string" },
    insights: {
      type: "array",
      items: { type: "string" },
      maxItems: 4,
    },
    missions: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          reason: { type: "string" },
          expectedSaving: { type: "number" },
          action: { type: "string" },
          completed: { type: "boolean" },
        },
        required: ["id", "title", "reason", "expectedSaving", "action", "completed"],
      },
    },
    subscriptionAdvice: {
      type: "array",
      items: { type: "string" },
      maxItems: 3,
    },
    basis: { type: "string" },
  },
  required: [
    "headline",
    "status",
    "dailyBudget",
    "savingPossibility",
    "todayAction",
    "insights",
    "missions",
    "subscriptionAdvice",
    "basis",
  ],
};

function extractOutputText(responseJson) {
  if (typeof responseJson.output_text === "string") {
    return responseJson.output_text;
  }

  for (const output of responseJson.output || []) {
    for (const content of output.content || []) {
      if (content.type === "output_text" && typeof content.text === "string") {
        return content.text;
      }
    }
  }

  throw new HttpError(502, "OpenAI response did not include text output.");
}

export async function createOpenAiJsonResponse({ name, schema, system, payload }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new HttpError(500, "OPENAI_API_KEY is not configured.");
  }

  const openAiResponse = await fetch("https://api.openai.com/v1/responses", {
    body: JSON.stringify({
      input: [
        {
          role: "system",
          content: system,
        },
        {
          role: "user",
          content: JSON.stringify(payload),
        },
      ],
      model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
      text: {
        format: {
          type: "json_schema",
          name,
          schema,
          strict: true,
        },
      },
    }),
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    method: "POST",
  });

  if (!openAiResponse.ok) {
    throw new HttpError(502, `OpenAI request failed with ${openAiResponse.status}.`);
  }

  return JSON.parse(extractOutputText(await openAiResponse.json()));
}

export function handleProxyError(res, error) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected AI proxy error.";
  sendJson(res, status, { error: message });
}
