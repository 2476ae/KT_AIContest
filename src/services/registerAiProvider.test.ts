import { describe, expect, it } from "vitest";
import { readAiProxyTimeoutMs, shouldEnableOpenAiProxy } from "./registerAiProvider";

describe("AI provider registration", () => {
  it("keeps local AI when OpenAI proxy env is not configured", () => {
    expect(shouldEnableOpenAiProxy({})).toBe(false);
  });

  it("enables OpenAI proxy by provider flag or proxy URL", () => {
    expect(shouldEnableOpenAiProxy({ VITE_AI_PROVIDER: "openai-proxy" })).toBe(true);
    expect(shouldEnableOpenAiProxy({ VITE_AI_PROXY_BASE_URL: "https://ai.example.com" })).toBe(true);
  });

  it("uses a positive custom OpenAI proxy timeout when provided", () => {
    expect(readAiProxyTimeoutMs({ VITE_AI_PROXY_TIMEOUT_MS: "60000" })).toBe(60000);
    expect(readAiProxyTimeoutMs({ VITE_AI_PROXY_TIMEOUT_MS: "0" })).toBeUndefined();
    expect(readAiProxyTimeoutMs({ VITE_AI_PROXY_TIMEOUT_MS: "slow" })).toBeUndefined();
  });
});
