import { setAiProvider } from "./aiAdapter";
import { createOpenAiProxyProvider } from "./openAiProxyProvider";

interface AiRuntimeEnv {
  VITE_AI_PROVIDER?: string;
  VITE_AI_PROXY_BASE_URL?: string;
}

export function shouldEnableOpenAiProxy(env: AiRuntimeEnv) {
  return env.VITE_AI_PROVIDER === "openai-proxy" || Boolean(env.VITE_AI_PROXY_BASE_URL);
}

export function registerConfiguredAiProvider(env: AiRuntimeEnv = import.meta.env) {
  if (!shouldEnableOpenAiProxy(env)) {
    return false;
  }

  setAiProvider(
    createOpenAiProxyProvider({
      baseUrl: env.VITE_AI_PROXY_BASE_URL,
    }),
    {
      id: "openai-proxy",
      label: "OpenAI 분석",
      mode: "external",
    },
  );

  return true;
}
