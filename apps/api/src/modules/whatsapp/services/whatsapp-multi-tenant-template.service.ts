import { Injectable, Logger, BadRequestException } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import axios from "axios";
import { WABAConfig } from "../entities/waba-config.entity";
import { TenantWABAConfig } from "../entities/tenant-waba-config.entity";
import { WhatsAppEmbeddedSignupService } from "./whatsapp-embedded-signup.service";

export interface TemplateCreationRequest {
  tenantId: string;
  templateName: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  language: string;
  components: TemplateComponent[];
}

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
  text?: string;
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  example?: {
    header_text?: string[];
    body_text?: string[][];
  };
  buttons?: Array<{
    type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER";
    text: string;
    url?: string;
    phone_number?: string;
  }>;
}

export interface TemplateUsageStats {
  tenantId: string;
  totalTemplates: number;
  approvedTemplates: number;
  pendingTemplates: number;
  rejectedTemplates: number;
  templateLimit: number;
  remainingCapacity: number;
  utilizationRate: number;
  recentActivity: Array<{
    templateName: string;
    status: string;
    createdAt: Date;
    lastUsed?: Date;
    usageCount: number;
  }>;
}

@Injectable()
export class WhatsAppMultiTenantTemplateService {
  private readonly logger = new Logger(WhatsAppMultiTenantTemplateService.name);
  private readonly metaApiUrl = "https://graph.facebook.com/v18.0";

  constructor(
    @InjectRepository(WABAConfig)
    private wabaConfigRepository: Repository<WABAConfig>,
    @InjectRepository(TenantWABAConfig)
    private tenantWabaConfigRepository: Repository<TenantWABAConfig>,
    private embeddedSignupService: WhatsAppEmbeddedSignupService,
    private configService: ConfigService,
  ) {}

  async createTemplate(request: {
    tenantId: string;
    name: string;
    category: string;
    language: string;
    components: any[];
  }): Promise<{ id: string; status: string }> {
    const templateRequest: TemplateCreationRequest = {
      tenantId: request.tenantId,
      templateName: request.name,
      category: request.category as "AUTHENTICATION" | "MARKETING" | "UTILITY",
      language: request.language,
      components: request.components,
    };

    const result = await this.createTenantTemplate(templateRequest);
    return {
      id: result.templateId,
      status: result.status,
    };
  }

  async getTenantTemplates(tenantId: string): Promise<any[]> {
    return this.listTenantTemplates(tenantId);
  }

  async deleteTemplate(tenantId: string, templateId: string): Promise<{ success: boolean }> {
    const result = await this.deleteTenantTemplate(tenantId, templateId);
    return { success: result.success };
  }

  async createTenantTemplate(request: TemplateCreationRequest): Promise<{
    templateId: string;
    status: string;
    message: string;
  }> {
    try {
      const tenantWaba = await this.embeddedSignupService.getTenantWABA(request.tenantId);
      if (!tenantWaba) {
        throw new BadRequestException(
          "Tenant does not have a WhatsApp Business Account. Please complete embedded signup first.",
        );
      }

      const canCreate = await this.embeddedSignupService.canCreateTemplate(request.tenantId);
      if (!canCreate) {
        throw new BadRequestException(
          "Template limit reached for this tenant. Consider optimizing existing templates.",
        );
      }

      const templateResponse = await this.createMetaTemplate(
        tenantWaba.waba.businessAccountId,
        tenantWaba.accessToken || tenantWaba.waba.accessToken,
        request,
      );

      await this.wabaConfigRepository.increment({ id: tenantWaba.waba.id }, "templateCount", 1);

      await this.recordTemplateCreation(tenantWaba.id, request.templateName, templateResponse.id);

      this.logger.log(
        `Created template ${request.templateName} for tenant ${request.tenantId} in WABA ${tenantWaba.waba.id}`,
      );

      return {
        templateId: templateResponse.id,
        status: templateResponse.status,
        message: `Template created successfully in your dedicated WhatsApp Business Account. ${
          templateResponse.status === "PENDING"
            ? "Template is under review by Meta and will be available once approved."
            : "Template is ready to use."
        }`,
      };
    } catch (error) {
      this.logger.error(`Failed to create template for tenant ${request.tenantId}`, error);
      throw error;
    }
  }

  async getTenantTemplateUsage(tenantId: string): Promise<TemplateUsageStats> {
    const tenantWaba = await this.embeddedSignupService.getTenantWABA(tenantId);
    if (!tenantWaba) {
      return {
        tenantId,
        totalTemplates: 0,
        approvedTemplates: 0,
        pendingTemplates: 0,
        rejectedTemplates: 0,
        templateLimit: 0,
        remainingCapacity: 0,
        utilizationRate: 0,
        recentActivity: [],
      };
    }

    const templates = await this.getMetaTemplates(
      tenantWaba.waba.businessAccountId,
      tenantWaba.accessToken || tenantWaba.waba.accessToken,
    );

    const approvedTemplates = templates.filter((t) => t.status === "APPROVED").length;
    const pendingTemplates = templates.filter((t) => t.status === "PENDING").length;
    const rejectedTemplates = templates.filter((t) => t.status === "REJECTED").length;
    const totalTemplates = templates.length;
    const templateLimit = tenantWaba.waba.maxTemplates;
    const remainingCapacity = templateLimit - totalTemplates;
    const utilizationRate = (totalTemplates / templateLimit) * 100;

    return {
      tenantId,
      totalTemplates,
      approvedTemplates,
      pendingTemplates,
      rejectedTemplates,
      templateLimit,
      remainingCapacity,
      utilizationRate,
      recentActivity: templates.slice(0, 10).map((template) => ({
        templateName: template.name,
        status: template.status,
        createdAt: new Date(template.created_time * 1000),
        lastUsed: template.last_used ? new Date(template.last_used * 1000) : undefined,
        usageCount: template.usage_count || 0,
      })),
    };
  }

  async listTenantTemplates(
    tenantId: string,
    filters?: {
      status?: string;
      category?: string;
      language?: string;
    },
  ): Promise<
    Array<{
      id: string;
      name: string;
      status: string;
      category: string;
      language: string;
      components: any[];
      createdAt: Date;
      lastUsed?: Date;
      usageCount: number;
    }>
  > {
    const tenantWaba = await this.embeddedSignupService.getTenantWABA(tenantId);
    if (!tenantWaba) {
      return [];
    }

    const templates = await this.getMetaTemplates(
      tenantWaba.waba.businessAccountId,
      tenantWaba.accessToken || tenantWaba.waba.accessToken,
      filters,
    );

    return templates.map((template) => ({
      id: template.id,
      name: template.name,
      status: template.status,
      category: template.category,
      language: template.language,
      components: template.components,
      createdAt: new Date(template.created_time * 1000),
      lastUsed: template.last_used ? new Date(template.last_used * 1000) : undefined,
      usageCount: template.usage_count || 0,
    }));
  }

  async deleteTenantTemplate(
    tenantId: string,
    templateId: string,
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const tenantWaba = await this.embeddedSignupService.getTenantWABA(tenantId);
      if (!tenantWaba) {
        throw new BadRequestException("Tenant does not have a WhatsApp Business Account");
      }

      await this.deleteMetaTemplate(
        templateId,
        tenantWaba.accessToken || tenantWaba.waba.accessToken,
      );

      await this.wabaConfigRepository.decrement({ id: tenantWaba.waba.id }, "templateCount", 1);

      this.logger.log(`Deleted template ${templateId} for tenant ${tenantId}`);

      return {
        success: true,
        message: "Template deleted successfully",
      };
    } catch (error) {
      this.logger.error(`Failed to delete template ${templateId} for tenant ${tenantId}`, error);
      return {
        success: false,
        message: error.message || "Failed to delete template",
      };
    }
  }

  async getTemplateRecommendations(
    tenantId: string,
    businessType?: string,
  ): Promise<{
    recommendations: Array<{
      name: string;
      category: string;
      description: string;
      components: TemplateComponent[];
      useCase: string;
      estimatedApprovalTime: string;
    }>;
    customizationTips: string[];
    bestPractices: string[];
  }> {
    const templateRecommendations = this.getRecommendationsByBusinessType(businessType);

    return {
      recommendations: templateRecommendations,
      customizationTips: [
        "Use your business name consistently across templates",
        "Keep variable names descriptive and consistent",
        "Test templates with real data before submission",
        "Follow Meta's template guidelines for faster approval",
      ],
      bestPractices: [
        "Create templates for your most common use cases first",
        "Use UTILITY category for transactional messages",
        "Keep message content clear and concise",
        "Include clear call-to-action when appropriate",
        "Avoid promotional language in non-marketing templates",
      ],
    };
  }

  async analyzeTemplatePerformance(tenantId: string): Promise<{
    overallStats: {
      totalSent: number;
      deliveryRate: number;
      readRate: number;
      responseRate: number;
    };
    topPerformingTemplates: Array<{
      name: string;
      sent: number;
      deliveryRate: number;
      readRate: number;
    }>;
    underperformingTemplates: Array<{
      name: string;
      sent: number;
      deliveryRate: number;
      suggestions: string[];
    }>;
    recommendations: string[];
  }> {
    return {
      overallStats: {
        totalSent: 0,
        deliveryRate: 0,
        readRate: 0,
        responseRate: 0,
      },
      topPerformingTemplates: [],
      underperformingTemplates: [],
      recommendations: [
        "Monitor template performance regularly",
        "A/B test different message variations",
        "Optimize send timing based on user behavior",
        "Keep templates updated with current information",
      ],
    };
  }

  async compareWithPlatformAverages(tenantId: string): Promise<{
    tenantStats: TemplateUsageStats;
    platformAverages: {
      averageTemplatesPerTenant: number;
      averageUtilizationRate: number;
      averageApprovalRate: number;
    };
    insights: string[];
    recommendations: string[];
  }> {
    const tenantStats = await this.getTenantTemplateUsage(tenantId);

    const platformAverages = {
      averageTemplatesPerTenant: 25,
      averageUtilizationRate: 15.5,
      averageApprovalRate: 87.3,
    };

    const insights: string[] = [];
    const recommendations: string[] = [];

    if (tenantStats.utilizationRate < platformAverages.averageUtilizationRate) {
      insights.push("Your template utilization is below platform average");
      recommendations.push("Consider creating more templates for common use cases");
    }

    if (tenantStats.totalTemplates < platformAverages.averageTemplatesPerTenant) {
      insights.push("You have fewer templates than the average tenant");
      recommendations.push("Explore our template recommendations to expand your library");
    }

    return {
      tenantStats,
      platformAverages,
      insights,
      recommendations,
    };
  }

  private async createMetaTemplate(
    businessAccountId: string,
    accessToken: string,
    request: TemplateCreationRequest,
  ): Promise<{ id: string; status: string }> {
    const url = `${this.metaApiUrl}/${businessAccountId}/message_templates`;

    const templateData = {
      name: request.templateName,
      category: request.category,
      language: request.language,
      components: request.components,
    };

    const response = await axios.post(url, templateData, {
      params: { access_token: accessToken },
      headers: { "Content-Type": "application/json" },
    });

    return response.data;
  }

  private async getMetaTemplates(
    businessAccountId: string,
    accessToken: string,
    filters?: any,
  ): Promise<any[]> {
    const url = `${this.metaApiUrl}/${businessAccountId}/message_templates`;

    const params: any = {
      access_token: accessToken,
      fields: "id,name,status,category,language,components,created_time,last_used,usage_count",
    };

    if (filters?.status) params.status = filters.status;
    if (filters?.category) params.category = filters.category;
    if (filters?.language) params.language = filters.language;

    const response = await axios.get(url, { params });
    return response.data.data || [];
  }

  private async deleteMetaTemplate(templateId: string, accessToken: string): Promise<void> {
    const url = `${this.metaApiUrl}/${templateId}`;

    await axios.delete(url, {
      params: { access_token: accessToken },
    });
  }

  private async recordTemplateCreation(
    tenantWabaConfigId: string,
    templateName: string,
    metaTemplateId: string,
  ): Promise<void> {
    const tenantConfig = await this.tenantWabaConfigRepository.findOne({
      where: { id: tenantWabaConfigId },
    });

    if (tenantConfig) {
      tenantConfig.usage.templatesUsed++;
      if (!tenantConfig.usage.templateBreakdown) {
        tenantConfig.usage.templateBreakdown = {};
      }
      tenantConfig.usage.templateBreakdown[templateName] = 1;

      await this.tenantWabaConfigRepository.save(tenantConfig);
    }
  }

  private getRecommendationsByBusinessType(businessType?: string): Array<{
    name: string;
    category: string;
    description: string;
    components: TemplateComponent[];
    useCase: string;
    estimatedApprovalTime: string;
  }> {
    const commonTemplates = [
      {
        name: "order_confirmation",
        category: "UTILITY",
        description: "Confirm customer orders with details",
        components: [
          {
            type: "BODY" as const,
            text: "Hi {{1}}, your order {{2}} has been confirmed. Total: {{3}}. Thank you for choosing {{4}}!",
            example: {
              body_text: [["John Doe", "ORD-12345", "$99.99", "Your Business"]],
            },
          },
        ],
        useCase: "E-commerce order confirmations",
        estimatedApprovalTime: "24-48 hours",
      },
      {
        name: "appointment_reminder",
        category: "UTILITY",
        description: "Remind customers of upcoming appointments",
        components: [
          {
            type: "BODY" as const,
            text: "Hello {{1}}, this is a reminder for your appointment with {{2}} on {{3}} at {{4}}.",
            example: {
              body_text: [["Jane Smith", "Dr. Johnson", "March 15, 2024", "2:00 PM"]],
            },
          },
        ],
        useCase: "Healthcare, beauty, professional services",
        estimatedApprovalTime: "24-48 hours",
      },
      {
        name: "payment_reminder",
        category: "UTILITY",
        description: "Remind customers of pending payments",
        components: [
          {
            type: "BODY" as const,
            text: "Dear {{1}}, your payment of {{2}} is due on {{3}}. Please make payment to avoid late fees.",
            example: {
              body_text: [["Customer Name", "$150.00", "March 20, 2024"]],
            },
          },
        ],
        useCase: "Financial services, subscriptions, utilities",
        estimatedApprovalTime: "24-48 hours",
      },
    ];

    if (businessType === "ECOMMERCE") {
      commonTemplates.push({
        name: "shipping_update",
        category: "UTILITY",
        description: "Notify customers when orders are shipped",
        components: [
          {
            type: "BODY" as const,
            text: "Great news {{1}}! Your order {{2}} has been shipped. Track your package: {{3}}",
            example: {
              body_text: [["Customer", "ORD-12345", "TRK123456789"]],
            },
          },
        ],
        useCase: "E-commerce shipping notifications",
        estimatedApprovalTime: "24-48 hours",
      });
    }

    return commonTemplates;
  }
}
