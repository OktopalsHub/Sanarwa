import { ParseEnumPipe } from "@nestjs/common";
import { NotificationChannel } from "../../common/enums";
import { Controller, Get, Param, Query, Headers } from "@nestjs/common";
import { ApiOperation, ApiTags, ApiHeader, ApiResponse } from "@nestjs/swagger";
import { Public } from "../auth/decorators/public.decorator";
import { TemplateQueryDto } from "./dto/template-query.dto";
import { TemplateService } from "./template.service";

@ApiTags("Templates (Public)")
@Controller("templates")
@Public()
export class PublicTemplateController {
  constructor(private readonly templateService: TemplateService) {}

  @Get()
  @ApiOperation({ summary: "Get all templates with pagination (SDK)" })
  @ApiResponse({ status: 200, description: "Templates retrieved successfully" })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  @ApiHeader({ name: "X-Tenant", description: "Tenant ID", required: true })
  getAllTemplates(@Headers("x-tenant") tenantId: string, @Query() query: TemplateQueryDto) {
    return this.templateService.getAllTemplates({ ...query, tenantId });
  }

  @Get(":id")
  @ApiOperation({ summary: "Get template by ID (SDK)" })
  @ApiResponse({ status: 200, description: "Template retrieved successfully" })
  @ApiResponse({ status: 404, description: "Template not found" })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  @ApiHeader({ name: "X-Tenant", description: "Tenant ID", required: true })
  getTemplateById(@Headers("x-tenant") tenantId: string, @Param("id") id: string) {
    return this.templateService.getTemplateById(id, tenantId);
  }

  @Get("channel/:channel")
  @ApiOperation({ summary: "Find templates by channel (SDK)" })
  @ApiResponse({ status: 200, description: "Templates retrieved successfully" })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  @ApiHeader({ name: "X-Tenant", description: "Tenant ID", required: true })
  findByChannel(
    @Headers("x-tenant") tenantId: string,
    @Param("channel", ParseEnumPipe) channel: NotificationChannel,
  ) {
    return this.templateService.findByChannel(tenantId, channel);
  }

  @Get("channel/:channel/default")
  @ApiOperation({ summary: "Find default template by channel (SDK)" })
  @ApiResponse({ status: 200, description: "Default template retrieved successfully" })
  @ApiResponse({ status: 404, description: "Default template not found" })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  @ApiHeader({ name: "X-Tenant", description: "Tenant ID", required: true })
  findDefaultTemplate(
    @Headers("x-tenant") tenantId: string,
    @Param("channel", ParseEnumPipe) channel: NotificationChannel,
  ) {
    return this.templateService.findDefaultTemplate(tenantId, channel);
  }
}
