import { ConfigService } from "@nestjs/config";

/**
 * Providers in this module were built to read `ConfigService.get(...)` against
 * process env. Tenant BYOP configs are not env vars, so they are bridged in
 * with a plain-object ConfigService-shaped shim instead of rewriting every
 * provider to accept a config object.
 *
 * `config` is already decrypted; values found there are returned as-is, and
 * the second argument of `get` (the default) is honoured when a key is absent.
 */
export function configServiceFrom(config: Record<string, unknown>): ConfigService {
  const source = config ?? {};

  return {
    get: (key: string, fallback?: unknown) =>
      key in source ? (source[key] as never) : (fallback as never),
  } as unknown as ConfigService;
}
