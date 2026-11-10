import { BadRequestException, Injectable, Inject } from "@nestjs/common";
import { BaseRepository } from "../../../common/database/repositories/base.repository";
import { BRAND_REPO } from "../brand.tokens";
import { Brand } from "../entities/brand.entity";
import { getBrandOrThrow } from "./brand-lookup";
import {
  validateDomainVerificationPrerequisites,
  validateEmailVerificationPrerequisites,
} from "./brand-validation";
import { CloudflareDNSService } from "./cloudflare-dns.service";
import { DnsVerificationService } from "./dns-verification.service";

@Injectable()
export class BrandDomainService {
  constructor(
    @Inject(BRAND_REPO)
    private readonly brandRepository: BaseRepository<Brand>,
    private readonly dnsVerificationService: DnsVerificationService,
    private readonly cloudflareDNSService: CloudflareDNSService,
  ) {}

  async getDomainVerificationInstructions(
    tenantId: string,
    id: string,
    domain?: string,
  ): Promise<{
    domain: string;
    verificationToken: string;
    instructions: {
      recordType: string;
      name: string;
      value: string;
    };
    domainHealth?: {
      hasMX: boolean;
      hasA: boolean;
      hasAAAA: boolean;
    };
  }> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);
    const targetDomain = domain || brand.domain;

    if (!targetDomain) {
      throw new BadRequestException(
        "Domain must be specified either in the request or brand configuration",
      );
    }

    let verificationToken = brand.whiteLabelConfig?.domains?.verificationToken;
    if (!verificationToken) {
      verificationToken = this.dnsVerificationService.generateVerificationToken(targetDomain, id);

      const updateData: Partial<Brand> = {
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            verificationToken,
          },
        },
      };
      await this.brandRepository.update(id, updateData);
    }

    const domainHealth = await this.dnsVerificationService.checkDomainHealth(targetDomain);

    return {
      domain: targetDomain,
      verificationToken: verificationToken!,
      instructions: {
        recordType: "TXT",
        name: `_verification.${targetDomain}`,
        value: verificationToken!,
      },
      domainHealth,
    };
  }

  async verifyDomain(
    tenantId: string,
    id: string,
    domain: string,
    cloudflareApiToken?: string,
  ): Promise<Brand> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);

    validateDomainVerificationPrerequisites(brand, domain);

    let verificationToken = brand.whiteLabelConfig?.domains?.verificationToken;
    if (!verificationToken) {
      verificationToken = this.dnsVerificationService.generateVerificationToken(domain, id);
    }

    let cloudflareSetupResult: any = null;
    if (cloudflareApiToken) {
      try {
        const cfValidation = await this.cloudflareDNSService.validateAPIToken(cloudflareApiToken);
        if (!cfValidation.valid) {
          cloudflareSetupResult = {
            attempted: true,
            successful: false,
            error: `Invalid Cloudflare API token: ${cfValidation.error}`,
          };
        } else {
          const zoneId = await this.cloudflareDNSService.getZoneId(domain, cloudflareApiToken);
          if (!zoneId) {
            cloudflareSetupResult = {
              attempted: true,
              successful: false,
              error: `Could not find Cloudflare zone for domain: ${domain}`,
            };
          } else {
            const cfRecord = {
              type: "TXT",
              name: `_verification.${domain}`,
              content: verificationToken,
              ttl: 300,
              proxied: false,
            };

            const recordId = await this.cloudflareDNSService.addDNSRecord(
              zoneId,
              cfRecord,
              cloudflareApiToken,
            );
            if (recordId) {
              cloudflareSetupResult = {
                attempted: true,
                successful: true,
                recordId,
                message: "DNS record added automatically via Cloudflare",
              };
            } else {
              cloudflareSetupResult = {
                attempted: true,
                successful: false,
                error: "Failed to add DNS record to Cloudflare",
              };
            }
          }
        }
      } catch (error) {
        cloudflareSetupResult = {
          attempted: true,
          successful: false,
          error: `Cloudflare setup failed: ${error.message}`,
        };
      }
    }

    const verificationResult = await this.dnsVerificationService.verifyDomainOwnership(
      domain,
      verificationToken,
    );

    if (!verificationResult.verified) {
      const updateData: Partial<Brand> = {
        domain,
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            primary: domain,
            verified: false,
            verificationToken,
            lastVerificationAttempt: new Date(),
            verificationError: verificationResult.error,
            cloudflareAutoSetup: cloudflareSetupResult,
          },
        },
      };

      await this.brandRepository.update(id, updateData);

      let errorMessage = `Domain verification failed. `;
      if (cloudflareSetupResult?.successful) {
        errorMessage += `DNS record was added automatically, but verification is still pending. Please wait a few minutes for DNS propagation.\n`;
      } else {
        errorMessage +=
          `Please add the following TXT record to your DNS:\n` +
          `Name: _verification.${domain}\n` +
          `Value: ${verificationToken}\n`;
      }
      errorMessage += `Error: ${verificationResult.error || "Verification record not found"}`;

      throw new BadRequestException(errorMessage);
    }

    const updateData: Partial<Brand> = {
      domain,
      whiteLabelConfig: {
        ...brand.whiteLabelConfig,
        domains: {
          ...brand.whiteLabelConfig?.domains,
          primary: domain,
          verified: true,
          verifiedAt: new Date(),
          verificationToken,
        },
      },
    };

    const updated = await this.brandRepository.update(id, updateData);
    return updated || brand;
  }

  async verifyDKIM(
    tenantId: string,
    id: string,
    selector: string = "default",
    cloudflareApiToken?: string,
  ): Promise<Brand> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);

    validateEmailVerificationPrerequisites(brand, "DKIM");

    let publicKey = brand.whiteLabelConfig?.dkim?.publicKey;
    let privateKey = brand.whiteLabelConfig?.dkim?.privateKey;

    if (!publicKey || !privateKey) {
      const keyPair = await this.dnsVerificationService.generateDKIMKeyPair();
      publicKey = keyPair.publicKey;
      privateKey = keyPair.privateKey;
    }

    let cloudflareDkimSetupResult: any = null;
    if (cloudflareApiToken) {
      try {
        const cfValidation = await this.cloudflareDNSService.validateAPIToken(cloudflareApiToken);
        if (!cfValidation.valid) {
          cloudflareDkimSetupResult = {
            attempted: true,
            successful: false,
            error: `Invalid Cloudflare API token: ${cfValidation.error}`,
          };
        } else {
          const zoneId = await this.cloudflareDNSService.getZoneId(
            brand.domain!,
            cloudflareApiToken,
          );
          if (!zoneId) {
            cloudflareDkimSetupResult = {
              attempted: true,
              successful: false,
              error: `Could not find Cloudflare zone for domain: ${brand.domain}`,
            };
          } else {
            const cfRecord = {
              type: "CNAME",
              name: `${selector}._domainkey.${brand.domain}`,
              content: `${selector}._domainkey.${brand.domain}`,
              ttl: 300,
              proxied: false,
            };

            const recordId = await this.cloudflareDNSService.addDNSRecord(
              zoneId,
              cfRecord,
              cloudflareApiToken,
            );
            if (recordId) {
              cloudflareDkimSetupResult = {
                attempted: true,
                successful: true,
                recordId,
                selector,
                message: "DKIM CNAME record added automatically via Cloudflare",
              };
            } else {
              cloudflareDkimSetupResult = {
                attempted: true,
                successful: false,
                error: "Failed to add DKIM CNAME record to Cloudflare",
              };
            }
          }
        }
      } catch (error) {
        cloudflareDkimSetupResult = {
          attempted: true,
          successful: false,
          error: `Cloudflare DKIM setup failed: ${error.message}`,
        };
      }
    }

    const verificationResult = await this.dnsVerificationService.verifyDKIM(
      brand.domain!,
      selector,
    );

    if (!brand.whiteLabelConfig) {
      brand.whiteLabelConfig = {};
    }

    if (!brand.whiteLabelConfig.dkim) {
      brand.whiteLabelConfig.dkim = {};
    }

    if (!verificationResult.verified) {
      brand.whiteLabelConfig.dkim.verified = false;
      brand.whiteLabelConfig.dkim.selector = selector;
      brand.whiteLabelConfig.dkim.lastVerificationAttempt = new Date();
      brand.whiteLabelConfig.dkim.verificationError = verificationResult.error;
      brand.whiteLabelConfig.dkim.publicKey = publicKey;
      brand.whiteLabelConfig.dkim.privateKey = privateKey;
      brand.whiteLabelConfig.dkim.cloudflareAutoSetup = cloudflareDkimSetupResult;

      await this.brandRepository.update(id, brand);

      let errorMessage = `DKIM verification failed for selector "${selector}". `;
      if (cloudflareDkimSetupResult?.successful) {
        errorMessage += `DKIM record was added automatically, but verification is still pending. Please wait a few minutes for DNS propagation.\n`;
      } else {
        errorMessage +=
          `Please add the DKIM DNS record:\n` +
          `Name: ${selector}._domainkey.${brand.domain}\n` +
          `Type: CNAME\n` +
          `Value: ${selector}._domainkey.${brand.domain}\n`;
      }
      errorMessage += `Error: ${verificationResult.error || "DKIM record not found or invalid"}`;

      throw new BadRequestException(errorMessage);
    }

    brand.whiteLabelConfig.dkim.verified = true;
    brand.whiteLabelConfig.dkim.verifiedAt = new Date();
    brand.whiteLabelConfig.dkim.selector = selector;
    brand.whiteLabelConfig.dkim.publicKey = publicKey;
    brand.whiteLabelConfig.dkim.privateKey = privateKey;
    brand.whiteLabelConfig.dkim.cloudflareAutoSetup = cloudflareDkimSetupResult;

    const updated = await this.brandRepository.update(id, brand);
    return updated || brand;
  }

  async verifyDMARC(tenantId: string, id: string): Promise<Brand> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);

    validateEmailVerificationPrerequisites(brand, "DMARC");

    if (!brand.whiteLabelConfig?.domains?.verified) {
      throw new BadRequestException(
        "Domain must be verified before DMARC verification. Please verify your domain first.",
      );
    }

    const verificationResult = await this.dnsVerificationService.verifyDMARC(brand.domain!);

    if (!brand.whiteLabelConfig) {
      brand.whiteLabelConfig = {};
    }

    if (!brand.whiteLabelConfig.dmarc) {
      brand.whiteLabelConfig.dmarc = {};
    }

    if (!verificationResult.verified) {
      brand.whiteLabelConfig.dmarc.verified = false;
      brand.whiteLabelConfig.dmarc.lastVerificationAttempt = new Date();
      brand.whiteLabelConfig.dmarc.verificationError = verificationResult.error;

      await this.brandRepository.update(id, brand);

      throw new BadRequestException(
        `DMARC verification failed. Please ensure you have added the DMARC DNS record:\n` +
          `Name: _dmarc.${brand.domain}\n` +
          `Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@${brand.domain}\n` +
          `Error: ${verificationResult.error || "DMARC record not found or invalid"}`,
      );
    }

    brand.whiteLabelConfig.dmarc.verified = true;
    brand.whiteLabelConfig.dmarc.verifiedAt = new Date();
    brand.whiteLabelConfig.dmarc.policy = verificationResult.policy;
    brand.whiteLabelConfig.dmarc.percentage = verificationResult.percentage;
    brand.whiteLabelConfig.dmarc.reportEmail = verificationResult.reportEmail;

    const updated = await this.brandRepository.update(id, brand);
    return updated || brand;
  }
}
