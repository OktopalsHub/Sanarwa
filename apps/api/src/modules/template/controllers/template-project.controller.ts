import { Body, Controller, Get, Param, Post, Put, Query, UseGuards } from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentUser } from "../../auth/decorators/current-user.decorator";
import { CurrentTenant } from "../../tenant/decorators/current-tenant.decorator";
import { TenantAuthGuard } from "../../tenant/guards/tenant-auth.guard";
import { TemplateProjectService } from "../services/template-project.service";

@ApiTags("Template Projects")
@Controller("projects/:projectId/templates")
@UseGuards(TenantAuthGuard)
@ApiBearerAuth()
export class TemplateProjectController {
  constructor(private readonly templateProjectService: TemplateProjectService) {}

  @Get()
  @ApiOperation({ summary: "Get all templates for a project" })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({ status: 200, description: "Templates retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Project not found" })
  async getProjectTemplates(
    @Param("projectId") projectId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.templateProjectService.getProjectTemplates(projectId, tenantId);
  }

  @Post("duplicate")
  @ApiOperation({ summary: "Duplicate a template to this project" })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({ status: 201, description: "Template duplicated successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Project or Source Template not found" })
  async duplicateTemplate(
    @Param("projectId") projectId: string,
    @Body() body: { sourceTemplateId: string; newName?: string },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.templateProjectService.duplicateTemplate({
      sourceTemplateId: body.sourceTemplateId,
      targetProjectId: projectId,
      newName: body.newName,
      tenantId,
      userId: user?.id,
    });
  }

  @Post("copy")
  @ApiOperation({ summary: "Copy a template with modifications" })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({ status: 201, description: "Template copied successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Project or Source Template not found" })
  async copyTemplate(
    @Param("projectId") projectId: string,
    @Body()
    body: {
      sourceTemplateId: string;
      newName: string;
      modifications?: {
        description?: string;
        content?: string;
        subject?: string;
        variables?: any[];
      };
    },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.templateProjectService.copyTemplateWithModifications({
      sourceTemplateId: body.sourceTemplateId,
      targetProjectId: projectId,
      newName: body.newName,
      tenantId,
      userId: user?.id,
      modifications: body.modifications,
    });
  }

  @Post("bulk-duplicate")
  @ApiOperation({ summary: "Duplicate multiple templates to this project" })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({ status: 201, description: "Templates duplicated" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Project or One or more templates not found" })
  async bulkDuplicateTemplates(
    @Param("projectId") projectId: string,
    @Body() body: { templateIds: string[] },
    @CurrentTenant() tenantId: string,
    @CurrentUser() user: any,
  ) {
    return this.templateProjectService.bulkDuplicateTemplates(
      body.templateIds,
      projectId,
      tenantId,
      user?.id,
    );
  }

  @Put(":templateId/move")
  @ApiOperation({ summary: "Move a template to this project" })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "templateId",
    description: "Template unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({ status: 200, description: "Template moved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Project or Template not found" })
  async moveTemplate(
    @Param("projectId") projectId: string,
    @Param("templateId") templateId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.templateProjectService.moveTemplateToProject(templateId, projectId, tenantId);
  }

  @Get(":templateId/stats")
  @ApiOperation({ summary: "Get template usage statistics" })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "templateId",
    description: "Template unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({ status: 200, description: "Statistics retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Template not found" })
  async getTemplateStats(
    @Param("templateId") templateId: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.templateProjectService.getTemplateUsageStats(templateId, tenantId);
  }

  @Get("compare")
  @ApiOperation({ summary: "Compare two templates" })
  @ApiResponse({ status: 200, description: "Comparison completed" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "One or both templates not found" })
  async compareTemplates(
    @Query("template1") template1Id: string,
    @Query("template2") template2Id: string,
    @CurrentTenant() tenantId: string,
  ) {
    return this.templateProjectService.compareTemplates(template1Id, template2Id, tenantId);
  }
}
