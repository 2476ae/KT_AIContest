import { createHmac } from "node:crypto";

const CATEGORIES = ["식비", "카페/간식", "교통", "쇼핑", "여가", "구독", "교육", "의료", "생활", "기타"];
const BUDGET_STATUSES = ["stable", "watch", "over"];
const BASIS_TONES = ["primary", "stable", "watch", "over"];
const SAVING_POSSIBILITIES = ["높음", "보통", "낮음"];
const DEFAULT_ALLOWED_ORIGINS = [
  "https://kt-ai-contest.vercel.app",
  "https://2476ae.github.io",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
];
const DEFAULT_MAX_OUTPUT_TOKENS = 320;
const DEFAULT_OPENAI_TIMEOUT_MS = 7500;
const DEFAULT_SERVER_DAILY_REQUEST_LIMIT = 60;
const DEFAULT_SERVER_CLASSIFY_DAILY_LIMIT = 40;
const DEFAULT_SERVER_COACH_DAILY_LIMIT = 20;
const DEFAULT_RATE_LIMIT_STORE_TIMEOUT_MS = 1200;
const RATE_LIMIT_SCRIPT = [
  'local total = tonumber(redis.call("GET", KEYS[1]) or "0")',
  'local kind = tonumber(redis.call("GET", KEYS[2]) or "0")',
  "local totalLimit = tonumber(ARGV[1])",
  "local kindLimit = tonumber(ARGV[2])",
  "local ttl = tonumber(ARGV[3])",
  "if total >= totalLimit or kind >= kindLimit then",
  "  return {0, total, kind}",
  "end",
  'total = redis.call("INCR", KEYS[1])',
  'kind = redis.call("INCR", KEYS[2])',
  'if total == 1 then redis.call("EXPIRE", KEYS[1], ttl) end',
  'if kind == 1 then redis.call("EXPIRE", KEYS[2], ttl) end',
  "return {1, total, kind}",
].join("\n");

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function handleCors(req, res) {
  const origin = req.headers.origin;
  const vercelOrigin = process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "";
  const defaultOrigins = [...DEFAULT_ALLOWED_ORIGINS, vercelOrigin].filter(Boolean);
  const configuredOrigins = (process.env.AI_ALLOWED_ORIGINS || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
  const allowedOrigins = Array.from(new Set([...defaultOrigins, ...configuredOrigins]));
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
  res.setHeader("Cache-Control", "no-store");
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

function readPositiveNumber(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function readBoolean(value, fallback = false) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "true" || normalized === "1" || normalized === "yes") {
    return true;
  }
  if (normalized === "false" || normalized === "0" || normalized === "no") {
    return false;
  }

  return fallback;
}

function getClientKey(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwardedFor || String(req.headers["x-real-ip"] || req.socket?.remoteAddress || "unknown");
}

function getClientKeyHash(req) {
  const secret = process.env.AI_RATE_LIMIT_KEY_SECRET || process.env.OPENAI_API_KEY || "money-routine-rate-limit";
  return createHmac("sha256", secret).update(getClientKey(req)).digest("hex").slice(0, 32);
}

function getPersistentRateLimitConfig() {
  const url = String(process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL || "")
    .trim()
    .replace(/\/+$/, "");
  const token = String(process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN || "").trim();
  return url && token ? { token, url } : null;
}

function getRateLimitValues(kind) {
  const dailyLimit = readPositiveNumber(process.env.AI_DAILY_REQUEST_LIMIT, DEFAULT_SERVER_DAILY_REQUEST_LIMIT);
  const kindLimit =
    kind === "coach"
      ? readPositiveNumber(process.env.AI_COACH_DAILY_LIMIT, DEFAULT_SERVER_COACH_DAILY_LIMIT)
      : readPositiveNumber(process.env.AI_CLASSIFY_DAILY_LIMIT, DEFAULT_SERVER_CLASSIFY_DAILY_LIMIT);
  return { dailyLimit, kindLimit };
}

function getSecondsUntilRateLimitExpiry() {
  const now = new Date();
  const nextUtcDay = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1);
  return Math.max(60, Math.ceil((nextUtcDay - now.getTime()) / 1000) + 3600);
}

async function assertPersistentAiRateLimit(req, kind, config, limits) {
  const date = new Date().toISOString().slice(0, 10);
  const clientHash = getClientKeyHash(req);
  const keyPrefix = `money-routine:ai:${date}:${clientHash}`;
  const controller = new AbortController();
  const timeoutMs = Math.min(
    readPositiveNumber(process.env.AI_RATE_LIMIT_STORE_TIMEOUT_MS, DEFAULT_RATE_LIMIT_STORE_TIMEOUT_MS),
    2000,
  );
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(config.url, {
      body: JSON.stringify([
        "EVAL",
        RATE_LIMIT_SCRIPT,
        2,
        `${keyPrefix}:total`,
        `${keyPrefix}:${kind}`,
        limits.dailyLimit,
        limits.kindLimit,
        getSecondsUntilRateLimitExpiry(),
      ]),
      headers: {
        Authorization: `Bearer ${config.token}`,
        "Content-Type": "application/json",
      },
      method: "POST",
      signal: controller.signal,
    });
    const payload = await response.json();
    if (!response.ok || payload?.error || !Array.isArray(payload?.result)) {
      throw new Error(payload?.error || `Persistent rate limit store returned ${response.status}.`);
    }
    if (Number(payload.result[0]) !== 1) {
      throw new HttpError(429, "AI request limit reached for today.");
    }
  } finally {
    clearTimeout(timeoutId);
  }
}

function getUsageStore() {
  globalThis.__moneyRoutineAiUsage ??= new Map();
  return globalThis.__moneyRoutineAiUsage;
}

function assertMemoryAiRateLimit(req, kind, limits) {
  const date = new Date().toISOString().slice(0, 10);
  const key = `${date}:${getClientKeyHash(req)}`;
  const store = getUsageStore();
  if (store.size > 500) {
    for (const storedKey of store.keys()) {
      if (!storedKey.startsWith(`${date}:`)) {
        store.delete(storedKey);
      }
    }
  }
  const current = store.get(key) ?? { classify: 0, coach: 0, total: 0 };

  if (current.total >= limits.dailyLimit || current[kind] >= limits.kindLimit) {
    throw new HttpError(429, "AI request limit reached for today.");
  }

  store.set(key, {
    ...current,
    [kind]: current[kind] + 1,
    total: current.total + 1,
  });
}

export async function assertAiRateLimit(req, kind) {
  const productionDefault = process.env.VERCEL_ENV === "production";
  if (!readBoolean(process.env.AI_RATE_LIMIT_ENABLED, productionDefault)) {
    return;
  }

  const limits = getRateLimitValues(kind);
  const persistentConfig = getPersistentRateLimitConfig();
  if (persistentConfig) {
    try {
      await assertPersistentAiRateLimit(req, kind, persistentConfig, limits);
      return;
    } catch (error) {
      if (error instanceof HttpError && error.status === 429) {
        throw error;
      }
      console.warn(JSON.stringify({
        event: "money_routine_ai_rate_limit",
        outcome: "persistent_store_unavailable",
        fallback: "instance_memory",
      }));
    }
  }

  assertMemoryAiRateLimit(req, kind, limits);
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

  if (!input.baseReport || typeof input.baseReport !== "object") {
    throw new HttpError(400, "A locally calculated base report is required.");
  }

  const clip = (value, maxLength) => String(value || "").replace(/\s+/g, " ").trim().slice(0, maxLength);
  const number = (value) => (Number.isFinite(Number(value)) ? Number(value) : 0);
  const status = (value) => (BUDGET_STATUSES.includes(value) ? value : "stable");
  const base = input.baseReport;
  const categoryPlans = Array.isArray(base.categoryPlans)
    ? base.categoryPlans.slice(0, 4).map((plan) => ({
        category: CATEGORIES.includes(plan.category) ? plan.category : "기타",
        status: status(plan.status),
        currentAmount: number(plan.currentAmount),
        plannedAmount: number(plan.plannedAmount),
        expectedSaving: number(plan.expectedSaving),
        previousRatio: Number.isFinite(Number(plan.previousRatio)) ? Number(plan.previousRatio) : undefined,
        currentRatio: Number.isFinite(Number(plan.currentRatio)) ? Number(plan.currentRatio) : undefined,
        guideRatio: Number.isFinite(Number(plan.guideRatio)) ? Number(plan.guideRatio) : undefined,
        reason: clip(plan.reason, 80),
        action: clip(plan.action, 80),
      }))
    : [];
  const missions = Array.isArray(base.missions)
    ? base.missions.slice(0, 3).map((mission, index) => ({
        id: clip(mission.id, 40) || `mission-${index}`,
        title: clip(mission.title, 60),
        reason: clip(mission.reason, 80),
        expectedSaving: number(mission.expectedSaving),
        impactLabel: clip(mission.impactLabel, 30),
        impactText: clip(mission.impactText, 30),
        action: clip(mission.action, 80),
        completed: Boolean(mission.completed),
      }))
    : [];
  const basisItems = Array.isArray(base.basisItems)
    ? base.basisItems.slice(0, 5).map((item, index) => ({
        id: clip(item.id, 40) || `basis-${index}`,
        title: clip(item.title, 30),
        value: clip(item.value, 30),
        detail: clip(item.detail, 80),
        tone: BASIS_TONES.includes(item.tone) ? item.tone : "primary",
      }))
    : [];

  return {
    monthId: String(input.monthId || "").slice(0, 20),
    currentDate: String(input.currentDate || "").slice(0, 10),
    baseReport: {
      headline: clip(base.headline, 80),
      status: status(base.status),
      dailyBudget: number(base.dailyBudget),
      savingPossibility: SAVING_POSSIBILITIES.includes(base.savingPossibility) ? base.savingPossibility : "보통",
      todayAction: clip(base.todayAction, 100),
      insights: Array.isArray(base.insights) ? base.insights.slice(0, 3).map((item) => clip(item, 100)) : [],
      categoryPlans,
      missions,
      subscriptionAdvice: Array.isArray(base.subscriptionAdvice)
        ? base.subscriptionAdvice.slice(0, 2).map((item) => clip(item, 100))
        : [],
      basis: clip(base.basis, 160),
      basisItems,
    },
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
    categoryPlans: {
      type: "array",
      maxItems: 4,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: CATEGORIES },
          status: { type: "string", enum: BUDGET_STATUSES },
          currentAmount: { type: "number" },
          plannedAmount: { type: "number" },
          expectedSaving: { type: "number" },
          reason: { type: "string" },
          action: { type: "string" },
        },
        required: ["category", "status", "currentAmount", "plannedAmount", "expectedSaving", "reason", "action"],
      },
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
    basisItems: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          value: { type: "string" },
          detail: { type: "string" },
          tone: { type: "string", enum: BASIS_TONES },
        },
        required: ["id", "title", "value", "detail", "tone"],
      },
    },
  },
  required: [
    "headline",
    "status",
    "dailyBudget",
    "savingPossibility",
    "todayAction",
    "insights",
    "categoryPlans",
    "missions",
    "subscriptionAdvice",
    "basis",
    "basisItems",
  ],
};

export const coachEnhancementSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    categoryCopy: {
      type: "array",
      maxItems: 3,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          category: { type: "string", enum: CATEGORIES },
          action: { type: "string" },
        },
        required: ["category", "action"],
      },
    },
    missionCopy: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string" },
          title: { type: "string" },
          action: { type: "string" },
        },
        required: ["id", "title", "action"],
      },
    },
  },
  required: ["categoryCopy", "missionCopy"],
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

export async function createOpenAiJsonResponse({ name, schema, system, payload, maxOutputTokens }) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new HttpError(500, "OPENAI_API_KEY is not configured.");
  }

  const controller = new AbortController();
  const configuredTimeout = readPositiveNumber(process.env.OPENAI_TIMEOUT_MS, DEFAULT_OPENAI_TIMEOUT_MS);
  const timeoutMs = Math.min(configuredTimeout, 8000);
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  let openAiResponse;
  const startedAt = Date.now();

  try {
    openAiResponse = await fetch("https://api.openai.com/v1/responses", {
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
        max_output_tokens: maxOutputTokens || Number(process.env.OPENAI_MAX_OUTPUT_TOKENS) || DEFAULT_MAX_OUTPUT_TOKENS,
        store: false,
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
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      console.error(JSON.stringify({ event: "money_routine_ai", name, outcome: "timeout", durationMs: Date.now() - startedAt }));
      throw new HttpError(504, "OpenAI request timed out. Showing the default analysis.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }

  if (!openAiResponse.ok) {
    console.error(JSON.stringify({ event: "money_routine_ai", name, outcome: "upstream_error", status: openAiResponse.status, durationMs: Date.now() - startedAt }));
    throw new HttpError(502, `OpenAI request failed with ${openAiResponse.status}.`);
  }

  const result = JSON.parse(extractOutputText(await openAiResponse.json()));
  console.info(JSON.stringify({ event: "money_routine_ai", name, outcome: "success", durationMs: Date.now() - startedAt }));
  return result;
}

export function handleProxyError(res, error) {
  const status = error instanceof HttpError ? error.status : 500;
  const message = error instanceof Error ? error.message : "Unexpected AI proxy error.";
  sendJson(res, status, { error: message });
}
