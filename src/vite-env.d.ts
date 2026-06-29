/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_AI_PROVIDER?: "openai-proxy" | string;
  readonly VITE_AI_PROXY_BASE_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*.csv?raw" {
  const content: string;
  export default content;
}
