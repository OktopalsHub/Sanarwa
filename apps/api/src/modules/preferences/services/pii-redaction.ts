import type { MessageRecipient } from "../../messaging/message.entity";

export interface RedactResult<T> {
  value: T;
  changed: boolean;
}

const REDACTED = "[redacted]";

/** Keys that conventionally carry an address or identity claim. */
export function isPiiKey(key: string): boolean {
  return [
    "to",
    "recipient",
    "email",
    "phone",
    "deviceToken",
    "whatsappNumber",
    "slackChannel",
    "slackWebhookUrl",
    "discordWebhookUrl",
    "telegramChatId",
    "chatAddress",
    "userId",
    "subscriberId",
    "id",
  ].includes(key);
}

export function recipientMatches(
  recipient: MessageRecipient,
  subscriberId: string,
  address: string,
): boolean {
  const values = [
    recipient.id,
    recipient.userId,
    recipient.email,
    recipient.phone,
    recipient.deviceToken,
    recipient.whatsappNumber,
    recipient.slackChannel,
    recipient.slackWebhookUrl,
    recipient.discordWebhookUrl,
    recipient.telegramChatId,
    recipient.chatAddress,
  ];
  return values.some((v) => {
    if (typeof v !== "string" || !v) return false;
    const t = v.trim();
    return t === subscriberId || t.toLowerCase() === address;
  });
}

export const objectLooksLikeRecipient = recipientMatches;

export function redactRecipient(recipient: MessageRecipient): MessageRecipient {
  const redacted = REDACTED;
  return {
    ...recipient,
    id: redacted,
    email: recipient.email ? redacted : recipient.email,
    phone: recipient.phone ? redacted : recipient.phone,
    deviceToken: recipient.deviceToken ? redacted : recipient.deviceToken,
    whatsappNumber: recipient.whatsappNumber ? redacted : recipient.whatsappNumber,
    slackChannel: recipient.slackChannel ? redacted : recipient.slackChannel,
    slackWebhookUrl: recipient.slackWebhookUrl ? redacted : recipient.slackWebhookUrl,
    discordWebhookUrl: recipient.discordWebhookUrl ? redacted : recipient.discordWebhookUrl,
    telegramChatId: recipient.telegramChatId ? redacted : recipient.telegramChatId,
    chatAddress: recipient.chatAddress ? redacted : recipient.chatAddress,
    userId: recipient.userId ? redacted : recipient.userId,
    metadata: recipient.metadata ? { redacted: true } : recipient.metadata,
  };
}

/**
 * Walks a JSON-like value and replaces every occurrence of subscriberId /
 * address with "[redacted]", including inside recipient-shaped objects.
 * Pure; no persistence, no logging.
 */
export function redactPiiInValue(
  value: unknown,
  subscriberId: string,
  address: string,
): RedactResult<any> {
  if (value === null || value === undefined) return { value, changed: false };
  if (typeof value === "string") {
    const t = value.trim();
    if (t === subscriberId || t.toLowerCase() === address) {
      return { value: REDACTED, changed: true };
    }
    return { value, changed: false };
  }
  if (Array.isArray(value)) {
    let changed = false;
    const next = value.map((item) => {
      if (
        item &&
        typeof item === "object" &&
        recipientMatches(item as MessageRecipient, subscriberId, address)
      ) {
        changed = true;
        return redactRecipient(item as MessageRecipient);
      }
      const r = redactPiiInValue(item, subscriberId, address);
      if (r.changed) changed = true;
      return r.value;
    });
    return changed ? { value: next, changed } : { value, changed: false };
  }
  if (typeof value === "object") {
    let changed = false;
    const out: Record<string, any> = { ...(value as Record<string, any>) };
    for (const [k, v] of Object.entries(out)) {
      if (isPiiKey(k) && typeof v === "string") {
        const t = v.trim();
        if (t === subscriberId || t.toLowerCase() === address) {
          out[k] = REDACTED;
          changed = true;
          continue;
        }
      }
      if (k === "recipients" && Array.isArray(v)) {
        const r = redactPiiInValue(v, subscriberId, address);
        if (r.changed) {
          out[k] = r.value;
          changed = true;
        }
        continue;
      }
      const r = redactPiiInValue(v, subscriberId, address);
      if (r.changed) {
        out[k] = r.value;
        changed = true;
      }
    }
    return changed ? { value: out, changed } : { value, changed: false };
  }
  return { value, changed: false };
}
