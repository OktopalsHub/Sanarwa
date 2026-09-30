import { BadRequestException, Injectable, Inject } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { BaseRepository } from "../../../database/repositories/base.repository";
import { BRAND_REPO } from "../brand.tokens";
import { Brand } from "../entities/brand.entity";
import { ProviderConfig } from "../../provider/provider-config.entity";
import { getBrandOrThrow } from "./brand-lookup";
import {
  validateDomainVerificationPrerequisites,
  validateEmailVerificationPrerequisites,
} from "./brand-validation";
import { CloudflareDNSService } from "./cloudflare-dns.service";
import { DnsVerificationService } from "./dns-verification.service";
import { SESVerificationService } from "./ses-verification.service";

@Injectable()
export class BrandSesService {
  constructor(
    @Inject(BRAND_REPO)
    private readonly brandRepository: BaseRepository<Brand>,
    @InjectRepository(ProviderConfig)
    private readonly providerConfigRepository: Repository<ProviderConfig>,
    private readonly sesVerificationService: SESVerificationService,
    private readonly dnsVerificationService: DnsVerificationService,
    private readonly cloudflareDNSService: CloudflareDNSService,
  ) {}

  private async isBYOKTenant(tenantId: string): Promise<boolean> {
    // Check if tenant has any active BYOK provider for email channel
    // BYOK = tenant-provided SES/SendGrid/etc via provider_configs
    const count = await this.providerConfigRepository
      .createQueryBuilder("pc")
      .innerJoin("pc.project", "p")
      .innerJoin("p.tenant", "t")
      .where("t.id = :tenantId", { tenantId })
      .andWhere("pc.channel = :channel", { channel: NotificationChannel.EMAIL })
      .andWhere("pc.is_active = true")
      .getCount();
    return count > 0;
  }

  /**
   * Get SES domain verification instructions
   * Generic for any custom domain - supports optional Cloudflare auto-setup if token provided
   */
  async getSESDomainVerificationInstructions(
    tenantId: string,
    id: string,
    domain?: string,
    cloudflareApiToken?: string,
  ): Promise<{
    domain: string;
    verificationToken: string;
    instructions: {
      recordType: string;
      name: string;
      value: string;
      description: string;
    };
    domainHealth?: {
      hasMX: boolean;
      hasA: boolean;
      hasAAAA: boolean;
    };
    sesStatus?: {
      configured: boolean;
      region?: string;
      error?: string;
    };
    isManaged: boolean;
    isBYOK: boolean;
    cloudflareAvailable: boolean;
    cloudflareAutoSetup?: any;
  }> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);
    const targetDomain = domain || brand.domain;

    if (!targetDomain) {
      throw new BadRequestException(
        "Domain must be specified either in the request or brand configuration",
      );
    }

    // Check BYOK vs Managed - Cloudflare only for managed
    const isBYOK = await this.isBYOKTenant(tenantId);
    const isManaged = !isBYOK;
    const cloudflareAvailable = isManaged; // Hide CTA for BYOK

    // Validate SES configuration
    const sesStatus = await this.sesVerificationService.validateSESConfiguration();
    if (!sesStatus.configured) {
      throw new BadRequestException(`SES is not properly configured: ${sesStatus.error}`);
    }

    // Check if domain is already being verified or verified
    let verificationResult =
      await this.sesVerificationService.checkDomainVerificationStatus(targetDomain);

    // If domain is not in SES, start verification process
    if (verificationResult.status === "NotStarted") {
      verificationResult = await this.sesVerificationService.startDomainVerification(targetDomain);

      if (!verificationResult.verificationToken) {
        throw new BadRequestException(
          `Failed to start SES domain verification: ${verificationResult.error}`,
        );
      }

      // Save SES verification info to brand
      const updateData: Partial<Brand> = {
        domain: targetDomain,
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            primary: targetDomain,
            sesVerificationToken: verificationResult.verificationToken,
            sesVerificationStatus: verificationResult.status,
            lastSESVerificationAttempt: new Date(),
          },
        },
      };
      await this.brandRepository.update(id, updateData);
    }

    // Generate DNS instructions
    const instructions = this.sesVerificationService.generateDomainVerificationInstructions(
      targetDomain,
      verificationResult.verificationToken!,
    );

    // Generic Cloudflare auto-setup for any custom domain - ONLY for managed service
    let cloudflareAutoSetup: any = null;
    if (cloudflareApiToken) {
      if (isBYOK) {
        cloudflareAutoSetup = { attempted: false, successful: false, error: "BYOK tenants manage DNS themselves - Cloudflare auto only for managed service" };
      } else {
        try {
          const cfValidation = await this.cloudflareDNSService.validateAPIToken(cloudflareApiToken);
          if (!cfValidation.valid) {
            cloudflareAutoSetup = { attempted: true, successful: false, error: cfValidation.error };
          } else {
            const zoneId = await this.cloudflareDNSService.getZoneId(targetDomain, cloudflareApiToken);
            if (!zoneId) {
              cloudflareAutoSetup = { attempted: true, successful: false, error: `No Cloudflare zone for ${targetDomain}` };
            } else {
              const recordId = await this.cloudflareDNSService.addDNSRecord(
                zoneId,
                { type: instructions.instructions.recordType, name: instructions.instructions.name, content: instructions.instructions.value, ttl: 300, proxied: false },
                cloudflareApiToken,
              );
              cloudflareAutoSetup = recordId ? { attempted: true, successful: true, recordId, message: "TXT added via Cloudflare (managed)" } : { attempted: true, successful: false, error: "Failed to add TXT via Cloudflare" };
            }
          }
        } catch (error) {
          cloudflareAutoSetup = { attempted: true, successful: false, error: error.message };
        }
      }
    }

    // Check domain health
    const domainHealth = await this.dnsVerificationService.checkDomainHealth(targetDomain);

    return {
      domain: targetDomain,
      verificationToken: verificationResult.verificationToken!,
      instructions: instructions.instructions,
      domainHealth,
      sesStatus,
      isManaged,
      isBYOK,
      cloudflareAvailable,
      cloudflareAutoSetup: cloudflareAutoSetup || undefined,
    };
  }

  /**
   * Verify domain with AWS SES - generic custom domain with optional Cloudflare auto
   */
  async verifySESDomain(tenantId: string, id: string, domain: string, cloudflareApiToken?: string): Promise<Brand> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);

    // Validate prerequisites for domain verification
    validateDomainVerificationPrerequisites(brand, domain);

    // Check SES verification status
    const verificationResult =
      await this.sesVerificationService.checkDomainVerificationStatus(domain);

    if (!verificationResult.verified) {
      // Update brand with current status
      const updateData: Partial<Brand> = {
        domain,
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            primary: domain,
            sesVerified: false,
            sesVerificationStatus: verificationResult.status,
            sesVerificationToken: verificationResult.verificationToken,
            lastSESVerificationAttempt: new Date(),
            sesVerificationError: verificationResult.error,
          },
        },
      };

      await this.brandRepository.update(id, updateData);

      throw new BadRequestException(
        `SES domain verification failed. Status: ${verificationResult.status}. ` +
          `Please add the following TXT record to your DNS:\n` +
          `Name: _amazonses.${domain}\n` +
          `Value: ${verificationResult.verificationToken}\n` +
          `Error: ${verificationResult.error || "Domain not verified with SES"}`,
      );
    }

    // Domain verified successfully with SES
    const updateData: Partial<Brand> = {
      domain,
      whiteLabelConfig: {
        ...brand.whiteLabelConfig,
        domains: {
          ...brand.whiteLabelConfig?.domains,
          primary: domain,
          sesVerified: true,
          sesVerifiedAt: new Date(),
          sesVerificationStatus: verificationResult.status,
          sesVerificationToken: verificationResult.verificationToken,
        },
      },
    };

    const updated = await this.brandRepository.update(id, updateData);
    return updated || brand;
  }

  /**
   * Setup DKIM with AWS SES - generic custom domain with optional Cloudflare auto (managed only)
   */
  async setupSESDKIM(
    tenantId: string,
    id: string,
    cloudflareApiToken?: string,
  ): Promise<{
    brand: Brand;
    dkimInstructions: {
      domain: string;
      instructions: Array<{
        recordType: string;
        name: string;
        value: string;
        description: string;
      }>;
    };
    isManaged: boolean;
    isBYOK: boolean;
    cloudflareAvailable: boolean;
    cloudflareAutoSetup?: any;
  }> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);

    // Validate prerequisites
    validateEmailVerificationPrerequisites(brand, "DKIM");

    // Check if domain is verified with SES first
    if (!brand.whiteLabelConfig?.domains?.sesVerified) {
      throw new BadRequestException(
        "Domain must be verified with SES before setting up DKIM. Please verify your domain first.",
      );
    }

    // Enable DKIM with SES
    const dkimResult = await this.sesVerificationService.enableDKIM(brand.domain!);

    if (!dkimResult.enabled || !dkimResult.dkimTokens) {
      throw new BadRequestException(`Failed to enable DKIM with SES: ${dkimResult.error}`);
    }

    // Update brand with DKIM info
    const updateData: Partial<Brand> = {
      whiteLabelConfig: {
        ...brand.whiteLabelConfig,
        dkim: {
          ...brand.whiteLabelConfig.dkim,
          sesEnabled: true,
          sesVerified: dkimResult.verified,
          sesDkimTokens: dkimResult.dkimTokens,
          lastSESDkimAttempt: new Date(),
        },
      },
    };

    const updated = await this.brandRepository.update(id, updateData);

    // Generate DKIM DNS instructions
    const dkimInstructions = this.sesVerificationService.generateDKIMInstructions(
      brand.domain!,
      dkimResult.dkimTokens,
    );

    // Generic Cloudflare auto for custom domain DKIM - ONLY for managed service
    const isBYOK = await this.isBYOKTenant(tenantId);
    const isManaged = !isBYOK;
    const cloudflareAvailable = isManaged;
    let cloudflareAutoSetup: any = null;
    if (cloudflareApiToken) {
      if (isBYOK) {
        cloudflareAutoSetup = { attempted: false, successful: false, error: "BYOK tenants manage DKIM DNS themselves - Cloudflare auto only for managed service" };
      } else {
        try {
          const cfValidation = await this.cloudflareDNSService.validateAPIToken(cloudflareApiToken);
          if (!cfValidation.valid) {
            cloudflareAutoSetup = { attempted: true, successful: false, error: cfValidation.error };
          } else {
            const zoneId = await this.cloudflareDNSService.getZoneId(brand.domain!, cloudflareApiToken);
            if (!zoneId) {
              cloudflareAutoSetup = { attempted: true, successful: false, error: `No Cloudflare zone for ${brand.domain}` };
            } else {
              const records = dkimInstructions.instructions.map((inst) => ({ type: inst.recordType, name: inst.name, content: inst.value, ttl: 300, proxied: false }));
              const result = await this.cloudflareDNSService.addDNSRecords(zoneId, records as any, cloudflareApiToken);
              cloudflareAutoSetup = { attempted: true, successful: result.failed.length === 0, successfulRecords: result.successful, failedRecords: result.failed };
            }
          }
        } catch (error) {
          cloudflareAutoSetup = { attempted: true, successful: false, error: error.message };
        }
      }
    }

    return {
      brand: updated || brand,
      dkimInstructions,
      isManaged,
      isBYOK,
      cloudflareAvailable,
      cloudflareAutoSetup: cloudflareAutoSetup || undefined,
    };
  }

  /**
   * Check SES DKIM verification status
   */
  async checkSESDKIMStatus(
    tenantId: string,
    id: string,
  ): Promise<{
    brand: Brand;
    dkimStatus: {
      enabled: boolean;
      verified: boolean;
      dkimTokens?: string[];
      error?: string;
    };
  }> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);

    if (!brand.domain) {
      throw new BadRequestException("Domain must be set before checking DKIM status");
    }

    // Check DKIM status with SES
    const dkimStatus = await this.sesVerificationService.checkDKIMStatus(brand.domain);

    // Update brand with current DKIM status
    if (dkimStatus.enabled) {
      const updateData: Partial<Brand> = {
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          dkim: {
            ...brand.whiteLabelConfig?.dkim,
            sesEnabled: dkimStatus.enabled,
            sesVerified: dkimStatus.verified,
            sesDkimTokens: dkimStatus.dkimTokens,
            ...(dkimStatus.verified && { sesVerifiedAt: new Date() }),
          },
        },
      };

      const updated = await this.brandRepository.update(id, updateData);
      return {
        brand: updated || brand,
        dkimStatus,
      };
    }

    return {
      brand,
      dkimStatus,
    };
  }

  /**
   * Check if domain can send emails through SES
   */
  async checkSESEmailCapability(
    tenantId: string,
    id: string,
  ): Promise<{
    canSend: boolean;
    reason?: string;
    verificationStatus?: string;
    dkimStatus?: {
      enabled: boolean;
      verified: boolean;
    };
    recommendations?: string[];
  }> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);

    if (!brand.domain) {
      return {
        canSend: false,
        reason: "No domain configured",
        recommendations: ["Set a domain in your brand configuration"],
      };
    }

    // Check SES email capability
    const emailCapability = await this.sesVerificationService.canSendEmails(brand.domain);

    if (!emailCapability.canSend) {
      return {
        canSend: false,
        reason: emailCapability.reason,
        verificationStatus: emailCapability.verificationStatus,
        recommendations: [
          "Verify your domain with SES",
          "Add the required TXT record to your DNS",
          "Wait for DNS propagation (up to 72 hours)",
        ],
      };
    }

    // Check DKIM status for better deliverability
    const dkimStatus = await this.sesVerificationService.checkDKIMStatus(brand.domain);

    const recommendations: string[] = [];
    if (!dkimStatus.enabled) {
      recommendations.push("Enable DKIM for better email deliverability");
    } else if (!dkimStatus.verified) {
      recommendations.push("Complete DKIM setup by adding CNAME records to DNS");
    }

    return {
      canSend: true,
      verificationStatus: emailCapability.verificationStatus,
      dkimStatus: {
        enabled: dkimStatus.enabled,
        verified: dkimStatus.verified,
      },
      recommendations:
        recommendations.length > 0 ? recommendations : ["Your domain is ready for sending emails!"],
    };
  }
}
