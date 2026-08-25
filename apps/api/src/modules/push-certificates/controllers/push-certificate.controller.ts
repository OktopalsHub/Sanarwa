import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  UploadedFile,
  UseInterceptors,
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
  ApiConsumes,
  ApiBody,
} from "@nestjs/swagger";
import { CurrentTenantId } from "../../../common/decorators";
import { TenantContextGuard } from "../../../common/guards";
import { PushCertificateService } from "../services/push-certificate.service";
import { PushCertificateCrudService } from "../services/push-certificate-crud.service";
import {
  CreatePushCertificateDto,
  UpdatePushCertificateDto,
  TestCertificateDto,
  RotateCertificateDto,
} from "../dto/push-certificate.dto";

@ApiTags("Push Certificates")
@Controller("push-certificates")
@ApiBearerAuth()
@UseGuards(TenantContextGuard)
export class PushCertificateController {
  constructor(
    private readonly certificateService: PushCertificateService,
    private readonly certificateCrudService: PushCertificateCrudService,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new push certificate" })
  @ApiResponse({ status: 201, description: "Certificate created successfully" })
  async createCertificate(
    @CurrentTenantId() tenantId: string,
    @Body() createDto: CreatePushCertificateDto,
  ) {
    return this.certificateCrudService.createCertificate(tenantId, createDto);
  }

  @Post("upload")
  @UseInterceptors(FileInterceptor("certificate"))
  @ApiOperation({ summary: "Upload certificate file" })
  @ApiConsumes("multipart/form-data")
  @ApiBody({
    schema: {
      type: "object",
      properties: {
        certificate: {
          type: "string",
          format: "binary",
          description: "Certificate file (.p12, .pem for iOS, .json for Android)",
        },
        name: { type: "string" },
        type: { type: "string", enum: ["ios", "android"] },
        environment: { type: "string", enum: ["development", "production"] },
        password: { type: "string", description: "Password for encrypted certificates" },
        bundleId: { type: "string", description: "iOS Bundle ID" },
        teamId: { type: "string", description: "iOS Team ID" },
        packageName: { type: "string", description: "Android Package Name" },
        projectId: { type: "string", description: "Project ID (optional)" },
      },
    },
  })
  async uploadCertificate(
    @CurrentTenantId() tenantId: string,
    @UploadedFile() file: any,
    @Body() body: any,
  ) {
    // Parse certificate file and create certificate
    // This would handle different certificate formats
    return this.certificateCrudService.createCertificateFromFile(tenantId, file, body);
  }

  @Get()
  @ApiOperation({ summary: "Get all push certificates for tenant" })
  @ApiQuery({ name: "projectId", required: false })
  @ApiQuery({ name: "type", required: false })
  @ApiQuery({ name: "status", required: false })
  @ApiQuery({ name: "environment", required: false })
  async getCertificates(
    @CurrentTenantId() tenantId: string,
    @Query("projectId") projectId?: string,
    @Query("type") type?: string,
    @Query("status") status?: string,
    @Query("environment") environment?: string,
  ) {
    return this.certificateCrudService.getCertificates(tenantId, {
      projectId,
      type,
      status,
      environment,
    });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get certificate by ID" })
  @ApiParam({ name: "id", description: "Certificate ID" })
  async getCertificate(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    const certificate = await this.certificateCrudService.getCertificate(id, tenantId);
    return certificate.getCertificateInfo();
  }

  @Put(":id")
  @ApiOperation({ summary: "Update certificate" })
  @ApiParam({ name: "id", description: "Certificate ID" })
  async updateCertificate(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() updateDto: UpdatePushCertificateDto,
  ) {
    return this.certificateCrudService.updateCertificate(id, tenantId, updateDto);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete certificate" })
  @ApiParam({ name: "id", description: "Certificate ID" })
  async deleteCertificate(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    await this.certificateCrudService.deleteCertificate(id, tenantId);
  }

  @Post(":id/validate")
  @ApiOperation({ summary: "Validate certificate" })
  @ApiParam({ name: "id", description: "Certificate ID" })
  async validateCertificate(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.certificateService.validateCertificate(id, tenantId);
  }

  @Post(":id/test")
  @ApiOperation({ summary: "Test certificate with push notification" })
  @ApiParam({ name: "id", description: "Certificate ID" })
  async testCertificate(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() testDto: TestCertificateDto,
  ) {
    return this.certificateService.testCertificate(id, tenantId, testDto.testDeviceToken);
  }

  @Post(":id/rotate")
  @ApiOperation({ summary: "Rotate certificate" })
  @ApiParam({ name: "id", description: "Certificate ID" })
  async rotateCertificate(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() rotateDto: RotateCertificateDto,
  ) {
    return this.certificateService.rotateCertificate(id, tenantId, rotateDto.newCertificateData);
  }

  @Get(":id/usage")
  @ApiOperation({ summary: "Get certificate usage statistics" })
  @ApiParam({ name: "id", description: "Certificate ID" })
  async getCertificateUsage(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.certificateService.getCertificateUsageStats(id, tenantId);
  }

  @Post("check-expiry")
  @ApiOperation({ summary: "Check for certificates expiring soon" })
  async checkExpiringCertificates(@Body() body: { days?: number } = {}) {
    const days = body.days || 30;
    return this.certificateService.getExpiringCertificates(days);
  }

  @Post("validate-all")
  @ApiOperation({ summary: "Validate all certificates" })
  async validateAllCertificates() {
    return this.certificateService.validateAllCertificates();
  }

  @Post("check-rotation")
  @ApiOperation({ summary: "Check certificates that need rotation" })
  async checkCertificatesForRotation() {
    return this.certificateService.checkCertificatesForRotation();
  }
}
