import { describe, expect, it } from "vitest";
import { shouldEnableOpenAiProxy } from "./registerAiProvider";

describe("AI provider registration", () => {
  it("keeps local AI when OpenAI proxy env is not configured", () => {
    expect(shouldEnableOpenAiProxy({})).toBe(false);
  });

  it("enables OpenAI proxy by provider flag or proxy URL", () => {
    expect(shouldEnableOpenAiProxy({ VITE_AI_PROVIDER: "openai-proxy" })).toBe(true);
    expect(shouldEnableOpenAiProxy({ VITE_AI_PROXY_BASE_URL: "https://ai.example.com" })).toBe(true);
  });
});
