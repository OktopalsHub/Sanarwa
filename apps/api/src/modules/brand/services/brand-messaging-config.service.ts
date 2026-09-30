import { Injectable, Inject, Logger } from "@nestjs/common";
import { BaseRepository } from "../../../database/repositories/base.repository";
import { BRAND_REPO } from "../brand.tokens";
import { Brand } from "../entities/brand.entity";
import { getBrandOrThrow } from "./brand-lookup";
import {
  BrandRecommendation,
  recommendationFailure,
  scoreToStatus,
  ScoredRecommendations,
} from "./brand-recommendations";

@Injectable()
export class BrandMessagingConfigService {
  private readonly logger = new Logger(BrandMessagingConfigService.name);

  constructor(
    @Inject(BRAND_REPO)
    private readonly brandRepository: BaseRepository<Brand>,
  ) {}

  /**
   * Get brand configuration for email sending (integrated branded email functionality)
   */
  async getBrandConfigForEmail(
    tenantId: string,
    brandId?: string,
  ): Promise<{
    brandConfig?: {
      defaultFromEmail?: string;
      defaultFromName?: string;
      domain?: string;
      verified?: boolean;
      dkimEnabled?: boolean;
    };
    canSend: boolean;
    reason?: string;
    recommendations?: string[];
  }> {
    try {
      const brand = await this.resolveBrand(tenantId, brandId);

      if (!brand) {
        return {
          canSend: true, // Can send with platform defaults
          reason: "No brand configured, using platform defaults",
          recommendations: ["Configure a brand for better email branding"],
        };
      }

      // Check if brand has email configuration
      if (!brand.defaultFromEmail || !brand.defaultFromName) {
        return {
          canSend: true, // Can send with platform defaults
          reason: "Brand missing email configuration, using platform defaults",
          recommendations: [
            "Set defaultFromEmail in brand configuration",
            "Set defaultFromName in brand configuration",
          ],
        };
      }

      // Check if domain is verified with SES
      const isVerified = brand.whiteLabelConfig?.domains?.sesVerified || false;
      const isDkimEnabled = brand.whiteLabelConfig?.dkim?.sesEnabled || false;

      const brandConfig = {
        defaultFromEmail: brand.defaultFromEmail,
        defaultFromName: brand.defaultFromName,
        domain: brand.domain,
        verified: isVerified,
        dkimEnabled: isDkimEnabled,
      };

      if (!isVerified && brand.domain) {
        return {
          brandConfig,
          canSend: true, // Can send but with warnings
          reason: "Domain not verified with SES",
          recommendations: [
            "Verify domain with SES for better deliverability",
            "Add required DNS records for domain verification",
          ],
        };
      }

      return {
        brandConfig,
        canSend: true,
        recommendations: isVerified
          ? ["Brand is properly configured for email sending"]
          : ["Consider verifying domain with SES for better deliverability"],
      };
    } catch (error) {
      this.logger.error(`Failed to get brand config for email: ${error.message}`, error);
      return {
        canSend: true, // Fallback to platform defaults
        reason: `Brand configuration error: ${error.message}`,
        recommendations: ["Using platform email defaults"],
      };
    }
  }

  /**
   * Get email sending recommendations for a brand
   */
  async getEmailRecommendations(tenantId: string, brandId: string): Promise<ScoredRecommendations> {
    try {
      const brand = await getBrandOrThrow(this.brandRepository, tenantId, brandId);
      const recommendations: BrandRecommendation[] = [];

      let score = 0;

      // Check basic configuration (30 points)
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

      // Check domain configuration (20 points)
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

      // Check SES verification (30 points)
      const isVerified = brand.whiteLabelConfig?.domains?.sesVerified || false;
      if (isVerified) {
        score += 30;
      } else {
        recommendations.push({
          priority: "high",
          title: "Verify Domain with SES",
          description: "Domain verification improves deliverability and reduces spam risk",
          action: "Complete SES domain verification process",
        });
      }

      // Check DKIM (20 points)
      const isDkimEnabled = brand.whiteLabelConfig?.dkim?.sesEnabled || false;
      const isDkimVerified = brand.whiteLabelConfig?.dkim?.sesVerified || false;

      if (isDkimEnabled && isDkimVerified) {
        score += 20;
      } else if (isDkimEnabled && !isDkimVerified) {
        score += 10;
        recommendations.push({
          priority: "medium",
          title: "Complete DKIM Setup",
          description: "DKIM is enabled but not verified. Add DNS records to complete setup",
          action: "Add DKIM CNAME records to your DNS",
        });
      } else {
        recommendations.push({
          priority: "medium",
          title: "Enable DKIM Authentication",
          description: "DKIM improves email authentication and deliverability",
          action: "Enable DKIM in brand settings and add DNS records",
        });
      }

      return { status: scoreToStatus(score), score, recommendations };
    } catch (error) {
      this.logger.error(`Failed to get email recommendations: ${error.message}`, error);
      return recommendationFailure();
    }
  }

  /**
   * Get push notification recommendations for a brand
   */
  async getPushRecommendations(tenantId: string, brandId: string): Promise<ScoredRecommendations> {
    try {
      const brand = await getBrandOrThrow(this.brandRepository, tenantId, brandId);
      const recommendations: BrandRecommendation[] = [];

      let score = 0;

      // Check brand name (20 points)
      if (brand.name) {
        score += 20;
      } else {
        recommendations.push({
          priority: "high",
          title: "Set Brand Name",
          description: "Brand name will be used in push notification titles",
          action: "Add brand name in brand settings",
        });
      }

      // Check brand colors (20 points)
      if (brand.primaryColor) {
        score += 20;
      } else {
        recommendations.push({
          priority: "medium",
          title: "Add Brand Colors",
          description: "Brand colors will be used in Android push notifications",
          action: "Set primary color in brand settings",
        });
      }

      // Check brand logo (20 points)
      if (brand.logo) {
        score += 20;
      } else {
        recommendations.push({
          priority: "medium",
          title: "Upload Brand Logo",
          description: "Brand logo will be used as push notification icon",
          action: "Upload logo in brand settings",
        });
      }

      // Check domain for deep linking (20 points)
      if (brand.domain) {
        score += 20;
      } else {
        recommendations.push({
          priority: "low",
          title: "Configure Domain",
          description: "Domain enables branded deep linking in push notifications",
          action: "Set domain in brand settings",
        });
      }

      // Check description for context (20 points)
      if (brand.description) {
        score += 20;
      } else {
        recommendations.push({
          priority: "low",
          title: "Add Brand Description",
          description: "Description helps with push notification context",
          action: "Add description in brand settings",
        });
      }

      return { status: scoreToStatus(score), score, recommendations };
    } catch (error) {
      this.logger.error(`Failed to get push recommendations: ${error.message}`, error);
      return recommendationFailure();
    }
  }

  /**
   * Get brand configuration for push notifications
   */
  async getBrandConfigForPush(
    tenantId: string,
    brandId?: string,
  ): Promise<{
    brandConfig?: {
      name?: string;
      primaryColor?: string;
      logo?: string;
      domain?: string;
    };
    canSend: boolean;
    reason?: string;
    recommendations?: string[];
  }> {
    try {
      const brand = await this.resolveBrand(tenantId, brandId);

      if (!brand) {
        return {
          canSend: true, // Can send with platform defaults
          reason: "No brand configured, using platform defaults",
          recommendations: ["Configure a brand for better push notification branding"],
        };
      }

      const brandConfig = {
        name: brand.name,
        primaryColor: brand.primaryColor,
        logo: brand.logo,
        domain: brand.domain,
      };

      const recommendations: string[] = [];

      if (!brand.name) {
        recommendations.push("Set brand name for better push notification titles");
      }

      if (!brand.primaryColor) {
        recommendations.push("Set primary color for Android push notification styling");
      }

      if (!brand.logo) {
        recommendations.push("Upload logo for push notification icons");
      }

      return {
        brandConfig,
        canSend: true,
        recommendations:
          recommendations.length > 0
            ? recommendations
            : ["Brand is configured for push notifications"],
      };
    } catch (error) {
      this.logger.error(`Failed to get brand config for push: ${error.message}`, error);
      return {
        canSend: true, // Fallback to platform defaults
        reason: `Brand configuration error: ${error.message}`,
        recommendations: ["Using platform push notification defaults"],
      };
    }
  }

  /**
   * Resolve the requested brand, or the tenant's most recent brand when no ID is given.
   * Falls back to null when the tenant has no brands at all.
   */
  private async resolveBrand(tenantId: string, brandId?: string): Promise<Brand | null> {
    if (brandId) {
      return getBrandOrThrow(this.brandRepository, tenantId, brandId);
    }

    const [brand] = await this.brandRepository.find({
      where: { tenant: { id: tenantId } },
      order: { createdAt: "DESC" },
      take: 1,
      relations: { tenant: true },
    });

    return brand ?? null;
  }
}
