import * as crypto from "crypto";
import { WebhookValidatorService } from "../webhook-validator.service";

describe("WebhookValidatorService", () => {
  let service: WebhookValidatorService;

  const WHATSAPP_SECRET = "whatsapp-app-secret";
  const TWILIO_TOKEN = "twilio-auth-token";
  const TELNYX_PUBLIC_KEY = "TELNYX_PUBLIC_KEY_PLACEHOLDER";

  let telnyxKeys: { publicKey: string; privateKey: string };

  const signHmac = (
    algorithm: "sha1" | "sha256",
    secret: string,
    payload: string,
    encoding: "hex" | "base64",
  ) => crypto.createHmac(algorithm, secret).update(payload, "utf8").digest(encoding);

  const signTelnyx = (timestamp: string, body: string) =>
    crypto
      .sign(null, Buffer.from(`${timestamp}|${body}`), telnyxKeys.privateKey)
      .toString("base64");

  beforeEach(() => {
    service = new WebhookValidatorService();
    const generated = crypto.generateKeyPairSync("ed25519");
    telnyxKeys = {
      publicKey: generated.publicKey.export({ type: "spki", format: "pem" }).toString(),
      privateKey: generated.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
  });

  describe("whatsapp", () => {
    const rawBody = JSON.stringify({ object: "whatsapp_business_account", entry: [] });
    const validSignature = `sha256=${signHmac("sha256", WHATSAPP_SECRET, rawBody, "hex")}`;

    const request = (headers: Record<string, string | undefined>) => ({
      provider: "whatsapp" as const,
      secret: WHATSAPP_SECRET,
      rawBody,
      headers,
    });

    it("accepts a valid sha256 signature", () => {
      const result = service.verify(request({ "x-hub-signature-256": validSignature }));
      expect(result.kind).toBe("accepted");
    });

    it("rejects a sha1-only signature instead of downgrading", () => {
      const sha1Only = `sha1=${signHmac("sha1", WHATSAPP_SECRET, rawBody, "hex")}`;
      const result = service.verify(request({ "x-hub-signature": sha1Only }));

      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-header-missing" });
    });

    it("rejects a signature over a tampered body", () => {
      const result = service.verify({
        ...request({ "x-hub-signature-256": validSignature }),
        rawBody: JSON.stringify({
          object: "whatsapp_business_account",
          entry: [{ id: "tampered" }],
        }),
      });
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-mismatch" });
    });

    it("rejects when the signature header is absent", () => {
      const result = service.verify(request({}));
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-header-missing" });
    });

    it("rejects when no secret is configured rather than accepting", () => {
      const result = service.verify({
        ...request({ "x-hub-signature-256": validSignature }),
        secret: undefined,
      });
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "secret-not-configured" });
    });

    it("rejects a signature whose algorithm prefix disagrees with the header", () => {
      const result = service.verify(
        request({
          "x-hub-signature-256": `sha1=${signHmac("sha1", WHATSAPP_SECRET, rawBody, "hex")}`,
        }),
      );
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-malformed" });
    });
  });

  describe("twilio", () => {
    const body = { MessageSid: "SM123", Body: "hello", From: "+15551234567" };
    const rawBody = new URLSearchParams(body).toString();
    const url = "https://api.sanarwa.com/api/v1/webhooks/sms/twilio/inbound";
    const validSignature = signHmac("sha1", TWILIO_TOKEN, url + rawBody, "base64");

    const request = (headers: Record<string, string | undefined>, body_ = body) => ({
      provider: "twilio" as const,
      secret: TWILIO_TOKEN,
      rawBody: new URLSearchParams(body_).toString(),
      url,
      headers,
      parsedBody: body_,
    });

    it("accepts a valid signature", () => {
      const result = service.verify(request({ "x-twilio-signature": validSignature }));
      expect(result.kind).toBe("accepted");
    });

    it("verifies the body exactly as received, so field order matters", () => {
      const reordered = { From: "+15551234567", Body: "hello", MessageSid: "SM123" };
      const reorderedRaw = new URLSearchParams(reordered).toString();
      const signatureForReordered = signHmac("sha1", TWILIO_TOKEN, url + reorderedRaw, "base64");
      const result = service.verify(
        request({ "x-twilio-signature": signatureForReordered }, reordered),
      );
      expect(result.kind).toBe("accepted");
    });

    it("rejects a signature computed over a differently ordered body", () => {
      const reordered = { From: "+15551234567", Body: "hello", MessageSid: "SM123" };
      const result = service.verify(request({ "x-twilio-signature": validSignature }, reordered));
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-mismatch" });
    });

    it("rejects when the callback url is missing", () => {
      const { url: _url, ...withoutUrl } = request({ "x-twilio-signature": validSignature });
      const result = service.verify(withoutUrl);
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "request-url-missing" });
    });

    it("rejects a signature computed against a different url", () => {
      const wrongUrl = "https://attacker.example.com/webhook";
      const signature = signHmac("sha1", TWILIO_TOKEN, wrongUrl + rawBody, "base64");
      const result = service.verify(request({ "x-twilio-signature": signature }));
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-mismatch" });
    });

    it("rejects when no auth token is configured", () => {
      const result = service.verify({
        ...request({ "x-twilio-signature": validSignature }),
        secret: undefined,
      });
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "secret-not-configured" });
    });
  });

  describe("sendgrid", () => {
    let ecKeys: { publicKey: string; privateKey: string };

    const rawBody = JSON.stringify([{ event: "delivered" }]);

    const signSendGrid = (timestamp: string, body: string) =>
      crypto
        .sign(
          "sha256",
          Buffer.concat([Buffer.from(timestamp, "utf8"), Buffer.from(body, "utf8")]),
          ecKeys.privateKey,
        )
        .toString("base64");

    const request = (headers: Record<string, string | undefined>) => ({
      provider: "sendgrid" as const,
      publicKey: ecKeys.publicKey,
      rawBody,
      headers,
    });

    beforeEach(() => {
      const generated = crypto.generateKeyPairSync("ec", { namedCurve: "prime256v1" });
      ecKeys = {
        publicKey: generated.publicKey.export({ type: "spki", format: "pem" }).toString(),
        privateKey: generated.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
      };
    });

    it("accepts a valid ECDSA signature within the tolerance window", () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const result = service.verify(
        request({
          "x-twilio-email-event-webhook-signature": signSendGrid(timestamp, rawBody),
          "x-twilio-email-event-webhook-timestamp": timestamp,
        }),
      );
      expect(result.kind).toBe("accepted");
    });

    it("rejects a signature over a tampered body", () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const result = service.verify({
        ...request({
          "x-twilio-email-event-webhook-signature": signSendGrid(
            timestamp,
            JSON.stringify([{ event: "bounced" }]),
          ),
          "x-twilio-email-event-webhook-timestamp": timestamp,
        }),
      });
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-mismatch" });
    });

    it("rejects a stale timestamp", () => {
      const result = service.verify(
        request({
          "x-twilio-email-event-webhook-signature": signSendGrid("1700000000", rawBody),
          "x-twilio-email-event-webhook-timestamp": "1700000000",
        }),
      );
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "timestamp-stale" });
    });

    it("rejects when headers are missing", () => {
      const result = service.verify(request({}));
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-header-missing" });
    });

    it("rejects when no public key is configured rather than accepting", () => {
      const timestamp = String(Math.floor(Date.now() / 1000));
      const result = service.verify({
        ...request({
          "x-twilio-email-event-webhook-signature": signSendGrid(timestamp, rawBody),
          "x-twilio-email-event-webhook-timestamp": timestamp,
        }),
        publicKey: undefined,
      });
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "secret-not-configured" });
    });
  });

  describe("resend", () => {
    const rawBody = JSON.stringify({ type: "email.delivered", data: { email_id: "re_123" } });
    const timestamp = String(Math.floor(Date.now() / 1000));
    const svixId = "msg_p5jv4Vf000hJWJB66CMGstr2N3LI";
    const resendSecret = `whsec_${Buffer.from("resend-secret-material").toString("base64")}`;

    const signResend = (id: string, ts: string, body: string) =>
      `v1,${crypto
        .createHmac("sha256", Buffer.from(resendSecret.slice(6), "base64"))
        .update(`${id}.${ts}.${body}`, "utf8")
        .digest("base64")}`;

    const request = (headers: Record<string, string | undefined>) => ({
      provider: "resend" as const,
      secret: resendSecret,
      rawBody,
      headers,
    });

    it("accepts a valid svix signature", () => {
      const result = service.verify(
        request({
          "svix-id": svixId,
          "svix-timestamp": timestamp,
          "svix-signature": signResend(svixId, timestamp, rawBody),
        }),
      );
      expect(result.kind).toBe("accepted");
    });

    it("rejects a signature over a tampered body", () => {
      const result = service.verify({
        ...request({
          "svix-id": svixId,
          "svix-timestamp": timestamp,
          "svix-signature": signResend(svixId, timestamp, JSON.stringify({ tampered: true })),
        }),
      });
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-mismatch" });
    });

    it("rejects a stale timestamp", () => {
      const result = service.verify(
        request({
          "svix-id": svixId,
          "svix-timestamp": "1700000000",
          "svix-signature": signResend(svixId, "1700000000", rawBody),
        }),
      );
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "timestamp-stale" });
    });

    it("rejects when headers are missing", () => {
      const result = service.verify(request({}));
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-header-missing" });
    });
  });

  describe("mailgun", () => {
    const timestamp = String(Math.floor(Date.now() / 1000));
    const token = "mailgun-token";
    const validSignature = signHmac("sha256", "mailgun-secret", `${timestamp}${token}`, "hex");
    const rawBody = JSON.stringify({ event: "delivered" });

    const request = (headers: Record<string, string | undefined>) => ({
      provider: "mailgun" as const,
      secret: "mailgun-secret",
      rawBody,
      headers,
    });

    it("accepts a valid signature", () => {
      const result = service.verify(
        request({
          "x-mailgun-signature": validSignature,
          "x-mailgun-timestamp": timestamp,
          "x-mailgun-token": token,
        }),
      );
      expect(result.kind).toBe("accepted");
    });

    it("rejects when the token is absent", () => {
      const result = service.verify(
        request({
          "x-mailgun-signature": validSignature,
          "x-mailgun-timestamp": timestamp,
        }),
      );
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-header-missing" });
    });
  });

  describe("telnyx", () => {
    const rawBody = JSON.stringify({ data: { id: "evt_1" } });
    const timestamp = String(Math.floor(Date.now() / 1000));

    const request = (headers: Record<string, string | undefined>) => ({
      provider: "telnyx" as const,
      publicKey: telnyxKeys.publicKey,
      rawBody,
      headers,
    });

    it("accepts a valid ed25519 signature", () => {
      const result = service.verify(
        request({
          "telnyx-signature-ed25519": signTelnyx(timestamp, rawBody),
          "telnyx-timestamp": timestamp,
        }),
      );
      expect(result.kind).toBe("accepted");
    });

    it("rejects a signature over a different body", () => {
      const result = service.verify(
        request({
          "telnyx-signature-ed25519": signTelnyx(
            timestamp,
            JSON.stringify({ data: { id: "evt_2" } }),
          ),
          "telnyx-timestamp": timestamp,
        }),
      );
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-mismatch" });
    });

    it("rejects when no public key is configured rather than accepting", () => {
      const result = service.verify({
        ...request({
          "telnyx-signature-ed25519": signTelnyx(timestamp, rawBody),
          "telnyx-timestamp": timestamp,
        }),
        publicKey: undefined,
      });
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "secret-not-configured" });
    });

    it("rejects a malformed key without throwing", () => {
      const result = service.verify({
        ...request({
          "telnyx-signature-ed25519": signTelnyx(timestamp, rawBody),
          "telnyx-timestamp": timestamp,
        }),
        publicKey: "not-a-real-key",
      });
      expect(result.kind).toBe("rejected");
    });

    it("rejects when the signature header is absent", () => {
      const result = service.verify(request({ "telnyx-timestamp": timestamp }));
      expect(result.kind).toBe("rejected");
      expect(result).toMatchObject({ reason: "signature-header-missing" });
    });
  });
});
