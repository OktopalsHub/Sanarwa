import * as crypto from "crypto";
import { SnsEnvelope, SnsMessageVerifierService } from "../services/sns-message-verifier.service";

describe("SnsMessageVerifierService", () => {
  let service: SnsMessageVerifierService;
  let keys: { publicKey: string; privateKey: string };

  const sign = (envelope: Partial<SnsEnvelope>) => {
    const fields = [
      "Message",
      "MessageId",
      "SubscribeURL",
      "Subject",
      "Timestamp",
      "Token",
      "TopicArn",
      "Type",
    ];
    let canonical = "";
    for (const field of fields) {
      const value = (envelope as any)[field];
      if (value !== undefined && value !== null && value !== "") {
        canonical += `${field}\n${String(value)}\n`;
      }
    }
    return crypto
      .sign("sha256", Buffer.from(canonical, "utf8"), keys.privateKey)
      .toString("base64");
  };

  const envelope = (overrides: Partial<SnsEnvelope> = {}): SnsEnvelope => ({
    Type: "Notification",
    MessageId: "sns-1",
    TopicArn: "arn:aws:sns:us-east-1:123456789012:ses-events",
    Message: JSON.stringify({ eventType: "Delivery" }),
    Timestamp: new Date().toISOString(),
    SignatureVersion: "1",
    Signature: "",
    SigningCertURL: "https://sns.us-east-1.amazonaws.com/SimpleNotificationService-123.pem",
    ...overrides,
  });

  beforeEach(() => {
    service = new SnsMessageVerifierService();
    const generated = crypto.generateKeyPairSync("rsa", { modulusLength: 2048 });
    keys = {
      publicKey: generated.publicKey.export({ type: "spki", format: "pem" }).toString(),
      privateKey: generated.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    };
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        text: async () => keys.publicKey,
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("accepts a valid SNS signature", async () => {
    const env = envelope();
    env.Signature = sign(env);
    await expect(service.verify(env)).resolves.toBe(true);
  });

  it("rejects a tampered message", async () => {
    const env = envelope();
    env.Signature = sign(env);
    env.Message = JSON.stringify({ eventType: "Bounce" });
    await expect(service.verify(env)).resolves.toBe(false);
  });

  it("rejects certificates from non-AWS hosts (SSRF guard)", async () => {
    const env = envelope({ SigningCertURL: "https://evil.example.com/cert.pem" });
    env.Signature = sign(env);
    await expect(service.verify(env)).resolves.toBe(false);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("rejects non-https cert URLs", async () => {
    const env = envelope({ SigningCertURL: "http://sns.us-east-1.amazonaws.com/cert.pem" });
    env.Signature = sign(env);
    await expect(service.verify(env)).resolves.toBe(false);
  });

  it("rejects unsupported signature versions", async () => {
    const env = envelope({ SignatureVersion: "2" });
    env.Signature = sign(env);
    await expect(service.verify(env)).resolves.toBe(false);
  });
});
