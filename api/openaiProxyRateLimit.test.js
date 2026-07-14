import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertAiRateLimit } from "./_openaiProxy.js";

const request = {
  headers: {
    "x-forwarded-for": "203.0.113.42, 10.0.0.2",
  },
};

describe("server AI rate limiting", () => {
  beforeEach(() => {
    vi.stubEnv("AI_RATE_LIMIT_ENABLED", "true");
    vi.stubEnv("AI_RATE_LIMIT_KEY_SECRET", "test-rate-limit-secret");
    vi.stubEnv("AI_DAILY_REQUEST_LIMIT", "60");
    vi.stubEnv("AI_CLASSIFY_DAILY_LIMIT", "40");
    vi.stubEnv("AI_COACH_DAILY_LIMIT", "20");
    globalThis.__moneyRoutineAiUsage = new Map();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    delete globalThis.__moneyRoutineAiUsage;
  });

  it("uses one atomic Upstash command without storing the raw client address", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    const fetchMock = vi.fn().mockResolvedValue({
      json: async () => ({ result: [1, 1, 1] }),
      ok: true,
      status: 200,
    });
    vi.stubGlobal("fetch", fetchMock);

    await assertAiRateLimit(request, "coach");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, options] = fetchMock.mock.calls[0];
    const command = JSON.parse(options.body);
    expect(url).toBe("https://example.upstash.io");
    expect(options.headers.Authorization).toBe("Bearer redis-token");
    expect(command[0]).toBe("EVAL");
    expect(command[2]).toBe(2);
    expect(command[3]).toMatch(/^money-routine:ai:\d{4}-\d{2}-\d{2}:[a-f0-9]{32}:total$/);
    expect(command[4]).toMatch(/:coach$/);
    expect(command[3]).not.toContain("203.0.113.42");
    expect(command.slice(5, 7)).toEqual([60, 20]);
  });

  it("rejects a request when the shared store reports an exhausted limit", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      json: async () => ({ result: [0, 20, 20] }),
      ok: true,
      status: 200,
    }));

    await expect(assertAiRateLimit(request, "coach")).rejects.toMatchObject({ status: 429 });
  });

  it("falls back to the instance counter when Redis is temporarily unavailable", async () => {
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    vi.stubEnv("AI_DAILY_REQUEST_LIMIT", "1");
    vi.stubEnv("AI_CLASSIFY_DAILY_LIMIT", "1");
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("store unavailable")));
    vi.spyOn(console, "warn").mockImplementation(() => undefined);

    await expect(assertAiRateLimit(request, "classify")).resolves.toBeUndefined();
    await expect(assertAiRateLimit(request, "classify")).rejects.toMatchObject({ status: 429 });
  });

  it("does not contact Redis when server rate limiting is disabled", async () => {
    vi.stubEnv("AI_RATE_LIMIT_ENABLED", "false");
    vi.stubEnv("UPSTASH_REDIS_REST_URL", "https://example.upstash.io");
    vi.stubEnv("UPSTASH_REDIS_REST_TOKEN", "redis-token");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    await assertAiRateLimit(request, "coach");

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
