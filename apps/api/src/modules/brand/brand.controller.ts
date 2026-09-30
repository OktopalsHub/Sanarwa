import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentMemberId, CurrentTenantId } from "src/common/decorators";
import { TenantMemberGuard } from "src/common/guards";
import { AuthGuard } from "src/modules/auth/guards/jwt-auth.guard";
import { BrandService } from "./brand.service";
import { BrandQueryDto } from "./dtos/brand-query.dto";
import { CreateBrandDto } from "./dtos/create-brand.dto";
import { UpdateBrandDto } from "./dtos/update-brand.dto";
import { BrandDomainService } from "./services/brand-domain.service";
import { BrandMessagingConfigService } from "./services/brand-messaging-config.service";
import { BrandResendService } from "./services/brand-resend.service";
import { BrandSesService } from "./services/brand-ses.service";

@ApiTags("Brands")
@ApiBearerAuth()
@Controller("tenants/:tenantId/brands")
@UseGuards(AuthGuard, TenantMemberGuard)
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly brandSesService: BrandSesService,
    private readonly brandDomainService: BrandDomainService,
    private readonly brandResendService: BrandResendService,
    private readonly brandMessagingConfigService: BrandMessagingConfigService,
  ) {}

  @Post("")
  @ApiOperation({ summary: "Create a new brand" })
  @ApiResponse({ status: 201, description: "Brand created successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - Invalid brand data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async createBrand(
    @CurrentTenantId() tenantId: string,
    @CurrentMemberId() memberId: string,
    @Body() createBrandDto: CreateBrandDto,
  ) {
    return this.brandService.createBrand(tenantId, createBrandDto, memberId);
  }

  @Get("")
  @ApiOperation({ summary: "Get all brands with pagination" })
  @ApiResponse({ status: 200, description: "Brands retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getBrands(@CurrentTenantId() tenantId: string, @Query() query: BrandQueryDto) {
    return this.brandService.getBrands(tenantId, query);
  }

  @Get("/:brandId")
  @ApiOperation({ summary: "Get a specific brand" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Brand retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Brand not found" })
  async getBrand(@CurrentTenantId() tenantId: string, @Param("brandId") brandId: string) {
    return this.brandService.getBrandById(tenantId, brandId);
  }

  @Patch("/:brandId")
  @ApiOperation({ summary: "Update a brand" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Brand updated successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Brand not found" })
  async updateBrand(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Body() updateBrandDto: UpdateBrandDto,
  ) {
    return this.brandService.updateBrand(tenantId, brandId, updateBrandDto);
  }

  @Delete("/:brandId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a brand" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 204, description: "Brand deleted successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Brand not found" })
  async deleteBrand(@CurrentTenantId() tenantId: string, @Param("brandId") brandId: string) {
    return this.brandService.removeBrand(tenantId, brandId);
  }

  @Post("/:brandId/verify-domain")
  @ApiOperation({ summary: "Verify domain for white-labeling" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Domain verification initiated" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async verifyDomain(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Body() body: { domain: string; cloudflareApiToken?: string },
  ) {
    return this.brandDomainService.verifyDomain(
      tenantId,
      brandId,
      body.domain,
      body.cloudflareApiToken,
    );
  }

  @Post("/:brandId/verify-dkim")
  @ApiOperation({ summary: "Verify DKIM configuration" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "DKIM verification result" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Brand not found" })
  async verifyDKIM(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Body() body: { selector?: string; cloudflareApiToken?: string },
  ) {
    return this.brandDomainService.verifyDKIM(
      tenantId,
      brandId,
      body.selector,
      body.cloudflareApiToken,
    );
  }

  @Post("/:brandId/verify-dmarc")
  @ApiOperation({ summary: "Verify DMARC configuration" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "DMARC verification result" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Brand not found" })
  async verifyDMARC(@CurrentTenantId() tenantId: string, @Param("brandId") brandId: string) {
    return this.brandDomainService.verifyDMARC(tenantId, brandId);
  }

  @Get("/:brandId/domain-verification-instructions")
  @ApiOperation({ summary: "Get domain verification instructions" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Verification instructions retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getDomainVerificationInstructions(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Query("domain") domain?: string,
  ) {
    return this.brandDomainService.getDomainVerificationInstructions(tenantId, brandId, domain);
  }

  // SES-specific endpoints
  @Get("/:brandId/ses-domain-verification-instructions")
  @ApiOperation({ summary: "Get SES domain verification instructions - generic custom domain + optional Cloudflare auto" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "SES verification instructions retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getSESDomainVerificationInstructions(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Query("domain") domain?: string,
    @Query("cloudflareApiToken") cloudflareApiToken?: string,
  ) {
    return this.brandSesService.getSESDomainVerificationInstructions(tenantId, brandId, domain, cloudflareApiToken);
  }

  @Post("/:brandId/verify-ses-domain")
  @ApiOperation({ summary: "Verify domain with AWS SES - generic custom domain + optional Cloudflare auto" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "SES domain verification initiated" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async verifySESDomain(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Body() body: { domain: string; cloudflareApiToken?: string },
  ) {
    return this.brandSesService.verifySESDomain(tenantId, brandId, body.domain, body.cloudflareApiToken);
  }

  @Post("/:brandId/setup-ses-dkim")
  @ApiOperation({ summary: "Setup DKIM with AWS SES - generic custom domain + optional Cloudflare auto" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "SES DKIM setup initiated" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async setupSESDKIM(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Body() body: { cloudflareApiToken?: string } = {},
  ) {
    return this.brandSesService.setupSESDKIM(tenantId, brandId, body.cloudflareApiToken);
  }

  @Get("/:brandId/ses-dkim-status")
  @ApiOperation({ summary: "Check SES DKIM verification status" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "DKIM status retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async checkSESDKIMStatus(@CurrentTenantId() tenantId: string, @Param("brandId") brandId: string) {
    return this.brandSesService.checkSESDKIMStatus(tenantId, brandId);
  }

  @Get("/:brandId/ses-email-capability")
  @ApiOperation({ summary: "Check if domain can send emails through SES" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Email capability status retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async checkSESEmailCapability(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
  ) {
    return this.brandSesService.checkSESEmailCapability(tenantId, brandId);
  }

  @Get("/:brandId/email-config")
  @ApiOperation({ summary: "Get brand email configuration for sending" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Email configuration retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getBrandEmailConfig(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
  ) {
    return this.brandMessagingConfigService.getBrandConfigForEmail(tenantId, brandId);
  }

  @Get("/:brandId/email-recommendations")
  @ApiOperation({ summary: "Get email setup recommendations for brand" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Recommendations retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getEmailRecommendations(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
  ) {
    return this.brandMessagingConfigService.getEmailRecommendations(tenantId, brandId);
  }

  // Resend-specific endpoints
  @Post("/:brandId/resend-domain-verification-instructions")
  @ApiOperation({
    summary: "Get Resend domain verification instructions with Cloudflare DNS auto-setup",
  })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Resend verification instructions retrieved" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getResendDomainVerificationInstructions(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Body() body: { domain?: string; resendApiKey: string; cloudflareApiToken?: string },
  ) {
    return this.brandResendService.getResendDomainVerificationInstructions(
      tenantId,
      brandId,
      body.domain,
      body.resendApiKey,
      body.cloudflareApiToken,
    );
  }

  @Post("/:brandId/verify-resend-domain")
  @ApiOperation({ summary: "Verify domain with Resend" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Resend domain verification initiated" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async verifyResendDomain(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Body() body: { domain: string; resendApiKey: string },
  ) {
    return this.brandResendService.verifyResendDomain(
      tenantId,
      brandId,
      body.domain,
      body.resendApiKey,
    );
  }

  @Get("/:brandId/resend-email-capability")
  @ApiOperation({ summary: "Check if domain can send emails through Resend" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Resend email capability status retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async checkResendEmailCapability(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Query("resendApiKey") resendApiKey: string,
  ) {
    return this.brandResendService.checkResendEmailCapability(tenantId, brandId, resendApiKey);
  }

  @Get("/:brandId/resend-email-recommendations")
  @ApiOperation({ summary: "Get Resend email setup recommendations for brand" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Resend recommendations retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getResendEmailRecommendations(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
    @Query("resendApiKey") resendApiKey?: string,
  ) {
    return this.brandResendService.getResendEmailRecommendations(tenantId, brandId, resendApiKey);
  }

  // Push notification endpoints
  @Get("/:brandId/push-config")
  @ApiOperation({ summary: "Get brand push notification configuration" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Push configuration retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getBrandPushConfig(@CurrentTenantId() tenantId: string, @Param("brandId") brandId: string) {
    return this.brandMessagingConfigService.getBrandConfigForPush(tenantId, brandId);
  }

  @Get("/:brandId/push-recommendations")
  @ApiOperation({ summary: "Get push notification setup recommendations for brand" })
  @ApiParam({ name: "brandId", description: "Brand ID" })
  @ApiResponse({ status: 200, description: "Push recommendations retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getPushRecommendations(
    @CurrentTenantId() tenantId: string,
    @Param("brandId") brandId: string,
  ) {
    return this.brandMessagingConfigService.getPushRecommendations(tenantId, brandId);
  }
}
