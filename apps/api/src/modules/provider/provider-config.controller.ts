import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  BadRequestException,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiParam, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentTenantId } from "../../common/decorators";
import { TenantMemberGuard } from "../../common/guards";
import { AuthGuard } from "../../modules/auth/guards/jwt-auth.guard";
import { CreateProviderConfigDto } from "./dto/create-provider-config.dto";
import { ProviderConfigQueryDto } from "./dto/provider-config-query.dto";
import { UpdateProviderConfigDto } from "./dto/update-provider-config.dto";
import { presentConfig } from "./mask-provider-config";
import { ProviderConfigValidator } from "./provider-config-validator";
import { ProviderService } from "./provider.service";

@ApiTags("provider-configs")
@ApiBearerAuth()
@Controller("tenants/:tenantId/projects/:projectId/provider-configs")
@UseGuards(AuthGuard, TenantMemberGuard)
export class ProviderConfigController {
  constructor(
    private readonly providerService: ProviderService,
    private readonly validator: ProviderConfigValidator,
  ) {}

  @Post()
  @ApiOperation({ summary: "Create a new provider configuration" })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 201,
    description: "Provider configuration created successfully",
  })
  @ApiResponse({ status: 400, description: "Bad Request - Invalid configuration data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden - User is not a member of this tenant" })
  async create(
    @CurrentTenantId() tenantId: string,
    @Param("projectId") projectId: string,
    @Body() createDto: CreateProviderConfigDto,
  ) {
    const validation = await this.validator.validateDetailed({
      ...createDto,
      priority: createDto.priority ?? 1,
    } as never);
    if (!validation.isValid) {
      throw new BadRequestException({
        message: "Invalid provider configuration",
        errors: validation.errors,
      });
    }

    const created = await this.providerService.createConfig({
      ...createDto,
      projectId,
    });
    return presentConfig(created);
  }

  @Get("schemas")
  @ApiOperation({ summary: "Describe the credential fields each provider needs" })
  schemas() {
    return { schemas: this.validator.describeSchemas() };
  }

  @Get()
  @ApiOperation({ summary: "Get all provider configurations with pagination" })
  @ApiResponse({ status: 200, description: "List of provider configurations retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Param("projectId") projectId: string,
    @Query() query: ProviderConfigQueryDto,
  ) {
    const result = await this.providerService.findConfigsByProject(tenantId, projectId, query);
    return { ...result, configs: result.configs.map(presentConfig) };
  }

  @Get("project/:projectId")
  @ApiOperation({
    summary: "Get provider configurations for a specific project with pagination",
  })
  @ApiResponse({ status: 200, description: "Provider configurations for project retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Project not found" })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "projectId",
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findByProject(
    @CurrentTenantId() tenantId: string,
    @Param("projectId") projectId: string,
    @Query() query: ProviderConfigQueryDto,
  ) {
    const result = await this.providerService.findConfigsByProject(tenantId, projectId, query);
    return { ...result, configs: result.configs.map(presentConfig) };
  }

  @Get(":id")
  @ApiOperation({ summary: "Get a specific provider configuration" })
  @ApiResponse({ status: 200, description: "Provider configuration retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Provider configuration not found" })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Provider configuration unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async findOne(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return presentConfig(await this.providerService.findConfigById(tenantId, id));
  }

  @Patch(":id")
  @ApiOperation({ summary: "Update a provider configuration" })
  @ApiResponse({ status: 200, description: "Provider configuration updated successfully" })
  @ApiResponse({ status: 400, description: "Bad Request - Invalid update data" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Provider configuration not found" })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Provider configuration unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async update(
    @CurrentTenantId() tenantId: string,
    @Param("id") id: string,
    @Body() updateDto: UpdateProviderConfigDto,
  ) {
    return presentConfig(await this.providerService.updateConfig(tenantId, id, updateDto));
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Delete a provider configuration" })
  @ApiResponse({ status: 204, description: "Provider configuration deleted successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Provider configuration not found" })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Provider configuration unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async remove(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return this.providerService.removeConfig(tenantId, id);
  }

  @Post(":id/activate")
  @ApiOperation({ summary: "Activate a provider configuration" })
  @ApiResponse({ status: 200, description: "Provider activated successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Provider configuration not found" })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Provider configuration unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async activate(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return presentConfig(await this.providerService.activateConfig(tenantId, id));
  }

  @Post(":id/deactivate")
  @ApiOperation({ summary: "Deactivate a provider configuration" })
  @ApiResponse({ status: 200, description: "Provider deactivated successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Provider configuration not found" })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Provider configuration unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  async deactivate(@CurrentTenantId() tenantId: string, @Param("id") id: string) {
    return presentConfig(await this.providerService.deactivateConfig(tenantId, id));
  }
}
