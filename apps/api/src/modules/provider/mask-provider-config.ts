const SECRET_KEY = /(secret|token|password|passphrase|private|api_?key|auth|credential)/i;
const MASK = "••••";

function maskValue(value: unknown): string {
  return typeof value === "string" && value.length > 8 ? `${MASK}${value.slice(-4)}` : MASK;
}

/** Replaces secret-looking config values so they never leave the API. */
export function maskSecrets(config: Record<string, unknown> | null | undefined) {
  const source = config ?? {};
  return Object.fromEntries(
    Object.entries(source).map(([key, value]) => [
      key,
      SECRET_KEY.test(key) && value !== undefined && value !== null && value !== ""
        ? maskValue(value)
        : value,
    ]),
  );
}

export function isSecretField(key: string): boolean {
  return SECRET_KEY.test(key);
}

export function presentConfig<T extends { config?: Record<string, unknown> | null }>(
  providerConfig: T,
): T {
  return { ...providerConfig, config: maskSecrets(providerConfig.config) };
}
