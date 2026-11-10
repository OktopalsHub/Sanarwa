import { Injectable, Logger } from "@nestjs/common";
import * as crypto from "crypto";

export interface SnsEnvelope {
  Type: string;
  MessageId: string;
  TopicArn: string;
  Message: string;
  Timestamp: string;
  SignatureVersion: string;
  Signature: string;
  SigningCertURL: string;
  Subject?: string;
  Token?: string;
  SubscribeURL?: string;
}

/**
 * Verifies Amazon SNS message signatures per the AWS specification: fetch
 * the signing certificate from the (allow-listed) `SigningCertURL`, then
 * verify the SHA-256 signature over the canonical string of signed fields.
 */
@Injectable()
export class SnsMessageVerifierService {
  private readonly logger = new Logger(SnsMessageVerifierService.name);
  private readonly certCache = new Map<string, crypto.KeyObject>();

  async verify(envelope: SnsEnvelope): Promise<boolean> {
    if (envelope.SignatureVersion !== "1") {
      this.logger.warn(`Unsupported SNS SignatureVersion: ${envelope.SignatureVersion}`);
      return false;
    }

    const certUrl = this.parseCertUrl(envelope.SigningCertURL);
    if (!certUrl) {
      this.logger.warn("SNS SigningCertURL failed the allow-list check");
      return false;
    }

    let key: crypto.KeyObject;
    try {
      key = await this.getCertificate(certUrl);
    } catch (error) {
      this.logger.warn(`Could not fetch SNS certificate: ${error.message}`);
      return false;
    }

    const canonical = this.canonicalString(envelope);
    try {
      const signature = Buffer.from(envelope.Signature, "base64");
      const verified = crypto.verify("sha256", Buffer.from(canonical, "utf8"), key, signature);
      if (!verified) {
        this.logger.warn("SNS message signature mismatch");
      }
      return verified;
    } catch (error) {
      this.logger.warn(`SNS signature verification failed: ${error.message}`);
      return false;
    }
  }

  private canonicalString(envelope: SnsEnvelope): string {
    const fields: string[] = [
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
      const value = envelope[field as keyof SnsEnvelope];
      if (value !== undefined && value !== null && value !== "") {
        canonical += `${field}\n${String(value)}\n`;
      }
    }
    return canonical;
  }

  private parseCertUrl(value: string): URL | null {
    try {
      const url = new URL(value);
      const host = url.hostname.toLowerCase();
      const allowed = host.endsWith(".amazonaws.com") && host.startsWith("sns.");
      if (url.protocol !== "https:" || !allowed) {
        return null;
      }
      return url;
    } catch {
      return null;
    }
  }

  private async getCertificate(url: URL): Promise<crypto.KeyObject> {
    const cached = this.certCache.get(url.href);
    if (cached) {
      return cached;
    }

    const response = await fetch(url.href, { signal: AbortSignal.timeout(5000) });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const pem = await response.text();
    const key = crypto.createPublicKey(pem);
    this.certCache.set(url.href, key);
    return key;
  }
}
