import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  Param,
  HttpCode,
  HttpStatus,
  UseGuards,
  Logger,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from "@nestjs/swagger";
import { TenantContextGuard } from "../../../common/guards";
import {
  WhatsAppEmbeddedSignupService,
  EmbeddedSignupRequest,
} from "../services/whatsapp-embedded-signup.service";

export class CreateEmbeddedSignupDto {
  tenantId: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessWebsite?: string;
  businessDescription?: string;
  redirectUri: string;
}

export class CompleteSignupDto {
  code: string;
  state: string;
}

@ApiTags("WhatsApp Embedded Signup")
@Controller("whatsapp/embedded-signup")
@ApiBearerAuth()
@UseGuards(TenantContextGuard)
export class WhatsAppEmbeddedSignupController {
  private readonly logger = new Logger(WhatsAppEmbeddedSignupController.name);

  constructor(private readonly embeddedSignupService: WhatsAppEmbeddedSignupService) {}

  @Post("initiate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Initiate Embedded Signup for WhatsApp Business Account",
    description:
      "Creates a signup URL for tenant to register their own WABA via Meta Embedded Signup",
  })
  @ApiResponse({
    status: 200,
    description: "Signup URL generated successfully",
    schema: {
      type: "object",
      properties: {
        signupUrl: { type: "string", description: "Meta signup URL" },
        state: { type: "string", description: "State parameter for verification" },
        expiresAt: { type: "string", format: "date-time" },
        instructions: {
          type: "object",
          properties: {
            step1: { type: "string" },
            step2: { type: "string" },
            step3: { type: "string" },
          },
        },
      },
    },
  })
  async initiateEmbeddedSignup(@Body() dto: CreateEmbeddedSignupDto) {
    this.logger.log(`Initiating embedded signup for tenant: ${dto.tenantId}`);

    const result = await this.embeddedSignupService.generateEmbeddedSignupUrl(dto);

    return {
      ...result,
      instructions: {
        step1: "Click the signup URL to authenticate with Meta",
        step2: "Complete business verification with Meta",
        step3: "Return to this platform to complete setup",
      },
      benefits: [
        "Your own dedicated WhatsApp Business Account",
        "6,000 template limit just for your business",
        "Independent reputation score",
        "No sharing with other businesses",
        "Full control over your WhatsApp presence",
      ],
    };
  }

  @Post("complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Complete Embedded Signup Process",
    description: "Completes the signup process after tenant authorizes with Meta",
  })
  @ApiResponse({
    status: 200,
    description: "WABA setup completed successfully",
    schema: {
      type: "object",
      properties: {
        wabaId: { type: "string" },
        businessAccountId: { type: "string" },
        phoneNumberId: { type: "string" },
        status: { type: "string", enum: ["PENDING", "ACTIVE"] },
        verificationRequired: { type: "boolean" },
        templateQuota: {
          type: "object",
          properties: {
            limit: { type: "number" },
            used: { type: "number" },
            remaining: { type: "number" },
          },
        },
      },
    },
  })
  async completeEmbeddedSignup(@Body() dto: CompleteSignupDto) {
    this.logger.log(`Completing embedded signup with state: ${dto.state}`);

    const result = await this.embeddedSignupService.completeEmbeddedSignup(dto.code, dto.state);

    return {
      ...result,
      templateQuota: {
        limit: 6000,
        used: 0,
        remaining: 6000,
      },
      message: result.verificationRequired
        ? "WABA created successfully. Business verification required to start sending messages."
        : "WABA created and verified. You can start sending messages immediately.",
    };
  }

  @Get("status/:tenantId")
  @ApiOperation({
    summary: "Get WhatsApp Business Account Status",
    description: "Returns the current status and configuration of tenant's WABA",
  })
  async getWABAStatus(@Param("tenantId") tenantId: string) {
    const tenantWaba = await this.embeddedSignupService.getTenantWABA(tenantId);

    if (!tenantWaba) {
      return {
        hasWaba: false,
        message: "No WhatsApp Business Account configured. Use /initiate to create one.",
        recommendedAction: "CREATE_WABA",
      };
    }

    const templateUsage = await this.embeddedSignupService.getTemplateUsage(tenantId);

    return {
      hasWaba: true,
      wabaId: tenantWaba.waba.id,
      businessAccountId: tenantWaba.waba.businessAccountId,
      phoneNumberId: tenantWaba.phoneNumberId,
      status: tenantWaba.status,
      verificationStatus: tenantWaba.verificationStatus,
      isActive: tenantWaba.isActive,
      templateUsage,
      usage: tenantWaba.usage,
      lastSyncAt: tenantWaba.lastSyncAt,
      assignedAt: tenantWaba.assignedAt,
      benefits: {
        dedicatedAccount: true,
        templateLimit: 6000,
        independentReputation: true,
        noSharing: true,
      },
    };
  }

  @Post("sync/:tenantId")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Sync WABA Status with Meta",
    description: "Synchronizes the WABA status and verification with Meta APIs",
  })
  async syncWABAStatus(@Param("tenantId") tenantId: string) {
    await this.embeddedSignupService.syncWABAStatus(tenantId);

    return {
      message: "WABA status synchronized successfully",
      syncedAt: new Date(),
    };
  }

  @Get("template-capacity/:tenantId")
  @ApiOperation({
    summary: "Check Template Creation Capacity",
    description: "Returns whether tenant can create more templates and current usage",
  })
  async checkTemplateCapacity(@Param("tenantId") tenantId: string) {
    const canCreate = await this.embeddedSignupService.canCreateTemplate(tenantId);
    const usage = await this.embeddedSignupService.getTemplateUsage(tenantId);

    return {
      canCreateTemplate: canCreate,
      templateUsage: usage,
      recommendation:
        usage.utilizationRate > 80
          ? "Consider creating additional WABA or optimizing template usage"
          : "Template capacity is healthy",
      scalingOptions:
        usage.utilizationRate > 90
          ? [
              "Create additional WABA for different business units",
              "Archive unused templates",
              "Optimize template variations",
            ]
          : [],
    };
  }

  @Get("architecture-info")
  @ApiOperation({
    summary: "Get Multi-Tenant Architecture Information",
    description: "Returns information about the multi-tenant WhatsApp architecture",
  })
  async getArchitectureInfo() {
    return {
      architecture: "Multi-Tenant WhatsApp with Embedded Sign-Up",
      benefits: [
        "Each tenant gets their own WhatsApp Business Account (WABA)",
        "Each WABA has its own 6,000 template quota",
        "Independent reputation scores prevent cross-tenant impact",
        "No sharing of templates or phone numbers",
        "Fully compliant with Meta policies",
        "Scales to unlimited tenants",
      ],
      comparisonWithSharedWABA: {
        sharedWABA: {
          templateLimit: "6,000 total across ALL tenants",
          riskLevel: "HIGH - One bad tenant affects everyone",
          scalability: "LIMITED - Hits limits quickly",
          compliance: "RISKY - Gray area with Meta policies",
        },
        dedicatedWABA: {
          templateLimit: "6,000 per tenant",
          riskLevel: "LOW - Isolated tenant risks",
          scalability: "UNLIMITED - Each tenant independent",
          compliance: "COMPLIANT - Follows Meta best practices",
        },
      },
      implementationModes: {
        embeddedSignup: {
          description: "Platform creates WABA for tenant via Meta ESU",
          ownership: "Platform-managed",
          setup: "Automated",
          billing: "Platform handles",
        },
        byop: {
          description: "Tenant brings their own WABA",
          ownership: "Tenant-owned",
          setup: "Manual API connection",
          billing: "Tenant handles directly",
        },
      },
      metaRecommendation: "Meta explicitly recommends this architecture for SaaS platforms",
    };
  }
}
