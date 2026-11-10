import {
  Controller,
  Post,
  Get,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from "@nestjs/swagger";
import { WhatsAppMultiTenantTemplateService } from "../services/whatsapp-multi-tenant-template.service";
import { WhatsAppBusinessAPIService } from "../services/whatsapp-business-api.service";
import { WhatsAppEmbeddedSignupService } from "../services/whatsapp-embedded-signup.service";

export class CreateTenantTemplateDto {
  tenantId: string;
  name: string;
  category: "AUTHENTICATION" | "MARKETING" | "UTILITY";
  language: string;
  components: Array<{
    type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS";
    text?: string;
    format?: string;
  }>;
}

@ApiTags("WhatsApp Templates - ESU Pattern")
@Controller("whatsapp/templates")
@ApiBearerAuth()
export class WhatsAppTemplateController {
  private readonly logger = new Logger(WhatsAppTemplateController.name);

  constructor(
    private readonly multiTenantTemplateService: WhatsAppMultiTenantTemplateService,
    private readonly whatsappAPIService: WhatsAppBusinessAPIService,
    private readonly embeddedSignupService: WhatsAppEmbeddedSignupService,
  ) {}

  @Post("tenant/create")
  @ApiOperation({
    summary: "Create template for tenant's dedicated WABA (ESU Pattern)",
    description: "Each tenant creates templates in their own WABA with 6,000 template quota",
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: "Template created in tenant's WABA successfully",
  })
  async createTenantTemplate(@Body() templateData: CreateTenantTemplateDto) {
    const tenantWaba = await this.embeddedSignupService.getTenantWABA(templateData.tenantId);
    if (!tenantWaba) {
      return {
        success: false,
        message: "Tenant must first create a WABA via Embedded Signup",
        action: "Use /whatsapp/embedded-signup/initiate to create a dedicated WABA",
      };
    }

    const canCreate = await this.embeddedSignupService.canCreateTemplate(templateData.tenantId);
    if (!canCreate) {
      const usage = await this.embeddedSignupService.getTemplateUsage(templateData.tenantId);
      return {
        success: false,
        message: "Template limit reached for your WABA",
        currentUsage: usage,
        recommendation: "Each WABA has 6,000 template limit. Consider archiving unused templates.",
      };
    }

    const result = await this.multiTenantTemplateService.createTemplate({
      tenantId: templateData.tenantId,
      name: templateData.name,
      category: templateData.category,
      language: templateData.language,
      components: templateData.components,
    });

    return {
      success: true,
      templateId: result.id,
      wabaId: tenantWaba.waba.id,
      status: "PENDING",
      message: "Template created in your dedicated WABA. Meta will review and approve.",
      benefits: [
        "Template created in your own WABA",
        "No sharing with other tenants",
        "Full 6,000 template quota available",
        "Independent approval process",
      ],
    };
  }

  @Get("tenant/:tenantId/list")
  @ApiOperation({
    summary: "List all templates for tenant's WABA",
    description: "Returns templates from tenant's dedicated WABA",
  })
  @ApiResponse({ status: HttpStatus.OK, description: "Tenant templates retrieved successfully" })
  async getTenantTemplates(@Param("tenantId") tenantId: string) {
    const tenantWaba = await this.embeddedSignupService.getTenantWABA(tenantId);
    if (!tenantWaba) {
      return {
        success: false,
        message: "No WABA found for tenant",
        templates: [],
        recommendation: "Create a WABA via Embedded Signup first",
      };
    }

    const templates = await this.multiTenantTemplateService.getTenantTemplates(tenantId);
    const usage = await this.embeddedSignupService.getTemplateUsage(tenantId);

    return {
      success: true,
      wabaId: tenantWaba.waba.id,
      templates,
      usage,
      capacity: {
        used: usage.used,
        limit: usage.limit,
        remaining: usage.remaining,
        utilizationRate: `${usage.utilizationRate.toFixed(1)}%`,
      },
    };
  }

  @Get("tenant/:tenantId/capacity")
  @ApiOperation({
    summary: "Get template capacity for tenant's WABA",
    description: "Shows template usage and remaining capacity for tenant's dedicated WABA",
  })
  @ApiResponse({ status: HttpStatus.OK, description: "Template capacity information retrieved" })
  async getTenantTemplateCapacity(@Param("tenantId") tenantId: string) {
    const usage = await this.embeddedSignupService.getTemplateUsage(tenantId);
    const canCreate = await this.embeddedSignupService.canCreateTemplate(tenantId);

    return {
      tenantId,
      capacity: usage,
      canCreateMore: canCreate,
      recommendations:
        usage.utilizationRate > 80
          ? [
              "Template usage is high",
              "Consider archiving unused templates",
              "Review template variations for consolidation",
            ]
          : ["Template capacity is healthy", "You can create more templates as needed"],
      esuBenefits: [
        "Your own dedicated 6,000 template quota",
        "No competition with other tenants",
        "Independent Meta approval process",
        "Full control over template lifecycle",
      ],
    };
  }

  @Delete("tenant/:tenantId/template/:templateId")
  @ApiOperation({
    summary: "Delete template from tenant's WABA",
    description: "Removes template from tenant's dedicated WABA",
  })
  @ApiResponse({ status: HttpStatus.OK, description: "Template deleted successfully" })
  async deleteTenantTemplate(
    @Param("tenantId") tenantId: string,
    @Param("templateId") templateId: string,
  ) {
    const result = await this.multiTenantTemplateService.deleteTemplate(tenantId, templateId);

    return {
      success: true,
      message: "Template deleted from your WABA",
      templateId,
      freedCapacity: 1,
      newUsage: await this.embeddedSignupService.getTemplateUsage(tenantId),
    };
  }

  @Get("architecture-comparison")
  @ApiOperation({
    summary: "Compare ESU vs Shared WABA architectures",
    description: "Educational endpoint showing benefits of ESU pattern",
  })
  async getArchitectureComparison() {
    return {
      currentArchitecture: "Embedded Sign-Up (ESU) Pattern",
      comparison: {
        esuPattern: {
          templateQuota: "6,000 per tenant",
          isolation: "Complete - each tenant has own WABA",
          scalability: "Unlimited - each tenant independent",
          riskLevel: "Low - tenant issues don't affect others",
          compliance: "Fully compliant with Meta policies",
          approval: "Independent approval per tenant",
          cost: "Tenant pays WhatsApp directly or platform markup",
          setup: "Automated via Meta Embedded Signup",
        },
        sharedWabaPattern: {
          templateQuota: "6,000 total across ALL tenants",
          isolation: "None - all tenants share same WABA",
          scalability: "Limited - hits 6,000 template limit quickly",
          riskLevel: "High - one bad tenant affects everyone",
          compliance: "Risky - gray area with Meta policies",
          approval: "Shared approval process",
          cost: "Platform absorbs all WhatsApp costs",
          setup: "Manual WABA sharing and management",
        },
      },
      metaRecommendation: "Meta explicitly recommends ESU pattern for SaaS platforms",
      industryBestPractice: "Leading WhatsApp SaaS providers (Twilio, MessageBird) use ESU pattern",
    };
  }
}
