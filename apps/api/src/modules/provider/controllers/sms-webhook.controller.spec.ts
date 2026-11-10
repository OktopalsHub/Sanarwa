import * as crypto from "crypto";
import { BadRequestException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { EventEmitter2 } from "@nestjs/event-emitter";
import { SMSWebhookController } from "./sms-webhook.controller";
import { WebhookValidatorService } from "../services/webhook-validator.service";
import { SmsWebhookIntakeService } from "../services/sms-webhook-intake.service";

describe("SMSWebhookController", () => {
  let controller: SMSWebhookController;
  let emitter: { emit: ReturnType<typeof vi.fn> };
  let config: ConfigService;

  const telnyxKeypair = crypto.generateKeyPairSync("ed25519");
  const telnyxPublicKey = telnyxKeypair.publicKey
    .export({ type: "spki", format: "pem" })
    .toString();

  const AT_SECRET = "at-webhook-secret";

  beforeEach(() => {
    emitter = { emit: vi.fn() };
    config = {
      get: vi.fn((key: string) => {
        if (key === "TELNYX_PUBLIC_KEY") return telnyxPublicKey;
        if (key === "AFRICASTALKING_WEBHOOK_SECRET") return AT_SECRET;
        if (key === "TERMII_WEBHOOK_SECRET") return "termii-secret";
        if (key === "INFOBIP_WEBHOOK_SECRET") return "infobip-secret";
        return undefined;
      }),
    } as unknown as ConfigService;

    const intake = new SmsWebhookIntakeService(
      emitter as unknown as EventEmitter2,
      new WebhookValidatorService(),
      config,
    );
    controller = new SMSWebhookController(intake);
  });

  function telnyxSignedReq(body: unknown) {
    const rawBody = JSON.stringify(body);
    const timestamp = String(Math.floor(Date.now() / 1000));
    const signature = crypto
      .sign(null, Buffer.from(`${timestamp}|${rawBody}`), telnyxKeypair.privateKey)
      .toString("base64");
    return {
      req: { rawBody: Buffer.from(rawBody) } as any,
      headers: {
        "telnyx-signature-ed25519": signature,
        "telnyx-timestamp": timestamp,
      },
    };
  }

  describe("telnyx inbound", () => {
    it("accepts a valid signed inbound webhook and emits event", async () => {
      const body = {
        data: {
          event_type: "message.received",
          id: "evt_1",
          occurred_at: "2026-11-10T10:00:00Z",
          payload: {
            id: "msg_1",
            from: { phone_number: "+15550001111" },
            to: [{ phone_number: "+15550002222" }],
            text: "hello",
            received_at: "2026-11-10T10:00:00Z",
          },
        },
      };
      const { req, headers } = telnyxSignedReq(body);

      const result = await controller.handleTelnyxInbound(
        req,
        body,
        headers["telnyx-signature-ed25519"],
        headers["telnyx-timestamp"],
      );

      expect(result).toEqual({ success: true });
      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.inbound.received",
        expect.objectContaining({
          messageId: "msg_1",
          from: "+15550001111",
          to: "+15550002222",
          provider: "telnyx",
        }),
      );
    });

    it("rejects when signature is invalid", async () => {
      const body = { data: { id: "evt_1", payload: { id: "msg_1" } } };
      const rawBody = JSON.stringify(body);
      await expect(
        controller.handleTelnyxInbound(
          { rawBody: Buffer.from(rawBody) } as any,
          body,
          "bad-signature",
          String(Math.floor(Date.now() / 1000)),
        ),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("telnyx status", () => {
    it("accepts a valid signed delivery status webhook and emits event", async () => {
      const body = {
        data: {
          event_type: "message.delivered",
          occurred_at: "2026-11-10T10:01:00Z",
          payload: { id: "msg_1", to: [{ phone_number: "+15550002222" }] },
        },
      };
      const { req, headers } = telnyxSignedReq(body);

      const result = await controller.handleTelnyxStatus(
        req,
        body,
        headers["telnyx-signature-ed25519"],
        headers["telnyx-timestamp"],
      );

      expect(result).toEqual({ success: true });
      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.status.updated",
        expect.objectContaining({ messageId: "msg_1", status: "delivered", provider: "telnyx" }),
      );
    });
  });

  describe("africastalking", () => {
    it("accepts valid secret for inbound and status", async () => {
      await controller.handleAfricasTalkingInbound(
        { id: "at1", from: "+254700000000", to: "12345", text: "hi" },
        { "x-africastalking-webhook-secret": AT_SECRET },
      );
      await controller.handleAfricasTalkingStatus(
        { id: "at-msg-1", status: "Success" },
        { "x-africastalking-webhook-secret": AT_SECRET },
      );

      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.inbound.received",
        expect.objectContaining({ provider: "africastalking", messageId: "at1" }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.status.updated",
        expect.objectContaining({ provider: "africastalking", status: "delivered" }),
      );
    });

    it("rejects invalid or missing secret", async () => {
      await expect(
        controller.handleAfricasTalkingInbound({ from: "+2547", to: "1" }, {}),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("BYOP providers", () => {
    it("accepts twilio inbound/status when global auth token is not configured", async () => {
      const byopIntake = new SmsWebhookIntakeService(
        emitter as unknown as EventEmitter2,
        new WebhookValidatorService(),
        { get: vi.fn(() => undefined) } as unknown as ConfigService,
      );
      const byopController = new SMSWebhookController(byopIntake);

      await expect(
        byopController.handleTwilioInbound(Buffer.from("Body=hi"), {
          MessageSid: "SM1",
          From: "+1",
          To: "+2",
          Body: "hi",
        }),
      ).resolves.toEqual({ success: true });
      await expect(
        byopController.handleTwilioStatus(Buffer.from("MessageStatus=delivered"), {
          MessageSid: "SM1",
          MessageStatus: "delivered",
        }),
      ).resolves.toEqual({ success: true });

      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.inbound.received",
        expect.objectContaining({ provider: "twilio", messageId: "SM1" }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.status.updated",
        expect.objectContaining({ provider: "twilio", status: "delivered" }),
      );
    });

    it("accepts termii and infobip webhooks when configured secret matches", async () => {
      await controller.handleTermiiInbound(
        { message_id: "t1", from: "+234", to: "1", text: "hi" },
        { "x-termii-webhook-secret": "termii-secret" },
      );
      await controller.handleTermiiStatus(
        { message_id: "t1", status: "Delivered" },
        { "x-termii-webhook-secret": "termii-secret" },
      );
      await controller.handleInfobipInbound(
        { results: [{ messageId: "i1", from: "+1", to: "+2", text: "hi" }] },
        { "x-infobip-webhook-secret": "infobip-secret" },
      );
      await controller.handleInfobipStatus(
        { results: [{ messageId: "i1", status: { name: "DELIVERED" } }] },
        { "x-infobip-webhook-secret": "infobip-secret" },
      );

      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.inbound.received",
        expect.objectContaining({ provider: "termii", messageId: "t1" }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.status.updated",
        expect.objectContaining({ provider: "termii", status: "delivered" }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.inbound.received",
        expect.objectContaining({ provider: "infobip", messageId: "i1" }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.status.updated",
        expect.objectContaining({ provider: "infobip", status: "delivered" }),
      );
    });

    it("rejects termii/infobip when configured secret is wrong", async () => {
      await expect(
        controller.handleTermiiInbound({ message_id: "t1" }, { "x-termii-webhook-secret": "bad" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
      await expect(
        controller.handleInfobipInbound({ results: [] }, { "x-infobip-webhook-secret": "bad" }),
      ).rejects.toBeInstanceOf(UnauthorizedException);
    });
  });

  describe("generic status", () => {
    it("routes telnyx and africastalking to verified handlers", async () => {
      const body = {
        data: {
          event_type: "message.sent",
          payload: { id: "msg_x", to: [{ phone_number: "+1" }] },
        },
      };
      const { req, headers } = telnyxSignedReq(body);
      await controller.handleGenericStatus(req, Buffer.from(""), "telnyx", body, headers as any);
      await controller.handleGenericStatus(
        {} as any,
        Buffer.from(""),
        "africastalking",
        { id: "at-msg-2", status: "Failed" },
        { "x-africastalking-webhook-secret": AT_SECRET },
      );

      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.status.updated",
        expect.objectContaining({ provider: "telnyx", messageId: "msg_x" }),
      );
      expect(emitter.emit).toHaveBeenCalledWith(
        "sms.status.updated",
        expect.objectContaining({ provider: "africastalking", status: "failed" }),
      );
    });

    it("rejects unsupported providers", async () => {
      await expect(
        controller.handleGenericStatus({} as any, Buffer.from(""), "unknown", {}, {}),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});
