/**
 * Runtime API configuration for @sanarwa/api-client
 */

export interface ApiRuntimeConfig {
  baseUrl: string;
  wsUrl: string;
  timeout: number;
  retryAttempts: number;
}

function getEnv(key: string, fallback = ""): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.[key]) {
    return String(import.meta.env[key]);
  }
  if (typeof process !== "undefined" && process.env?.[key]) {
    return String(process.env[key]);
  }
  return fallback;
}

function getMode(): string {
  if (typeof import.meta !== "undefined" && import.meta.env?.MODE) {
    return import.meta.env.MODE;
  }
  return process.env.NODE_ENV ?? "development";
}

export function getApiRuntimeConfig(): ApiRuntimeConfig {
  const mode = getMode();
  const isDev = mode === "development";

  const baseUrl =
    getEnv("VITE_API_URL") ||
    getEnv("NEXT_PUBLIC_API_URL") ||
    (isDev ? "http://localhost:9000/api/v1" : "https://api.sanarwa.com/api/v1");

  const wsUrl =
    getEnv("VITE_WS_URL") || getEnv("NEXT_PUBLIC_WS_URL") || baseUrl.replace(/^http/, "ws");

  return {
    baseUrl,
    wsUrl,
    timeout: Number(getEnv("VITE_API_TIMEOUT", isDev ? "30000" : "10000")),
    retryAttempts: Number(getEnv("VITE_API_RETRY_ATTEMPTS", isDev ? "1" : "3")),
  };
}

export const apiRuntimeConfig = getApiRuntimeConfig();
