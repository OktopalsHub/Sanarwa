import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { BounceType, DeliveryEventType } from "../enums/delivery-event-type.enum";
import { ProviderFeedbackInput } from "./delivery-event.service";

/**
 * Normalizes a raw email-provider webhook payload into the shared
 * `ProviderFeedbackInput` shape. Every function is pure and returns `null`
 * for payloads it does not recognize, so controllers can ignore unknown
 * event kinds without storing anything.
 */

const EMAIL_CHANNEL = NotificationChannel.EMAIL;

export type RawRecord = Record<string, any>;

type BaseFeedback = Omit<ProviderFeedbackInput, "type">;

function toDate(value: unknown): Date | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value < 1e11 ? value * 1000 : value);
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const asNum = Number(value);
    return new Date(asNum < 1e11 ? asNum * 1000 : asNum);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

function smtpBounceType(status: unknown): BounceType {
  if (typeof status === "string" && status.startsWith("4")) return "soft";
  return "hard";
}

function asRecord(value: unknown): RawRecord | null {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as RawRecord;
  }
  return null;
}

/**
 * SendGrid Event Webhook entries — an array per POST. Each entry carries
 * `event`, `email`, `sg_event_id`, `sg_message_id` and `timestamp` (unix).
 */
export function normalizeSendGridEvent(raw: unknown): ProviderFeedbackInput | null {
  const event = asRecord(raw);
  if (!event?.event || !event?.sg_event_id) return null;

  const base: Omit<ProviderFeedbackInput, "type"> = {
    provider: "sendgrid",
    providerEventId: String(event.sg_event_id),
    providerMessageId: event.sg_message_id ? String(event.sg_message_id) : undefined,
    recipient: typeof event.email === "string" ? event.email : undefined,
    channel: EMAIL_CHANNEL,
    occurredAt: toDate(event.timestamp) ?? new Date(),
    raw: { ...event },
  };

  switch (event.event) {
    case "processed":
      return { ...base, type: DeliveryEventType.SENT };
    case "delivered":
      return { ...base, type: DeliveryEventType.DELIVERED };
    case "deferred":
      return {
        ...base,
        type: DeliveryEventType.DEFERRED,
        reasonCode: event.reason,
        diagnostic: event.reason,
      };
    case "bounce":
      return {
        ...base,
        type: DeliveryEventType.BOUNCED,
        bounceType: smtpBounceType(event.status),
        reasonCode: event.status,
        diagnostic: event.reason,
      };
    case "dropped":
      return {
        ...base,
        type: DeliveryEventType.DROPPED,
        reasonCode: event.reason,
        diagnostic: event.reason,
      };
    case "spamreport":
      return {
        ...base,
        type: DeliveryEventType.COMPLAINED,
        reasonCode: event.reason,
        diagnostic: event.reason,
      };
    case "open":
      return {
        ...base,
        type: DeliveryEventType.OPENED,
        ip: event.ip ? String(event.ip) : undefined,
        userAgent: event.useragent ? String(event.useragent) : undefined,
      };
    case "click":
      return {
        ...base,
        type: DeliveryEventType.CLICKED,
        url: event.url ? String(event.url) : undefined,
        ip: event.ip ? String(event.ip) : undefined,
        userAgent: event.useragent ? String(event.useragent) : undefined,
      };
    case "unsubscribe":
    case "group_unsubscribe":
      return { ...base, type: DeliveryEventType.UNSUBSCRIBED };
    default:
      return null;
  }
}

/**
 * Mailgun webhook body — `{ "event-data": { ... } }` or the event data
 * itself. The event is in `event-data.event` (or at the top level).
 */
export function normalizeMailgunEvent(raw: unknown): ProviderFeedbackInput | null {
  const body = asRecord(raw);
  if (!body) return null;

  const data =
    asRecord(body["event-data"] ?? body.event_data ?? body["eventData"]) ??
    asRecord(body.event ? body : null);
  if (!data?.event) return null;

  const headers = Array.isArray(data["message-headers"])
    ? (data["message-headers"] as Array<{ name?: string; value?: string }>)
    : undefined;
  const messageIdHeader = headers?.find((h) => h.name?.toLowerCase() === "message-id")?.value;

  const reasonText = typeof data.reason === "string" ? data.reason : "";
  const isHard =
    /hard|permanent/i.test(reasonText) || /permanent/i.test(String(data.severity ?? ""));

  const base: Omit<ProviderFeedbackInput, "type"> = {
    provider: "mailgun",
    providerEventId: data.id ? String(data.id) : undefined,
    // Mailgun events only carry the Message-ID header as a correlation id;
    // without it the event is an orphan and the service logs it.
    providerMessageId: messageIdHeader,
    recipient: typeof data.recipient === "string" ? data.recipient : undefined,
    channel: EMAIL_CHANNEL,
    occurredAt: toDate(data.timestamp) ?? new Date(),
    raw: { ...data },
    url: data.url ? String(data.url) : undefined,
    ip: data.ip ? String(data.ip) : undefined,
    userAgent: data["user-agent"] ? String(data["user-agent"]) : undefined,
  };

  switch (data.event) {
    case "accepted":
    case "stored":
      return { ...base, type: DeliveryEventType.SENT };
    case "delivered":
      return { ...base, type: DeliveryEventType.DELIVERED };
    case "failed":
    case "rejected":
      return {
        ...base,
        type: DeliveryEventType.BOUNCED,
        bounceType: isHard ? "hard" : "soft",
        reasonCode: typeof data.reason === "string" ? data.reason : undefined,
        diagnostic: typeof data.reason === "string" ? data.reason : undefined,
      };
    case "opened":
      return { ...base, type: DeliveryEventType.OPENED };
    case "clicked":
      return { ...base, type: DeliveryEventType.CLICKED };
    case "complained":
      return { ...base, type: DeliveryEventType.COMPLAINED };
    case "unsubscribed":
      return { ...base, type: DeliveryEventType.UNSUBSCRIBED };
    default:
      return null;
  }
}

/**
 * Resend webhook payload — `{ id, created_at, type: "email.sent", data: { ... } }`.
 * The event id is unique per webhook; `data.email_id` holds the provider's
 * message id.
 */
export function normalizeResendEvent(raw: unknown): ProviderFeedbackInput | null {
  const body = asRecord(raw);
  if (!body?.type || typeof body.type !== "string") return null;

  const data = asRecord(body.data) ?? {};
  const to = Array.isArray(data.to) ? data.to : [];
  const bounceTypeLabel = typeof data.bounceType === "string" ? data.bounceType : "";

  const base: Omit<ProviderFeedbackInput, "type"> = {
    provider: "resend",
    providerEventId: body.id ? String(body.id) : undefined,
    providerMessageId: data.email_id
      ? String(data.email_id)
      : data.id
        ? String(data.id)
        : undefined,
    recipient: to.length > 0 ? String(to[0]) : undefined,
    channel: EMAIL_CHANNEL,
    occurredAt: toDate(body.created_at ?? data.created_at) ?? new Date(),
    raw: { ...body },
  };

  switch (body.type) {
    case "email.sent":
      return { ...base, type: DeliveryEventType.SENT };
    case "email.delivery_delayed":
      return { ...base, type: DeliveryEventType.DEFERRED };
    case "email.delivered":
      return { ...base, type: DeliveryEventType.DELIVERED };
    case "email.bounced":
      return {
        ...base,
        type: DeliveryEventType.BOUNCED,
        bounceType: /transient/i.test(bounceTypeLabel) ? "soft" : "hard",
        reasonCode: bounceTypeLabel || undefined,
        diagnostic: bounceTypeLabel || undefined,
      };
    case "email.complained":
      return { ...base, type: DeliveryEventType.COMPLAINED };
    case "email.opened":
      return { ...base, type: DeliveryEventType.OPENED };
    case "email.clicked":
      return { ...base, type: DeliveryEventType.CLICKED };
    case "email.delivery_failed":
      return {
        ...base,
        type: DeliveryEventType.DROPPED,
        reasonCode: bounceTypeLabel || undefined,
        diagnostic: bounceTypeLabel || undefined,
      };
    default:
      return null;
  }
}

/**
 * SES notification JSON (unwrapped from its SNS envelope by the controller).
 * `eventType`: Send | Delivery | Bounce | Complaint | Open | Click | Reject |
 * DeliveryDelay | RenderingFailure | Subscription.
 */
export function normalizeSesEvent(raw: unknown): ProviderFeedbackInput | null {
  const event = asRecord(raw);
  if (!event?.eventType || !event?.mail) return null;

  const mail = asRecord(event.mail) ?? {};
  const destinations = Array.isArray(mail.destination) ? mail.destination : [];
  const bounce = asRecord(event.bounce);
  const sesBounceType = typeof bounce?.bounceType === "string" ? bounce.bounceType : "";

  const base: Omit<ProviderFeedbackInput, "type"> = {
    provider: "ses",
    providerEventId: undefined,
    providerMessageId: mail.messageId ? String(mail.messageId) : undefined,
    recipient: destinations.length > 0 ? String(destinations[0]) : undefined,
    channel: EMAIL_CHANNEL,
    occurredAt: toDate(mail.timestamp) ?? new Date(),
    raw: { ...event },
  };

  switch (event.eventType) {
    case "Send":
      return { ...base, type: DeliveryEventType.SENT };
    case "Delivery":
      return { ...base, type: DeliveryEventType.DELIVERED };
    case "Bounce":
      return {
        ...base,
        type: DeliveryEventType.BOUNCED,
        bounceType: /transient/i.test(sesBounceType) ? "soft" : "hard",
        reasonCode: sesBounceType || undefined,
        diagnostic: typeof bounce?.diagnosticCode === "string" ? bounce.diagnosticCode : undefined,
      };
    case "Complaint":
      return {
        ...base,
        type: DeliveryEventType.COMPLAINED,
        reasonCode: event.complaint?.complaintFeedbackType,
      };
    case "Open":
      return { ...base, type: DeliveryEventType.OPENED };
    case "Click":
      return { ...base, type: DeliveryEventType.CLICKED };
    case "Reject":
      return {
        ...base,
        type: DeliveryEventType.DROPPED,
        reasonCode: event.reject?.reason,
        diagnostic: event.reject?.reason,
      };
    case "DeliveryDelay":
      return { ...base, type: DeliveryEventType.DEFERRED };
    case "RenderingFailure":
      return {
        ...base,
        type: DeliveryEventType.DROPPED,
        reasonCode: event.renderingFailure?.errorMessage,
        diagnostic: event.renderingFailure?.errorMessage,
      };
    case "Subscription":
      return { ...base, type: DeliveryEventType.UNSUBSCRIBED };
    default:
      return null;
  }
}
