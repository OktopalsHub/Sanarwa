import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";

export type WebhookProviderName =
  | "whatsapp"
  | "twilio"
  | "sendgrid"
  | "mailgun"
  | "telnyx"
  | "resend";

export type WebhookRejectionReason =
  | "secret-not-configured"
  | "signature-header-missing"
  | "signature-malformed"
  | "signature-mismatch"
  | "timestamp-stale"
  | "request-url-missing";

export interface WebhookVerificationRequest {
  provider: WebhookProviderName;
  secret?: string;
  publicKey?: string;
  rawBody: string;
  headers: Record<string, string | undefined>;
  url?: string;
}

export interface WebhookAccepted {
  readonly kind: "accepted";
  readonly provider: WebhookProviderName;
}

export interface WebhookRejected {
  readonly kind: "rejected";
  readonly provider: WebhookProviderName;
  readonly reason: WebhookRejectionReason;
}

export type WebhookVerification = WebhookAccepted | WebhookRejected;

const TIMESTAMP_TOLERANCE_SECONDS: Record<string, number> = {
  sendgrid: 300,
  mailgun: 900,
  resend: 300,
};

@Injectable()
export class WebhookValidatorService {
  private readonly logger = new Logger(WebhookValidatorService.name);

  verify(request: WebhookVerificationRequest): WebhookVerification {
    const { provider, secret, headers } = request;

    if (provider === "telnyx") {
      return request.publicKey
        ? this.verifyTelnyx(request, request.publicKey)
        : this.reject(provider, "secret-not-configured");
    }

    if (provider === "sendgrid") {
      return request.publicKey
        ? this.verifySendGrid(request, request.publicKey, headers)
        : this.reject(provider, "secret-not-configured");
    }

    if (!secret) {
      this.logger.error(`${provider} webhook secret is not configured; rejecting`);
      return this.reject(provider, "secret-not-configured");
    }

    switch (provider) {
      case "whatsapp":
        return this.verifyWhatsApp(request, secret);
      case "twilio":
        return this.verifyTwilio(request, secret);
      case "resend":
        return this.verifyResend(request, secret, headers);
      case "mailgun":
        return this.verifyMailgun(request, secret, headers);
      default:
        return this.reject(provider, "signature-malformed");
    }
  }

  private verifyTelnyx(
    request: WebhookVerificationRequest,
    publicKey: string,
  ): WebhookVerification {
    const signature = request.headers["telnyx-signature-ed25519"];
    const timestamp = request.headers["telnyx-timestamp"];

    if (!signature || !timestamp) {
      return this.reject("telnyx", "signature-header-missing");
    }

    const staleness = this.timestampAge(timestamp);
    if (staleness === null) {
      return this.reject("telnyx", "signature-malformed");
    }

    try {
      const key = crypto.createPublicKey(publicKey);
      const signedPayload = Buffer.from(`${timestamp}|${request.rawBody}`, "utf8");
      const presented = Buffer.from(signature, "base64");

      const verified = crypto.verify(null, signedPayload, key, presented);

      if (!verified) {
        this.logger.warn("telnyx webhook signature mismatch");
        return this.reject("telnyx", "signature-mismatch");
      }

      this.logger.debug("telnyx webhook signature verified");
      return { kind: "accepted", provider: "telnyx" };
    } catch (error) {
      this.logger.warn(`telnyx webhook signature could not be verified: ${error.message}`);
      return this.reject("telnyx", "signature-malformed");
    }
  }

  private verifyWhatsApp(request: WebhookVerificationRequest, secret: string): WebhookVerification {
    const presented = request.headers["x-hub-signature-256"];

    if (!presented) {
      return this.reject("whatsapp", "signature-header-missing");
    }

    return this.verifyHmac({
      provider: "whatsapp",
      secret,
      rawBody: request.rawBody,
      presented,
      prefix: "sha256",
    });
  }

  private verifyTwilio(
    request: WebhookVerificationRequest,
    authToken: string,
  ): WebhookVerification {
    const presented = request.headers["x-twilio-signature"];
    if (!presented) {
      return this.reject("twilio", "signature-header-missing");
    }

    if (!request.url) {
      return this.reject("twilio", "request-url-missing");
    }

    return this.verifyHmac({
      provider: "twilio",
      secret: authToken,
      rawBody: `${request.url}${request.rawBody}`,
      presented,
      algorithm: "sha1",
      encoding: "base64",
    });
  }

  private verifySendGrid(
    request: WebhookVerificationRequest,
    publicKey: string,
    headers: Record<string, string | undefined>,
  ): WebhookVerification {
    const presented = headers["x-twilio-email-event-webhook-signature"];
    const timestamp = headers["x-twilio-email-event-webhook-timestamp"];

    if (!presented || !timestamp) {
      return this.reject("sendgrid", "signature-header-missing");
    }

    const staleness = this.timestampAge(timestamp);
    if (staleness === null) {
      return this.reject("sendgrid", "signature-malformed");
    }

    if (staleness > TIMESTAMP_TOLERANCE_SECONDS.sendgrid) {
      return this.reject("sendgrid", "timestamp-stale");
    }

    try {
      const key = crypto.createPublicKey(publicKey);
      const signedPayload = Buffer.concat([
        Buffer.from(timestamp, "utf8"),
        Buffer.from(request.rawBody, "utf8"),
      ]);
      const signature = Buffer.from(presented, "base64");

      if (!crypto.verify("sha256", signedPayload, key, signature)) {
        this.logger.warn("sendgrid webhook signature mismatch");
        return this.reject("sendgrid", "signature-mismatch");
      }

      this.logger.debug("sendgrid webhook signature verified");
      return { kind: "accepted", provider: "sendgrid" };
    } catch (error) {
      this.logger.warn(`sendgrid webhook signature could not be verified: ${error.message}`);
      return this.reject("sendgrid", "signature-malformed");
    }
  }

  private verifyResend(
    request: WebhookVerificationRequest,
    secret: string,
    headers: Record<string, string | undefined>,
  ): WebhookVerification {
    const svixId = headers["svix-id"];
    const timestamp = headers["svix-timestamp"];
    const presented = headers["svix-signature"];

    if (!svixId || !timestamp || !presented) {
      return this.reject("resend", "signature-header-missing");
    }

    const staleness = this.timestampAge(timestamp);
    if (staleness === null) {
      return this.reject("resend", "signature-malformed");
    }

    if (staleness > TIMESTAMP_TOLERANCE_SECONDS.resend) {
      return this.reject("resend", "timestamp-stale");
    }

    let key: Buffer;
    try {
      const b64 = secret.startsWith("whsec_") ? secret.slice(6) : secret;
      key = Buffer.from(b64, "base64");
    } catch {
      return this.reject("resend", "signature-malformed");
    }

    const expected = crypto
      .createHmac("sha256", key)
      .update(`${svixId}.${timestamp}.${request.rawBody}`, "utf8")
      .digest("base64");

    const candidates = presented.split(/\s+/).map((entry) => {
      const comma = entry.indexOf(",");
      return comma >= 0 ? entry.slice(comma + 1) : entry;
    });

    if (!candidates.some((candidate) => this.constantTimeEquals(candidate, expected))) {
      this.logger.warn("resend webhook signature mismatch");
      return this.reject("resend", "signature-mismatch");
    }

    this.logger.debug("resend webhook signature verified");
    return { kind: "accepted", provider: "resend" };
  }

  private verifyMailgun(
    request: WebhookVerificationRequest,
    secret: string,
    headers: Record<string, string | undefined>,
  ): WebhookVerification {
    const presented = headers["x-mailgun-signature"];
    const timestamp = headers["x-mailgun-timestamp"];
    const token = headers["x-mailgun-token"];

    if (!presented || !timestamp || !token) {
      return this.reject("mailgun", "signature-header-missing");
    }

    const staleness = this.timestampAge(timestamp);
    if (staleness === null) {
      return this.reject("mailgun", "signature-malformed");
    }

    if (staleness > TIMESTAMP_TOLERANCE_SECONDS.mailgun) {
      return this.reject("mailgun", "timestamp-stale");
    }

    return this.verifyHmac({
      provider: "mailgun",
      secret,
      rawBody: `${timestamp}${token}`,
      presented,
    });
  }

  private verifyHmac(options: {
    provider: WebhookProviderName;
    secret: string;
    rawBody: string;
    presented: string;
    algorithm?: "sha1" | "sha256";
    prefix?: "sha1" | "sha256";
    encoding?: "hex" | "base64";
  }): WebhookVerification {
    const {
      provider,
      secret,
      rawBody,
      presented,
      prefix,
      encoding = "hex",
      algorithm = "sha256",
    } = options;

    let declaredAlgorithm = algorithm;
    let presentedSignature = presented;

    if (prefix) {
      const [fromHeader, ...rest] = presented.split("=");
      if (rest.length === 0) {
        return this.reject(provider, "signature-malformed");
      }
      if (fromHeader !== prefix) {
        this.logger.warn(
          `${provider} webhook presented unexpected signature algorithm: ${fromHeader}`,
        );
        return this.reject(provider, "signature-malformed");
      }
      declaredAlgorithm = prefix;
      presentedSignature = rest.join("=");
    }

    const digest = crypto
      .createHmac(declaredAlgorithm, secret)
      .update(rawBody, "utf8")
      .digest(encoding);

    if (!this.constantTimeEquals(presentedSignature, digest)) {
      this.logger.warn(`${provider} webhook signature mismatch`);
      return this.reject(provider, "signature-mismatch");
    }

    this.logger.debug(`${provider} webhook signature verified`);
    return { kind: "accepted", provider };
  }

  private timestampAge(timestamp: string): number | null {
    const presented = Number.parseInt(timestamp, 10);
    if (!Number.isFinite(presented)) {
      return null;
    }
    return Math.abs(Math.floor(Date.now() / 1000) - presented);
  }

  private constantTimeEquals(presented: string, expected: string): boolean {
    if (presented.length !== expected.length) {
      return false;
    }

    let mismatch = 0;
    for (let i = 0; i < presented.length; i++) {
      mismatch |= presented.charCodeAt(i) ^ expected.charCodeAt(i);
    }
    return mismatch === 0;
  }

  private reject(provider: WebhookProviderName, reason: WebhookRejectionReason): WebhookRejected {
    return { kind: "rejected", provider, reason };
  }
}
