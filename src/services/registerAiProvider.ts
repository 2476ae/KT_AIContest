import { setAiProvider } from "./aiAdapter";
import { createOpenAiProxyProvider, DEFAULT_AI_PROXY_TIMEOUT_MS } from "./openAiProxyProvider";

interface AiRuntimeEnv {
  VITE_AI_PROVIDER?: string;
  VITE_AI_PROXY_BASE_URL?: string;
  VITE_AI_PROXY_TIMEOUT_MS?: string;
}

export function shouldEnableOpenAiProxy(env: AiRuntimeEnv) {
  return env.VITE_AI_PROVIDER === "openai-proxy" || Boolean(env.VITE_AI_PROXY_BASE_URL);
}

export function readAiProxyTimeoutMs(env: AiRuntimeEnv) {
  const parsed = Number(env.VITE_AI_PROXY_TIMEOUT_MS);
  return Number.isFinite(parsed) && parsed > 0 ? Math.min(parsed, DEFAULT_AI_PROXY_TIMEOUT_MS) : undefined;
}

export function registerConfiguredAiProvider(env: AiRuntimeEnv = import.meta.env) {
  if (!shouldEnableOpenAiProxy(env)) {
    return false;
  }

  setAiProvider(
    createOpenAiProxyProvider({
      baseUrl: env.VITE_AI_PROXY_BASE_URL,
      timeoutMs: readAiProxyTimeoutMs(env),
    }),
    {
      id: "openai-proxy",
      label: "OpenAI 분석",
      mode: "external",
    },
  );

  return true;
}
