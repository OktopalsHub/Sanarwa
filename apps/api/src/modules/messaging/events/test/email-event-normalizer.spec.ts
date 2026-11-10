import { DeliveryEventType } from "../../enums/delivery-event-type.enum";
import {
  normalizeMailgunEvent,
  normalizeResendEvent,
  normalizeSendGridEvent,
  normalizeSesEvent,
} from "../email-event-normalizer";

describe("email event normalizers", () => {
  describe("sendgrid", () => {
    const base = {
      email: "user@example.com",
      sg_event_id: "sg_evt_1",
      sg_message_id: "sg_msg_1",
      timestamp: 1700000000,
    };

    it("maps hard (5xx) bounces with reason and status", () => {
      const out = normalizeSendGridEvent({
        ...base,
        event: "bounce",
        status: "5.1.1",
        reason: "user unknown",
      });
      expect(out).toMatchObject({
        provider: "sendgrid",
        type: DeliveryEventType.BOUNCED,
        bounceType: "hard",
        providerEventId: "sg_evt_1",
        providerMessageId: "sg_msg_1",
        recipient: "user@example.com",
        reasonCode: "5.1.1",
        diagnostic: "user unknown",
      });
    });

    it("maps soft (4xx) bounces", () => {
      const out = normalizeSendGridEvent({
        ...base,
        event: "bounce",
        status: "4.2.2",
        reason: "mailbox full",
      });
      expect(out?.bounceType).toBe("soft");
    });

    it("maps delivered, open (ip + user agent), click (url), spamreport → complaint, unsubscribe", () => {
      expect(normalizeSendGridEvent({ ...base, event: "delivered" })?.type).toBe(
        DeliveryEventType.DELIVERED,
      );
      expect(
        normalizeSendGridEvent({ ...base, event: "open", ip: "1.2.3.4", useragent: "curl" }),
      ).toMatchObject({
        type: DeliveryEventType.OPENED,
        ip: "1.2.3.4",
        userAgent: "curl",
      });
      expect(
        normalizeSendGridEvent({ ...base, event: "click", url: "https://x.com" }),
      ).toMatchObject({
        type: DeliveryEventType.CLICKED,
        url: "https://x.com",
      });
      expect(normalizeSendGridEvent({ ...base, event: "spamreport" })?.type).toBe(
        DeliveryEventType.COMPLAINED,
      );
      expect(normalizeSendGridEvent({ ...base, event: "unsubscribe" })?.type).toBe(
        DeliveryEventType.UNSUBSCRIBED,
      );
      expect(
        normalizeSendGridEvent({ ...base, event: "dropped", reason: "suppressed" })?.type,
      ).toBe(DeliveryEventType.DROPPED);
    });

    it("returns null for unknown kinds", () => {
      expect(normalizeSendGridEvent({ ...base, event: "something-new" })).toBeNull();
      expect(normalizeSendGridEvent({})).toBeNull();
    });
  });

  describe("mailgun", () => {
    const base = {
      recipient: "user@example.com",
      id: "mg_evt_1",
      timestamp: 1700000000,
      "message-headers": [{ name: "Message-ID", value: "msg-id-1@example.com" }],
    };

    it("maps delivered and hard failures", () => {
      expect(
        normalizeMailgunEvent({ "event-data": { ...base, event: "delivered" } }),
      ).toMatchObject({
        type: DeliveryEventType.DELIVERED,
        providerMessageId: "msg-id-1@example.com",
        providerEventId: "mg_evt_1",
      });

      const hard = normalizeMailgunEvent({
        "event-data": { ...base, event: "failed", severity: "permanent", reason: "hard-bounce" },
      });
      expect(hard).toMatchObject({
        type: DeliveryEventType.BOUNCED,
        bounceType: "hard",
        reasonCode: "hard-bounce",
      });

      const soft = normalizeMailgunEvent({
        "event-data": { ...base, event: "failed", severity: "transient", reason: "temporary" },
      });
      expect(soft?.bounceType).toBe("soft");
    });

    it("maps opened/clicked/complained/unsubscribed", () => {
      expect(normalizeMailgunEvent({ "event-data": { ...base, event: "opened" } })?.type).toBe(
        DeliveryEventType.OPENED,
      );
      expect(
        normalizeMailgunEvent({
          "event-data": { ...base, event: "clicked", url: "https://y.com" },
        }),
      ).toMatchObject({
        type: DeliveryEventType.CLICKED,
        url: "https://y.com",
      });
      expect(normalizeMailgunEvent({ "event-data": { ...base, event: "complained" } })?.type).toBe(
        DeliveryEventType.COMPLAINED,
      );
      expect(
        normalizeMailgunEvent({ "event-data": { ...base, event: "unsubscribed" } })?.type,
      ).toBe(DeliveryEventType.UNSUBSCRIBED);
    });

    it("accepts a flat payload without the event-data wrapper", () => {
      const out = normalizeMailgunEvent({ ...base, event: "delivered" });
      expect(out?.type).toBe(DeliveryEventType.DELIVERED);
    });
  });

  describe("resend", () => {
    const base = {
      id: "evt_1",
      created_at: "2026-11-08T10:00:00Z",
      data: { email_id: "re_msg_1", to: ["user@example.com"] },
    };

    it("maps delivered and bounced", () => {
      expect(normalizeResendEvent({ ...base, type: "email.sent" })).toMatchObject({
        type: DeliveryEventType.SENT,
        providerEventId: "evt_1",
        providerMessageId: "re_msg_1",
      });
      expect(normalizeResendEvent({ ...base, type: "email.delivered" })?.type).toBe(
        DeliveryEventType.DELIVERED,
      );
      expect(
        normalizeResendEvent({
          ...base,
          type: "email.bounced",
          data: { ...base.data, bounceType: "Permanent" },
        }),
      ).toMatchObject({
        type: DeliveryEventType.BOUNCED,
        bounceType: "hard",
        reasonCode: "Permanent",
      });
      expect(
        normalizeResendEvent({
          ...base,
          type: "email.bounced",
          data: { ...base.data, bounceType: "Transient" },
        })?.bounceType,
      ).toBe("soft");
    });

    it("maps complained/opened/clicked/delivery_failed", () => {
      expect(normalizeResendEvent({ ...base, type: "email.complained" })?.type).toBe(
        DeliveryEventType.COMPLAINED,
      );
      expect(normalizeResendEvent({ ...base, type: "email.opened" })?.type).toBe(
        DeliveryEventType.OPENED,
      );
      expect(normalizeResendEvent({ ...base, type: "email.clicked" })?.type).toBe(
        DeliveryEventType.CLICKED,
      );
      expect(normalizeResendEvent({ ...base, type: "email.delivery_failed" })?.type).toBe(
        DeliveryEventType.DROPPED,
      );
      expect(normalizeResendEvent({ ...base, type: "email.delivery_delayed" })?.type).toBe(
        DeliveryEventType.DEFERRED,
      );
    });
  });

  describe("ses", () => {
    const base = {
      eventType: "Bounce",
      mail: {
        messageId: "ses_msg_1",
        timestamp: "2026-11-08T10:00:00Z",
        destination: ["user@example.com"],
      },
      bounce: { bounceType: "Permanent", diagnosticCode: "5.1.1" },
    };

    it("maps hard and soft bounces from bounceType", () => {
      expect(normalizeSesEvent(base)).toMatchObject({
        provider: "ses",
        type: DeliveryEventType.BOUNCED,
        bounceType: "hard",
        diagnostic: "5.1.1",
        providerMessageId: "ses_msg_1",
      });
      expect(
        normalizeSesEvent({ ...base, bounce: { bounceType: "Transient", diagnosticCode: "4.2.0" } })
          ?.bounceType,
      ).toBe("soft");
    });

    it("maps the remaining event types", () => {
      expect(normalizeSesEvent({ ...base, eventType: "Send" })?.type).toBe(DeliveryEventType.SENT);
      expect(normalizeSesEvent({ ...base, eventType: "Delivery" })?.type).toBe(
        DeliveryEventType.DELIVERED,
      );
      expect(normalizeSesEvent({ ...base, eventType: "Complaint" })?.type).toBe(
        DeliveryEventType.COMPLAINED,
      );
      expect(normalizeSesEvent({ ...base, eventType: "Open" })?.type).toBe(
        DeliveryEventType.OPENED,
      );
      expect(normalizeSesEvent({ ...base, eventType: "Click" })?.type).toBe(
        DeliveryEventType.CLICKED,
      );
      expect(
        normalizeSesEvent({ ...base, eventType: "Reject", reject: { reason: "denylisted" } }),
      ).toMatchObject({
        type: DeliveryEventType.DROPPED,
        reasonCode: "denylisted",
      });
      expect(normalizeSesEvent({ ...base, eventType: "Subscription" })?.type).toBe(
        DeliveryEventType.UNSUBSCRIBED,
      );
    });
  });
});
