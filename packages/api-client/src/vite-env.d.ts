interface ImportMetaEnv {
  readonly [key: string]: string | undefined;
  readonly MODE: string;
  readonly VITE_API_URL?: string;
  readonly VITE_WS_URL?: string;
  readonly VITE_API_TIMEOUT?: string;
  readonly VITE_API_RETRY_ATTEMPTS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
