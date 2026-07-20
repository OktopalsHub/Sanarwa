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
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentTenantId } from 'src/common/decorators';
import { TenantMemberGuard } from 'src/common/guards';
import { AuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { CreateProviderConfigDto } from './dto/create-provider-config.dto';
import { ProviderConfigQueryDto } from './dto/provider-config-query.dto';
import { UpdateProviderConfigDto } from './dto/update-provider-config.dto';
import { ProviderService } from './provider.service';

@ApiTags('provider-configs')
@ApiBearerAuth()
@Controller('tenants/:tenantId/projects/:projectId/provider-configs')
@UseGuards(AuthGuard, TenantMemberGuard)
export class ProviderConfigController {
  constructor(private readonly providerService: ProviderService) { }

  @Post()
  @ApiOperation({ summary: 'Create a new provider configuration' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'projectId',
    description: 'Project unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiResponse({
    status: 201,
    description: 'Provider configuration created successfully',
  })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid configuration data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - User is not a member of this tenant' })
  async create(
    @CurrentTenantId() tenantId: string,
    @Param('projectId') projectId: string,
    @Body() createDto: Omit<CreateProviderConfigDto, 'projectId'>,
  ) {
    return this.providerService.createConfig(tenantId, {
      ...createDto,
      projectId,
    });
  }

  @Get()
  @ApiOperation({ summary: 'Get all provider configurations with pagination' })
  @ApiResponse({ status: 200, description: 'List of provider configurations retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async findAll(
    @CurrentTenantId() tenantId: string,
    @Query() query: ProviderConfigQueryDto,
  ) {
    return this.providerService.findAllConfigs(tenantId, query);
  }

  @Get('project/:projectId')
  @ApiOperation({
    summary:
      'Get provider configurations for a specific project with pagination',
  })
  @ApiResponse({ status: 200, description: 'Provider configurations for project retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Project not found' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'projectId',
    description: 'Project unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async findByProject(
    @CurrentTenantId() tenantId: string,
    @Param('projectId') projectId: string,
    @Query() query: ProviderConfigQueryDto,
  ) {
    return this.providerService.findConfigsByProject(
      tenantId,
      projectId,
      query,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific provider configuration' })
  @ApiResponse({ status: 200, description: 'Provider configuration retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Provider configuration not found' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider configuration unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async findOne(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.providerService.findConfigById(tenantId, id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a provider configuration' })
  @ApiResponse({ status: 200, description: 'Provider configuration updated successfully' })
  @ApiResponse({ status: 400, description: 'Bad Request - Invalid update data' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Provider configuration not found' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider configuration unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async update(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
    @Body() updateDto: UpdateProviderConfigDto,
  ) {
    return this.providerService.updateConfig(tenantId, id, updateDto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a provider configuration' })
  @ApiResponse({ status: 204, description: 'Provider configuration deleted successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Provider configuration not found' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider configuration unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async remove(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.providerService.removeConfig(tenantId, id);
  }

  @Post(':id/test')
  @ApiOperation({ summary: 'Test a provider configuration' })
  @ApiResponse({ status: 200, description: 'Provider test successful', schema: { properties: { success: { type: 'boolean' }, message: { type: 'string' } } } })
  @ApiResponse({ status: 400, description: 'Test failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Provider configuration not found' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider configuration unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async test(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.providerService.testConfig(tenantId, id);
  }

  @Post(':id/activate')
  @ApiOperation({ summary: 'Activate a provider configuration' })
  @ApiResponse({ status: 200, description: 'Provider activated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Provider configuration not found' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider configuration unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async activate(@CurrentTenantId() tenantId: string, @Param('id') id: string) {
    return this.providerService.activateConfig(tenantId, id);
  }

  @Post(':id/deactivate')
  @ApiOperation({ summary: 'Deactivate a provider configuration' })
  @ApiResponse({ status: 200, description: 'Provider deactivated successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Provider configuration not found' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider configuration unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async deactivate(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.providerService.deactivateConfig(tenantId, id);
  }

  @Get(':id/health')
  @ApiOperation({ summary: 'Check provider health status' })
  @ApiResponse({ status: 200, description: 'Provider health status', schema: { properties: { status: { type: 'string' }, lastCheck: { type: 'string' } } } })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Provider configuration not found' })
  @ApiParam({
    name: 'tenantId',
    description: 'Tenant unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @ApiParam({
    name: 'id',
    description: 'Provider configuration unique identifier',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  async checkHealth(
    @CurrentTenantId() tenantId: string,
    @Param('id') id: string,
  ) {
    return this.providerService.checkProviderHealth(tenantId, id);
  }
}
