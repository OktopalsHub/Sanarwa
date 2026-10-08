import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/** Reject non-http(s) and private/metadata hosts (SSRF). */
export async function assertSafeWebhookUrl(url: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid webhook URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Webhook URL must be http or https");
  }

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (isBlockedIp(host)) {
    throw new Error("Webhook URL targets a blocked host");
  }

  if (isIP(host)) {
    return;
  }

  const addresses = await lookup(host, { all: true, verbatim: true });
  if (addresses.some(({ address }) => isBlockedIp(address))) {
    throw new Error("Webhook URL resolves to a blocked host");
  }
}

function isBlockedIp(host: string): boolean {
  const normalized = host.toLowerCase().replace(/^\[|\]$/g, "");
  return (
    normalized === "localhost" ||
    normalized === "metadata" ||
    normalized.endsWith(".localhost") ||
    normalized === "::1" ||
    normalized === "0.0.0.0" ||
    normalized.startsWith("169.254.") ||
    normalized.startsWith("10.") ||
    normalized.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(normalized) ||
    normalized.startsWith("127.")
  );
}
