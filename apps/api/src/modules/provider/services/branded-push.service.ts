import { Injectable, Logger } from "@nestjs/common";
import { BrandService } from "../../brand/brand.service";
import { PushPayload } from "../providers/push/push-provider.interface";

@Injectable()
export class BrandedPushService {
  private readonly logger = new Logger(BrandedPushService.name);

  constructor(private readonly brandService: BrandService) {}

  /**
   * Enhance push notification with brand configuration
   */
  async enhancePushWithBrand(
    tenantId: string,
    payload: PushPayload,
    brandId?: string,
  ): Promise<PushPayload> {
    try {
      // If no brand ID provided, try to find a default brand for the tenant
      if (!brandId) {
        const brands = await this.brandService.getBrands(tenantId, { limit: 1 });
        if (!brands.records || brands.records.length === 0) {
          this.logger.warn(
            `No brand found for tenant ${tenantId}, using default push configuration`,
          );
          return payload;
        }
        brandId = brands.records[0].id;
      }

      // Get brand configuration
      const brand = await this.brandService.getBrandById(tenantId, brandId!);

      // Enhance push notification with brand elements
      const enhancedPayload: PushPayload = {
        ...payload,
      };

      // Use brand name in title if not specified
      if (!payload.title && brand.name) {
        enhancedPayload.title = brand.name;
      }

      // Add brand colors and styling
      if (brand.primaryColor || brand.logo) {
        enhancedPayload.android = {
          ...payload.android,
          ...(brand.primaryColor && { color: brand.primaryColor }),
          ...(brand.logo && { icon: brand.logo }),
        };
      }

      // Add brand-specific deep linking
      if (brand.domain && !payload.deepLink) {
        enhancedPayload.deepLink = {
          url: `https://${brand.domain}/app`,
          fallbackUrl: `https://${brand.domain}`,
        };
      }

      // Add brand metadata
      enhancedPayload.data = {
        ...payload.data,
        brandId: brand.id,
        brandName: brand.name,
        ...(brand.domain && { brandDomain: brand.domain }),
      };

      this.logger.log(
        `Enhanced push notification with brand ${brandId} configuration for tenant ${tenantId}`,
      );
      return enhancedPayload;
    } catch (error) {
      this.logger.error(
        `Failed to enhance push notification with brand configuration: ${error.message}`,
        error,
      );
      // Return original payload if brand enhancement fails
      return payload;
    }
  }

  /**
   * Get push notification recommendations for a brand
   */
  async getPushRecommendations(
    tenantId: string,
    brandId: string,
  ): Promise<{
    status: "excellent" | "good" | "needs_improvement" | "poor";
    score: number;
    recommendations: Array<{
      priority: "high" | "medium" | "low";
      title: string;
      description: string;
      action: string;
    }>;
  }> {
    try {
      const brand = await this.brandService.getBrandById(tenantId, brandId);
      const recommendations: Array<{
        priority: "high" | "medium" | "low";
        title: string;
        description: string;
        action: string;
      }> = [];

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

      // Determine status based on score
      let status: "excellent" | "good" | "needs_improvement" | "poor";
      if (score >= 90) {
        status = "excellent";
      } else if (score >= 70) {
        status = "good";
      } else if (score >= 50) {
        status = "needs_improvement";
      } else {
        status = "poor";
      }

      return { status, score, recommendations };
    } catch (error) {
      this.logger.error(`Failed to get push recommendations: ${error.message}`, error);
      return {
        status: "poor",
        score: 0,
        recommendations: [
          {
            priority: "high",
            title: "Fix Brand Configuration",
            description: "Unable to analyze brand configuration due to an error",
            action: "Check brand settings and try again",
          },
        ],
      };
    }
  }

  /**
   * Create branded push notification template
   */
  createBrandedPushTemplate(brand: any, basePayload: Partial<PushPayload>): PushPayload {
    return {
      deviceTokens: [],
      title: brand.name || "Notification",
      body: "",
      ...basePayload,
      data: {
        ...basePayload.data,
        brandId: brand.id,
        brandName: brand.name,
      },
      android: {
        ...basePayload.android,
        ...(brand.primaryColor && { color: brand.primaryColor }),
        ...(brand.logo && { icon: brand.logo }),
        channelId: `${brand.id}_notifications`,
      },
      ios: {
        ...basePayload.ios,
        threadId: brand.id,
      },
      deepLink: {
        url: `https://${brand.domain || "app.example.com"}/notifications`,
        fallbackUrl: `https://${brand.domain || "example.com"}`,
        ...basePayload.deepLink,
      },
    };
  }
}
