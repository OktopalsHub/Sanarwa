import * as crypto from "crypto";
import { UnauthorizedException } from "@nestjs/common";
import { EmailWebhookController } from "../controllers/email-webhook.controller";
import { WebhookValidatorService } from "../services/webhook-validator.service";
import { SnsEnvelope, SnsMessageVerifierService } from "../services/sns-message-verifier.service";
import { DeliveryEventType } from "../../messaging/enums/delivery-event-type.enum";

describe("EmailWebhookController", () => {
  let controller: EmailWebhookController;
  let events: { ingestProviderFeedback: ReturnType<typeof vi.fn> };
  let snsVerifier: SnsMessageVerifierService;
  let providerConfigRepository: {
    findActiveByTenantAndChannel: ReturnType<typeof vi.fn>;
  };
  let encryptionService: { decrypt: ReturnType<typeof vi.fn> };

  const TENANT_ID = "123e4567-e89b-12d3-a456-426614174000";

  beforeEach(() => {
    events = {
      ingestProviderFeedback: vi.fn(async () => ({ recorded: true, deliveryId: "delivery-1" })),
    };
    snsVerifier = new SnsMessageVerifierService();
    providerConfigRepository = {
      findActiveByTenantAndChannel: vi.fn(async () => []),
    };
    encryptionService = {
      decrypt: vi.fn(async (config: Record<string, unknown>) => config),
    };

    controller = new EmailWebhookController(
      new WebhookValidatorService(),
      events as any,
      snsVerifier,
      providerConfigRepository as any,
      encryptionService as any,
    );
  });

  function tenantConfig(providerId: string, config: Record<string, unknown>) {
    providerConfigRepository.findActiveByTenantAndChannel.mockResolvedValue([
      { providerId, config, isActive: true },
    ]);
  }

  describe("sendgrid", () => {
    it("rejects when the tenant has no webhookPublicKey configured (fail closed)", async () => {
      tenantConfig("sendgrid", { apiKey: "sg-key" });
      await expect(
        controller.sendgrid(TENANT_ID, [{ event: "delivered" }], Buffer.from("[]"), {
          headers: {},
        } as any),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      expect(events.ingestProviderFeedback).not.toHaveBeenCalled();
    });

    it("verifies against the tenant's own public key and ingests", async () => {
      const generated = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
      const publicKey = generated.publicKey.export({ type: "spki", format: "pem" }).toString();
      tenantConfig("sendgrid", { webhookPublicKey: publicKey });

      const payload = [
        {
          event: "bounce",
          email: "user@example.com",
          sg_event_id: "sg_1",
          sg_message_id: "msg_1",
          status: "5.1.1",
          reason: "nope",
          timestamp: 1700000000,
        },
      ];
      const timestamp = String(Math.floor(Date.now() / 1000));
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = crypto
        .sign("sha256", Buffer.concat([Buffer.from(timestamp), rawBody]), generated.privateKey)
        .toString("base64");
      const req = {
        headers: {
          "x-twilio-email-event-webhook-signature": signature,
          "x-twilio-email-event-webhook-timestamp": timestamp,
        },
      } as any;

      const result = await controller.sendgrid(TENANT_ID, payload as any, rawBody, req);

      expect(result.success).toBe(true);
      expect(events.ingestProviderFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "sendgrid",
          type: DeliveryEventType.BOUNCED,
          bounceType: "hard",
          providerEventId: "sg_1",
        }),
      );
    });
  });

  describe("mailgun", () => {
    it("verifies against the tenant's webhookSecret and ingests", async () => {
      tenantConfig("mailgun", { webhookSecret: "mailgun-secret" });
      const timestamp = String(Math.floor(Date.now() / 1000));
      const token = "tok";
      const payload = {
        "event-data": {
          event: "delivered",
          recipient: "user@example.com",
          id: "mg_1",
          timestamp: 1700000000,
          "message-headers": [{ name: "Message-ID", value: "msg_1" }],
        },
      };
      const rawBody = Buffer.from(JSON.stringify(payload));
      const signature = crypto
        .createHmac("sha256", "mailgun-secret")
        .update(`${timestamp}${token}`, "utf8")
        .digest("hex");
      const req = {
        headers: {
          "x-mailgun-signature": signature,
          "x-mailgun-timestamp": timestamp,
          "x-mailgun-token": token,
        },
      } as any;

      const result = await controller.mailgun(TENANT_ID, payload as any, rawBody, req);

      expect(result.success).toBe(true);
      expect(events.ingestProviderFeedback).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "mailgun", type: DeliveryEventType.DELIVERED }),
      );
    });
  });

  describe("ses", () => {
    it("verifies the SNS signature and stores the event (no tenant key needed)", async () => {
      vi.spyOn(snsVerifier, "verify").mockResolvedValue(true);

      const inner = JSON.stringify({
        eventType: "Bounce",
        mail: {
          messageId: "ses_msg_1",
          timestamp: "2026-11-08T10:00:00Z",
          destination: ["user@example.com"],
        },
        bounce: { bounceType: "Permanent", diagnosticCode: "5.1.1" },
      });
      const payload = {
        Type: "Notification",
        MessageId: "sns-1",
        TopicArn: "arn:aws:sns:us-east-1:123456789012:ses-events",
        Message: inner,
        Timestamp: new Date().toISOString(),
        SignatureVersion: "1",
        Signature: "",
        SigningCertURL: "https://sns.us-east-1.amazonaws.com/cert.pem",
      } as SnsEnvelope;

      const result = await controller.ses(payload);

      expect(result.success).toBe(true);
      expect(events.ingestProviderFeedback).toHaveBeenCalledWith(
        expect.objectContaining({
          provider: "ses",
          type: DeliveryEventType.BOUNCED,
          providerEventId: "sns-1",
        }),
      );
    });

    it("rejects envelopes with a bad signature", async () => {
      vi.spyOn(snsVerifier, "verify").mockResolvedValue(false);
      await expect(
        controller.ses({
          Type: "Notification",
          MessageId: "x",
          TopicArn: "arn:aws:sns:us-east-1:123456789012:t",
          Message: "{}",
          Timestamp: new Date().toISOString(),
          SignatureVersion: "1",
          Signature: "bad",
          SigningCertURL: "https://sns.us-east-1.amazonaws.com/c.pem",
        }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });
});
