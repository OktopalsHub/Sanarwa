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
import { CurrentMemberId, CurrentTenantId } from '../../../common/decorators';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  RequireRoles,
  Roles,
} from 'src/modules/auth/decorators/roles.decorator';
import { AuthGuard } from '../../auth/guards/jwt-auth.guard';

// import { RolesGuard } from '../../modules/auth/guards/roles.guard';
import { UserRole } from '../../../common/enums';

import {
  BulkConfigurationDto,
  ConfigurationQueryDto,
  CreateConfigurationDto,
  RollbackConfigurationDto,
  UpdateConfigurationDto,
} from '../dto/configuration.dto';
import { ConfigurationVersion } from '../entities/configuration-version.entity';
import { Configuration } from '../entities/configuration.entity';
import { ConfigurationCacheService } from '../services/configuration-cache.service';
import { ConfigurationValidationService } from '../services/configuration-validation.service';
import { ConfigurationWatcherService } from '../services/configuration-watcher.service';
import {
  BulkOperationResult,
  ConfigurationService,
} from '../services/configuration.service';

@ApiTags('Configuration Management')
@Controller('configurations')
@ApiBearerAuth()
@UseGuards(AuthGuard)
export class ConfigurationController {
  constructor(
    private readonly configurationService: ConfigurationService,
    private readonly validationService: ConfigurationValidationService,
    private readonly cacheService: ConfigurationCacheService,
    private readonly watcherService: ConfigurationWatcherService,
  ) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Create a new configuration' })
  @ApiResponse({
    status: 201,
    description: 'Configuration created successfully',
    type: Configuration,
  })
  @ApiResponse({ status: 400, description: 'Invalid configuration data' })
  @ApiResponse({ status: 409, description: 'Configuration already exists' })
  async create(
    @CurrentMemberId() memberId: string,
    @Body() createConfigurationDto: CreateConfigurationDto,
  ) {
    const result = await this.configurationService.create(
      createConfigurationDto,
      memberId,
    );

    if (!result.validationResult?.isValid) {
      return {
        success: false,
        errors: result.validationResult?.errors,
        configuration: null,
      };
    }

    return {
      success: true,
      configuration: result.configuration,
    };
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get configurations with filtering' })
  @ApiResponse({
    status: 200,
    description: 'Configurations retrieved successfully',
    type: [Configuration],
  })
  async findAll(@Query() query: ConfigurationQueryDto) {
    const configurations = await this.configurationService.find(query);
    return {
      success: true,
      data: configurations,
      count: configurations.length,
    };
  }

  @Get(':id')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get configuration by ID' })
  @ApiParam({ name: 'id', description: 'Configuration ID' })
  @ApiQuery({
    name: 'includeSecrets',
    required: false,
    description: 'Include secret configurations',
    type: Boolean,
  })
  @ApiResponse({
    status: 200,
    description: 'Configuration retrieved successfully',
    type: Configuration,
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  async findOne(
    @Param('id') id: string,
    @Query('includeSecrets') includeSecrets?: boolean,
  ) {
    const configuration = await this.configurationService.findById(
      id,
      includeSecrets,
    );
    return {
      success: true,
      configuration,
    };
  }

  @Patch(':id')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Update configuration' })
  @ApiParam({ name: 'id', description: 'Configuration ID' })
  @ApiResponse({
    status: 200,
    description: 'Configuration updated successfully',
    type: Configuration,
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @ApiResponse({ status: 400, description: 'Invalid configuration data' })
  async update(
    @CurrentMemberId() memberId: string,
    @Param('id') id: string,
    @Body() updateConfigurationDto: UpdateConfigurationDto,
  ) {
    const result = await this.configurationService.update(
      id,
      updateConfigurationDto,
      memberId,
    );

    if (!result.validationResult?.isValid) {
      return {
        success: false,
        errors: result.validationResult?.errors,
        configuration: result.configuration,
      };
    }

    return {
      success: true,
      configuration: result.configuration,
    };
  }

  @Delete(':id')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Delete configuration' })
  @ApiParam({ name: 'id', description: 'Configuration ID' })
  @ApiResponse({
    status: 204,
    description: 'Configuration deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Configuration not found' })
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(
    @CurrentMemberId() memberId: string,
    @Param('id') id: string,
  ) {
    await this.configurationService.delete(id, memberId);
    return {
      success: true,
      message: 'Configuration deleted successfully',
    };
  }

  @Post(':id/rollback')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Rollback configuration to previous version' })
  @ApiParam({ name: 'id', description: 'Configuration ID' })
  @ApiResponse({
    status: 200,
    description: 'Configuration rolled back successfully',
    type: Configuration,
  })
  @ApiResponse({
    status: 404,
    description: 'Configuration or version not found',
  })
  async rollback(
    @CurrentMemberId() memberId: string,
    @Param('id') id: string,
    @Body() rollbackDto: RollbackConfigurationDto,
  ) {
    const configuration = await this.configurationService.rollback(
      id,
      rollbackDto,
      memberId,
    );

    return {
      success: true,
      configuration,
      message: 'Configuration rolled back successfully',
    };
  }

  @Get(':id/versions')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get configuration version history' })
  @ApiParam({ name: 'id', description: 'Configuration ID' })
  @ApiResponse({
    status: 200,
    description: 'Version history retrieved successfully',
    type: [ConfigurationVersion],
  })
  async getVersions(@Param('id') id: string) {
    const versions = await this.configurationService.getVersions(id);
    return {
      success: true,
      versions,
      count: versions.length,
    };
  }

  @Post('bulk')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Bulk create/update configurations' })
  @ApiResponse({
    status: 200,
    description: 'Bulk operation completed',
  })
  async bulkOperation(
    @CurrentMemberId() memberId: string,
    @Body() bulkDto: BulkConfigurationDto,
  ): Promise<{
    success: boolean;
    result: BulkOperationResult;
    summary: {
      total: number;
      successful: number;
      failed: number;
    };
  }> {
    const result = await this.configurationService.bulkOperation(
      bulkDto,
      memberId,
    );

    return {
      success: true,
      result,
      summary: {
        total: bulkDto.configurations.length,
        successful: result.successful.length,
        failed: result.failed.length,
      },
    };
  }

  @Get('validation/schemas')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get available validation schemas' })
  @ApiResponse({
    status: 200,
    description: 'Available schemas retrieved successfully',
  })
  async getValidationSchemas() {
    const schemas = this.validationService.getAvailableSchemas();
    return {
      success: true,
      schemas,
    };
  }

  @Post('validation/test')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Test configuration value against schema' })
  @ApiResponse({
    status: 200,
    description: 'Validation result',
  })
  async testValidation(@Body() testData: { value: string; schema?: string }) {
    const result = await this.validationService.validateValue(
      testData.value,
      testData.schema,
    );

    return {
      success: true,
      validation: result,
    };
  }

  @Get('cache/stats')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get cache statistics' })
  @ApiResponse({
    status: 200,
    description: 'Cache statistics retrieved successfully',
  })
  async getCacheStats() {
    const stats = await this.cacheService.getStats();
    return {
      success: true,
      cache: stats,
    };
  }

  @Post('cache/clear')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Clear configuration cache' })
  @ApiResponse({
    status: 200,
    description: 'Cache cleared successfully',
  })
  @HttpCode(HttpStatus.OK)
  async clearCache() {
    await this.cacheService.clear();
    return {
      success: true,
      message: 'Configuration cache cleared successfully',
    };
  }

  @Get('watcher/status')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Get configuration watcher status' })
  @ApiResponse({
    status: 200,
    description: 'Watcher status retrieved successfully',
  })
  async getWatcherStatus() {
    const status = this.watcherService.getStatus();
    return {
      success: true,
      watcher: status,
    };
  }

  @Post('watcher/reload')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reload watched configurations' })
  @ApiResponse({
    status: 200,
    description: 'Configurations reloaded successfully',
  })
  @HttpCode(HttpStatus.OK)
  async reloadWatcher() {
    await this.watcherService.reload();
    return {
      success: true,
      message: 'Watched configurations reloaded successfully',
    };
  }

  @Post('watcher/force-check')
  @RequireRoles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Force check for configuration changes' })
  @ApiResponse({
    status: 200,
    description: 'Change check completed',
  })
  async forceCheck() {
    const changes = await this.watcherService.forceCheck();
    return {
      success: true,
      changes,
      count: changes.length,
    };
  }

  @Get('health')
  @ApiOperation({ summary: 'Configuration management health check' })
  @ApiResponse({
    status: 200,
    description: 'Health status',
  })
  async healthCheck() {
    const cacheHealth = await this.cacheService.healthCheck();
    const watcherStatus = this.watcherService.getStatus();

    return {
      success: true,
      health: {
        cache: cacheHealth,
        watcher: {
          status: watcherStatus.isWatching ? 'healthy' : 'inactive',
          watchedCount: watcherStatus.watchedCount,
        },
        timestamp: new Date(),
      },
    };
  }
}
