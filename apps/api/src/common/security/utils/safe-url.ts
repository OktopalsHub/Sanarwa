/** Reject non-http(s) and private/metadata hosts (SSRF). */
export function assertSafeWebhookUrl(url: string): void {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("Invalid webhook URL");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Webhook URL must be http or https");
  }

  const host = parsed.hostname.toLowerCase();
  const blocked =
    host === "localhost" ||
    host === "127.0.0.1" ||
    host === "::1" ||
    host === "metadata" ||
    host.endsWith(".localhost") ||
    host.startsWith("169.254.") ||
    host.startsWith("10.") ||
    host.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host);

  if (blocked) {
    throw new Error("Webhook URL targets a blocked host");
  }
}
