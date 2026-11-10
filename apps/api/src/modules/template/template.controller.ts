import { NotificationChannel } from "../../common/enums";
import {
  Body,
  ParseEnumPipe,
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
import { CurrentMemberId, CurrentTenantId } from "../../common/decorators";
import { TenantMemberGuard } from "../../common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { CreateTemplateDto } from "./dto/create-template.dto";
import { RenderTemplateDto } from "./dto/render-template.dto";
import { TemplateQueryDto } from "./dto/template-query.dto";
import { UpdateTemplateDto } from "./dto/update-template.dto";
import { TemplateService } from "./template.service";

@ApiTags("Templates")
@ApiBearerAuth()
@Controller("tenants/:tenantId/templates")
@UseGuards(AuthGuard, TenantMemberGuard)
export class TemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Post()
  @ApiOperation({ summary: "Create a new template" })
  @ApiResponse({ status: 201, description: "Template created successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - Invalid template data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  createTemplate(
    @CurrentTenantId() tenantId: string,
    @CurrentMemberId() memberId: string,
    @Body() createTemplateDto: CreateTemplateDto,
  ) {
    return this.templateService.createTemplate({ ...createTemplateDto, tenantId }, memberId);
  }

  @Get()
  @ApiOperation({ summary: "Get all templates with pagination" })
  @ApiResponse({ status: 200, description: "Templates retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  getAllTemplates(@CurrentTenantId() tenantId: string, @Query() query: TemplateQueryDto) {
    return this.templateService.getAllTemplates({ ...query, tenantId });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get template by ID" })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 200, description: "Template retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Template not found" })
  getTemplateById(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.templateService.getTemplateById(id, tenantId);
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update template" })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 200, description: "Template updated successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Template not found" })
  updateTemplate(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templateService.updateTemplate(id, { ...updateTemplateDto, tenantId });
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete template" })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 204, description: "Template deleted successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Template not found" })
  deleteTemplate(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.templateService.deleteTemplate(id, tenantId);
  }

  @Post(":id/versions")
  @ApiOperation({ summary: "Create new template version" })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 201, description: "Version created successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Template not found" })
  createVersion(
    @CurrentTenantId() tenantId: string,

    @Param("id") id: string,
    @Body() updateTemplateDto: UpdateTemplateDto,
  ) {
    return this.templateService.createVersion(id, {
      ...updateTemplateDto,
      tenantId,
    });
  }

  @Get(":id/versions")
  @ApiOperation({ summary: "Get all template versions" })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 200, description: "Versions retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Template not found" })
  getVersions(
    @CurrentTenantId() tenantId: string,

    @Param("id") id: string,
  ) {
    return this.templateService.getVersions(id, tenantId);
  }

  @Post(":id/activate")
  @ApiOperation({ summary: "Activate template version" })
  @ApiParam({ name: "id", description: "Template  ID" })
  @ApiResponse({ status: 200, description: "Template activated successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Template not found" })
  activateVersion(
    @CurrentTenantId() tenantId: string,

    @Param("id") id: string,
  ) {
    return this.templateService.activateVersion(id, tenantId);
  }

  @Post(":id/archive")
  @ApiOperation({ summary: "Archive template" })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 200, description: "Template archived successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Template not found" })
  archive(
    @CurrentTenantId() tenantId: string,

    @Param("id") id: string,
  ) {
    return this.templateService.archive(id, tenantId);
  }

  @Post(":id/duplicate")
  @ApiOperation({ summary: "Duplicate template" })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 201, description: "Template duplicated successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Template not found" })
  duplicate(
    @CurrentTenantId() tenantId: string,

    @Param("id") id: string,
    @Body("name") newName: string,
  ) {
    return this.templateService.duplicate(id, newName, tenantId);
  }

  @Post("render")
  @ApiOperation({ summary: "Render template with data" })
  @ApiResponse({ status: 200, description: "Template rendered successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - Invalid render data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  render(
    @CurrentTenantId() tenantId: string,

    @Body() renderDto: RenderTemplateDto,
  ) {
    return this.templateService.render({ ...renderDto, tenantId });
  }

  @Post(":id/validate")
  @ApiOperation({ summary: "Validate template syntax" })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 200, description: "Template validation result" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Template not found" })
  validate(
    @CurrentTenantId() tenantId: string,

    @Param("id") id: string,
  ) {
    return this.templateService.validate(id, tenantId);
  }

  @Post(":id/validate-data")
  @ApiOperation({ summary: "Validate data against template" })
  @ApiParam({ name: "id", description: "Template ID" })
  @ApiResponse({ status: 200, description: "Data validation result" })
  @ApiResponse({ status: 400, description: "Bad Request - Invalid data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Template not found" })
  validateData(
    @CurrentTenantId() tenantId: string,

    @Param("id") id: string,
    @Body("variables") variables: Record<string, any>,
  ) {
    return this.templateService.validateData(id, variables, tenantId);
  }

  @Get("channel/:channel")
  @ApiOperation({ summary: "Find templates by channel" })
  @ApiParam({ name: "channel", description: "Notification channel" })
  @ApiResponse({ status: 200, description: "Templates retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  findByChannel(
    @CurrentTenantId() tenantId: string,

    @Param("channel", ParseEnumPipe) channel: NotificationChannel,
  ) {
    return this.templateService.findByChannel(tenantId, channel);
  }

  @Get("channel/:channel/default")
  @ApiOperation({ summary: "Get default template for channel" })
  @ApiParam({ name: "channel", description: "Notification channel" })
  @ApiResponse({ status: 200, description: "Default template retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "No default template found" })
  findDefaultTemplate(
    @CurrentTenantId() tenantId: string,

    @Param("channel", ParseEnumPipe) channel: NotificationChannel,
  ) {
    return this.templateService.findDefaultTemplate(tenantId, channel);
  }
}
