import { z } from "zod";

const DEFAULT_BASE_URL = "https://api.sanarwa.com/api/v1";
const DEFAULT_PORT = 3400;
const DEFAULT_BIND_ADDRESS = "127.0.0.1";

const envSchema = z.object({
  SANARWA_API_KEY: z.string().min(1, "SANARWA_API_KEY is required"),
  SANARWA_BASE_URL: z.string().url().default(DEFAULT_BASE_URL),
  SANARWA_MCP_PORT: z.coerce.number().int().min(1).max(65535).default(DEFAULT_PORT),
  SANARWA_MCP_HOST: z.string().default(DEFAULT_BIND_ADDRESS),
});

export interface ResolvedConfig {
  apiKey: string;
  baseUrl: string;
  port: number;
  host: string;
}

export class ConfigError extends Error {}

export function resolveConfig(env: NodeJS.ProcessEnv): ResolvedConfig {
  const parsed = envSchema.safeParse(env);

  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((issue) => `${issue.path.join(".") || "env"}: ${issue.message}`)
      .join("; ");
    throw new ConfigError(detail);
  }

  return {
    apiKey: parsed.data.SANARWA_API_KEY,
    baseUrl: parsed.data.SANARWA_BASE_URL,
    port: parsed.data.SANARWA_MCP_PORT,
    host: parsed.data.SANARWA_MCP_HOST,
  };
}
