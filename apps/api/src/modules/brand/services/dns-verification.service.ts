import { Injectable, Logger } from "@nestjs/common";
import * as dns from "dns";
import { promisify } from "util";
import * as crypto from "crypto";

export interface DomainVerificationResult {
  verified: boolean;
  records?: string[];
  error?: string;
  verificationToken?: string;
}

const VERIFICATION_TOKEN_PREFIX = "sanarwa-verify=";

export interface DKIMVerificationResult {
  verified: boolean;
  selector?: string;
  publicKey?: string;
  error?: string;
}

export interface DMARCVerificationResult {
  verified: boolean;
  policy?: "none" | "quarantine" | "reject";
  percentage?: number;
  reportEmail?: string;
  error?: string;
}

@Injectable()
export class DnsVerificationService {
  private readonly logger = new Logger(DnsVerificationService.name);
  private readonly resolveTxt = promisify(dns.resolveTxt);

  async verifyDomainOwnership(
    domain: string,
    expectedToken: string,
  ): Promise<DomainVerificationResult> {
    try {
      const verificationDomain = `_verification.${domain}`;
      this.logger.log(`Verifying domain ownership for ${domain} using ${verificationDomain}`);

      const txtRecords = await this.resolveTxt(verificationDomain);
      const flatRecords = txtRecords.flat();

      this.logger.debug(`Found TXT records for ${verificationDomain}:`, flatRecords);

      const verified = flatRecords.some((record) => record.includes(expectedToken));

      return {
        verified,
        records: flatRecords,
        verificationToken: expectedToken,
      };
    } catch (error) {
      this.logger.warn(`Domain verification failed for ${domain}:`, error.message);
      return {
        verified: false,
        error: error.message,
        verificationToken: expectedToken,
      };
    }
  }

  async verifyDKIM(domain: string, selector: string = "default"): Promise<DKIMVerificationResult> {
    try {
      const dkimDomain = `${selector}._domainkey.${domain}`;
      this.logger.log(`Verifying DKIM for ${domain} using selector ${selector}`);

      const txtRecords = await this.resolveTxt(dkimDomain);
      const flatRecords = txtRecords.flat();

      this.logger.debug(`Found DKIM records for ${dkimDomain}:`, flatRecords);

      const dkimRecord = flatRecords.find((record) => record.includes("v=DKIM1"));

      if (!dkimRecord) {
        return {
          verified: false,
          error: `No valid DKIM record found for selector ${selector}`,
        };
      }

      const publicKeyMatch = dkimRecord.match(/p=([A-Za-z0-9+/=]+)/);
      const publicKey = publicKeyMatch ? publicKeyMatch[1] : undefined;

      return {
        verified: true,
        selector,
        publicKey,
      };
    } catch (error) {
      this.logger.warn(`DKIM verification failed for ${domain}:`, error.message);
      return {
        verified: false,
        selector,
        error: error.message,
      };
    }
  }

  async verifyDMARC(domain: string): Promise<DMARCVerificationResult> {
    try {
      const dmarcDomain = `_dmarc.${domain}`;
      this.logger.log(`Verifying DMARC for ${domain}`);

      const txtRecords = await this.resolveTxt(dmarcDomain);
      const flatRecords = txtRecords.flat();

      this.logger.debug(`Found DMARC records for ${dmarcDomain}:`, flatRecords);

      const dmarcRecord = flatRecords.find((record) => record.includes("v=DMARC1"));

      if (!dmarcRecord) {
        return {
          verified: false,
          error: "No valid DMARC record found",
        };
      }

      const policyMatch = dmarcRecord.match(/p=(none|quarantine|reject)/);
      const percentageMatch = dmarcRecord.match(/pct=(\d+)/);
      const reportEmailMatch = dmarcRecord.match(/rua=mailto:([^;]+)/);

      return {
        verified: true,
        policy: policyMatch ? (policyMatch[1] as "none" | "quarantine" | "reject") : undefined,
        percentage: percentageMatch ? parseInt(percentageMatch[1]) : undefined,
        reportEmail: reportEmailMatch ? reportEmailMatch[1] : undefined,
      };
    } catch (error) {
      this.logger.warn(`DMARC verification failed for ${domain}:`, error.message);
      return {
        verified: false,
        error: error.message,
      };
    }
  }

  generateVerificationToken(domain: string, brandId: string): string {
    const timestamp = Date.now();
    const hash = require("crypto")
      .createHash("sha256")
      .update(`${domain}-${brandId}-${timestamp}`)
      .digest("hex")
      .substring(0, 32);

    return `${VERIFICATION_TOKEN_PREFIX}${hash}`;
  }

  async checkMXRecords(domain: string): Promise<boolean> {
    try {
      const resolveMx = promisify(dns.resolveMx);
      const mxRecords = await resolveMx(domain);
      return mxRecords && mxRecords.length > 0;
    } catch (error) {
      this.logger.warn(`MX record check failed for ${domain}:`, error.message);
      return false;
    }
  }

  async checkDomainHealth(domain: string): Promise<{
    hasMX: boolean;
    hasA: boolean;
    hasAAAA: boolean;
    error?: string;
  }> {
    try {
      const resolveA = promisify(dns.resolve4);
      const resolveAAAA = promisify(dns.resolve6);
      const resolveMx = promisify(dns.resolveMx);

      const [aRecords, aaaaRecords, mxRecords] = await Promise.allSettled([
        resolveA(domain).catch(() => []),
        resolveAAAA(domain).catch(() => []),
        resolveMx(domain).catch(() => []),
      ]);

      return {
        hasA: aRecords.status === "fulfilled" && aRecords.value.length > 0,
        hasAAAA: aaaaRecords.status === "fulfilled" && aaaaRecords.value.length > 0,
        hasMX: mxRecords.status === "fulfilled" && mxRecords.value.length > 0,
      };
    } catch (error) {
      return {
        hasA: false,
        hasAAAA: false,
        hasMX: false,
        error: error.message,
      };
    }
  }

  async generateDKIMKeyPair(): Promise<{
    publicKey: string;
    privateKey: string;
  }> {
    return new Promise((resolve, reject) => {
      crypto.generateKeyPair(
        "rsa",
        {
          modulusLength: 2048,
          publicKeyEncoding: {
            type: "spki",
            format: "pem",
          },
          privateKeyEncoding: {
            type: "pkcs8",
            format: "pem",
          },
        },
        (err, publicKey, privateKey) => {
          if (err) {
            this.logger.error("Failed to generate DKIM key pair:", err);
            reject(err);
          } else {
            const publicKeyClean = publicKey
              .replace(/-----BEGIN PUBLIC KEY-----/, "")
              .replace(/-----END PUBLIC KEY-----/, "")
              .replace(/\s/g, "");

            resolve({
              publicKey: publicKeyClean,
              privateKey,
            });
          }
        },
      );
    });
  }
}
