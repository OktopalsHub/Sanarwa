import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { IsOptional, IsString } from "class-validator";
import { CurrentMemberId, CurrentTenantId } from "../../../common/decorators";
import { TenantContextGuard } from "../../../common/guards";
import { WhatsAppEmbeddedSignupService } from "../services/whatsapp-embedded-signup.service";

export class InitiateEmbeddedSignupDto {
  @IsString()
  businessName: string;

  @IsString()
  businessEmail: string;

  @IsString()
  businessPhone: string;

  @IsOptional()
  @IsString()
  businessWebsite?: string;

  @IsOptional()
  @IsString()
  businessDescription?: string;

  @IsString()
  redirectUri: string;
}

export class CompleteEmbeddedSignupDto {
  @IsString()
  code: string;

  @IsString()
  state: string;

  @IsOptional()
  @IsString()
  wabaId?: string;

  @IsOptional()
  @IsString()
  phoneNumberId?: string;
}

@ApiTags("WhatsApp Embedded Signup")
@Controller("whatsapp/embedded-signup")
@ApiBearerAuth()
@UseGuards(TenantContextGuard)
export class WhatsAppEmbeddedSignupController {
  constructor(private readonly embeddedSignupService: WhatsAppEmbeddedSignupService) {}

  @Post("initiate")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Start Embedded Signup for a tenant's own WhatsApp Business Account",
    description:
      "Returns the Meta app id, config id and signed state used by the Facebook JS SDK. The tenant authorises their own WABA; no platform number is shared.",
  })
  @ApiResponse({ status: 200, description: "Signup parameters generated" })
  async initiateEmbeddedSignup(
    @CurrentTenantId() tenantId: string,
    @Body() dto: InitiateEmbeddedSignupDto,
  ) {
    return this.embeddedSignupService.generateEmbeddedSignupUrl({
      ...dto,
      tenantId,
    });
  }

  @Post("complete")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Complete Embedded Signup",
    description:
      "Exchanges the Meta authorization code for a long-lived token, stores the tenant's WABA, and activates it as the tenant's WhatsApp connection.",
  })
  @ApiResponse({ status: 200, description: "WABA connected" })
  async completeEmbeddedSignup(
    @CurrentTenantId() tenantId: string,
    @CurrentMemberId() memberId: string,
    @Body() dto: CompleteEmbeddedSignupDto,
  ) {
    const result = await this.embeddedSignupService.completeEmbeddedSignup(tenantId, memberId, dto);

    return {
      ...result,
      templateQuota: {
        limit: 6000,
        used: 0,
        remaining: 6000,
      },
      message: result.verificationRequired
        ? "WhatsApp Business connected. Meta review is still pending for full messaging limits."
        : "WhatsApp Business connected and verified.",
    };
  }

  @Get("status")
  @ApiOperation({ summary: "Get the tenant's WhatsApp Business Account status" })
  async getWABAStatus(@CurrentTenantId() tenantId: string) {
    const tenantWaba = await this.embeddedSignupService.getTenantWABA(tenantId);

    if (!tenantWaba) {
      return {
        hasWaba: false,
        connected: false,
        message: "No WhatsApp Business Account connected.",
        recommendedAction: "CONNECT_WABA",
      };
    }

    const templateUsage = await this.embeddedSignupService.getTemplateUsage(tenantId);

    return {
      hasWaba: true,
      connected: true,
      wabaId: tenantWaba.waba.id,
      businessAccountId: tenantWaba.waba.businessAccountId,
      phoneNumberId: tenantWaba.phoneNumberId,
      displayPhoneNumber: tenantWaba.waba.metadata?.phoneNumber,
      displayName: tenantWaba.waba.metadata?.displayName,
      status: tenantWaba.status,
      verificationStatus: tenantWaba.verificationStatus,
      isActive: tenantWaba.isActive,
      templateUsage,
      usage: tenantWaba.usage,
      lastSyncAt: tenantWaba.lastSyncAt,
      assignedAt: tenantWaba.assignedAt,
    };
  }

  @Post("sync")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Refresh the WABA status and phone details from Meta" })
  async syncWABAStatus(@CurrentTenantId() tenantId: string, @CurrentMemberId() memberId: string) {
    await this.embeddedSignupService.syncWABAStatus(tenantId, memberId);
    return { message: "WABA status synchronized", syncedAt: new Date() };
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Disconnect the tenant's WhatsApp Business Account" })
  async disconnect(@CurrentTenantId() tenantId: string) {
    await this.embeddedSignupService.disconnect(tenantId);
  }

  @Get("template-capacity")
  @ApiOperation({ summary: "Check template creation capacity" })
  async checkTemplateCapacity(@CurrentTenantId() tenantId: string) {
    const canCreate = await this.embeddedSignupService.canCreateTemplate(tenantId);
    const usage = await this.embeddedSignupService.getTemplateUsage(tenantId);

    return {
      canCreateTemplate: canCreate,
      templateUsage: usage,
      recommendation:
        usage.utilizationRate > 80
          ? "Consider creating an additional WABA or archiving unused templates"
          : "Template capacity is healthy",
    };
  }
}
