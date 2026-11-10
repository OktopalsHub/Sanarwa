import { BadRequestException, Injectable, Inject, Logger } from "@nestjs/common";
import { BaseRepository } from "../../../common/database/repositories/base.repository";
import { BRAND_REPO } from "../brand.tokens";
import { Brand } from "../entities/brand.entity";
import { getBrandOrThrow } from "./brand-lookup";
import { validateDomainVerificationPrerequisites } from "./brand-validation";
import {
  BrandRecommendation,
  recommendationFailure,
  scoreToStatus,
  ScoredRecommendations,
} from "./brand-recommendations";
import { CloudflareDNSService } from "./cloudflare-dns.service";
import { ResendVerificationService } from "./resend-verification.service";

@Injectable()
export class BrandResendService {
  private readonly logger = new Logger(BrandResendService.name);

  constructor(
    @Inject(BRAND_REPO)
    private readonly brandRepository: BaseRepository<Brand>,
    private readonly resendVerificationService: ResendVerificationService,
    private readonly cloudflareDNSService: CloudflareDNSService,
  ) {}

  async getResendDomainVerificationInstructions(
    tenantId: string,
    id: string,
    domain?: string,
    resendApiKey?: string,
    cloudflareApiToken?: string,
  ): Promise<{
    domain: string;
    domainId?: string;
    instructions: {
      recordType: string;
      name: string;
      value: string;
      description: string;
      priority?: number;
    }[];
    cloudflareSetup?: {
      attempted: boolean;
      successful: boolean;
      recordsAdded: number;
      errors?: string[];
    };
    resendStatus?: {
      configured: boolean;
      error?: string;
    };
  }> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);
    const targetDomain = domain || brand.domain;

    if (!targetDomain) {
      throw new BadRequestException(
        "Domain must be specified either in the request or brand configuration",
      );
    }

    if (!resendApiKey) {
      throw new BadRequestException("Resend API key is required");
    }

    const resendStatus =
      await this.resendVerificationService.validateResendConfiguration(resendApiKey);
    if (!resendStatus.configured) {
      throw new BadRequestException(`Resend is not properly configured: ${resendStatus.error}`);
    }

    let verificationResult = await this.resendVerificationService.checkDomainVerificationStatus(
      targetDomain,
      resendApiKey,
    );

    if (verificationResult.status === "not_started") {
      verificationResult = await this.resendVerificationService.addDomain(
        targetDomain,
        resendApiKey,
      );

      if (!verificationResult.dnsRecords || verificationResult.dnsRecords.length === 0) {
        throw new BadRequestException(
          `Failed to add domain to Resend: ${verificationResult.error}`,
        );
      }

      const updateData: Partial<Brand> = {
        domain: targetDomain,
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            primary: targetDomain,
            resendDomainId: verificationResult.domainId,
            resendVerificationStatus: verificationResult.status,
            lastResendVerificationAttempt: new Date(),
          },
        },
      };
      await this.brandRepository.update(id, updateData);
    }

    const instructions = this.resendVerificationService.generateDomainVerificationInstructions(
      targetDomain,
      verificationResult.dnsRecords!,
    );

    let cloudflareSetup: any = undefined;

    if (cloudflareApiToken) {
      try {
        const cfValidation = await this.cloudflareDNSService.validateAPIToken(cloudflareApiToken);
        if (!cfValidation.valid) {
          cloudflareSetup = {
            attempted: true,
            successful: false,
            recordsAdded: 0,
            errors: [`Invalid Cloudflare API token: ${cfValidation.error}`],
          };
        } else {
          const zoneId = await this.cloudflareDNSService.getZoneId(
            targetDomain,
            cloudflareApiToken,
          );
          if (!zoneId) {
            cloudflareSetup = {
              attempted: true,
              successful: false,
              recordsAdded: 0,
              errors: [`Could not find Cloudflare zone for domain: ${targetDomain}`],
            };
          } else {
            const cfRecords = this.cloudflareDNSService.convertResendRecordsToCloudflare(
              verificationResult.dnsRecords!,
            );

            const addResult = await this.cloudflareDNSService.addDNSRecords(
              zoneId,
              cfRecords,
              cloudflareApiToken,
            );

            cloudflareSetup = {
              attempted: true,
              successful: addResult.failed.length === 0,
              recordsAdded: addResult.successful.length,
              errors: addResult.failed.map((f) => `${f.record.name}: ${f.error}`),
            };
          }
        }
      } catch (error) {
        cloudflareSetup = {
          attempted: true,
          successful: false,
          recordsAdded: 0,
          errors: [`Cloudflare setup failed: ${error.message}`],
        };
      }
    }

    return {
      domain: targetDomain,
      domainId: verificationResult.domainId,
      instructions: instructions.instructions,
      cloudflareSetup,
      resendStatus,
    };
  }

  async verifyResendDomain(
    tenantId: string,
    id: string,
    domain: string,
    resendApiKey: string,
  ): Promise<Brand> {
    const brand = await getBrandOrThrow(this.brandRepository, tenantId, id);

    validateDomainVerificationPrerequisites(brand, domain);

    const verificationResult = await this.resendVerificationService.checkDomainVerificationStatus(
      domain,
      resendApiKey,
    );

    if (!verificationResult.verified) {
      const updateData: Partial<Brand> = {
        domain,
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            primary: domain,
            resendVerified: false,
            resendVerificationStatus: verificationResult.status,
            resendDomainId: verificationResult.domainId,
            lastResendVerificationAttempt: new Date(),
            resendVerificationError: verificationResult.error,
          },
        },
      };

      await this.brandRepository.update(id, updateData);

      throw new BadRequestException(
        `Resend domain verification failed. Status: ${verificationResult.status}. ` +
          `Please ensure DNS records are properly configured. ` +
          `Error: ${verificationResult.error || "Domain not verified with Resend"}`,
      );
    }

    const updateData: Partial<Brand> = {
      domain,
      whiteLabelConfig: {
        ...brand.whiteLabelConfig,
        domains: {
          ...brand.whiteLabelConfig?.domains,
          primary: domain,
          resendVerified: true,
          resendVerifiedAt: new Date(),
          resendVerificationStatus: verificationResult.status,
          resendDomainId: verificationResult.domainId,
        },
      },
    };

    const updated = await this.brandRepository.update(id, updateData);
    return updated || brand;
  }

  async checkResendEmailCapability(
    tenantId: string,
    id: string,
    resendApiKey: string,
  ): Promise<{
    canSend: boolean;
    reason?: string;
    verificationStatus?: string;
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

    const emailCapability = await this.resendVerificationService.canSendEmails(
      brand.domain,
      resendApiKey,
    );

    if (!emailCapability.canSend) {
      return {
        canSend: false,
        reason: emailCapability.reason,
        verificationStatus: emailCapability.verificationStatus,
        recommendations: [
          "Verify your domain with Resend",
          "Add the required DNS records to your DNS provider",
          "Wait for DNS propagation (up to 72 hours)",
          "Consider using Cloudflare DNS auto-setup for easier configuration",
        ],
      };
    }

    return {
      canSend: true,
      verificationStatus: emailCapability.verificationStatus,
      recommendations: ["Your domain is ready for sending emails through Resend!"],
    };
  }

  async getResendEmailRecommendations(
    tenantId: string,
    brandId: string,
    resendApiKey?: string,
  ): Promise<ScoredRecommendations> {
    try {
      const brand = await getBrandOrThrow(this.brandRepository, tenantId, brandId);
      const recommendations: BrandRecommendation[] = [];

      let score = 0;

      if (brand.defaultFromEmail && brand.defaultFromName) {
        score += 30;
      } else {
        recommendations.push({
          priority: "high",
          title: "Complete Email Configuration",
          description: "Set default from email and name for consistent branding",
          action: "Update brand settings with defaultFromEmail and defaultFromName",
        });
      }

      if (brand.domain) {
        score += 20;
      } else {
        recommendations.push({
          priority: "high",
          title: "Add Domain Configuration",
          description: "Configure a custom domain for professional email sending",
          action: "Set domain in brand configuration",
        });
      }

      if (resendApiKey) {
        score += 10;
      } else {
        recommendations.push({
          priority: "high",
          title: "Provide Resend API Key",
          description: "API key is required for Resend domain verification",
          action: "Include resendApiKey in the request",
        });
      }

      if (resendApiKey && brand.domain) {
        try {
          const verificationResult =
            await this.resendVerificationService.checkDomainVerificationStatus(
              brand.domain,
              resendApiKey,
            );
          if (verificationResult.verified) {
            score += 30;
          } else {
            recommendations.push({
              priority: "high",
              title: "Verify Domain with Resend",
              description:
                "Domain verification improves deliverability and enables branded sending",
              action: "Complete Resend domain verification process",
            });
          }
        } catch {
          recommendations.push({
            priority: "high",
            title: "Check Resend Configuration",
            description: "Unable to verify domain status with Resend",
            action: "Verify your Resend API key and domain configuration",
          });
        }
      }

      return { status: scoreToStatus(score), score, recommendations };
    } catch (error) {
      this.logger.error(`Failed to get Resend email recommendations: ${error.message}`, error);
      return recommendationFailure();
    }
  }
}
