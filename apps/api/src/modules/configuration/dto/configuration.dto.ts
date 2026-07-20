import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  ConfigurationScope,
  ConfigurationStatus,
} from '../entities/configuration.entity';

export class CreateConfigurationDto {
  @ApiProperty({
    description: 'Configuration key identifier',
    maxLength: 255,
    example: 'app.feature.enabled',
  })
  @IsString({ message: 'Key must be a string' })
  @IsNotEmpty({ message: 'Key is required' })
  @MaxLength(255, { message: 'Key must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  key: string;

  @ApiProperty({
    description: 'Configuration value',
    example: 'true',
  })
  @IsString({ message: 'Value must be a string' })
  @IsNotEmpty({ message: 'Value is required' })
  @Transform(({ value }) => value?.toString().trim())
  value: string;

  @ApiPropertyOptional({
    enum: ConfigurationScope,
    description: 'Configuration scope level',
    default: ConfigurationScope.GLOBAL,
    example: ConfigurationScope.GLOBAL,
  })
  @IsEnum(ConfigurationScope, { message: 'Scope must be a valid configuration scope' })
  @IsOptional()
  scope?: ConfigurationScope = ConfigurationScope.GLOBAL;

  @ApiPropertyOptional({
    description: 'Scope identifier (tenant ID, project ID, etc.)',
    maxLength: 255,
    example: 'tenant-123',
  })
  @IsString({ message: 'Scope ID must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Scope ID must not exceed 255 characters' })
  @Transform(({ value }) => value?.trim())
  scopeId?: string;

  @ApiPropertyOptional({
    description: 'Environment name',
    default: 'development',
    maxLength: 100,
    example: 'production',
  })
  @IsString({ message: 'Environment must be a string' })
  @IsOptional()
  @MaxLength(100, { message: 'Environment must not exceed 100 characters' })
  @Transform(({ value }) => value?.toLowerCase().trim())
  environment?: string = 'development';

  @ApiPropertyOptional({
    description: 'Configuration description',
    maxLength: 500,
    example: 'Enable feature flag for new users',
  })
  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the value is encrypted at rest',
    default: false,
    example: false,
  })
  @IsBoolean({ message: 'isEncrypted must be a boolean' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isEncrypted?: boolean = false;

  @ApiPropertyOptional({
    description: 'Whether the value is sensitive/secret',
    default: false,
    example: false,
  })
  @IsBoolean({ message: 'isSecret must be a boolean' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isSecret?: boolean = false;

  @ApiPropertyOptional({
    description: 'JSON schema for value validation',
    maxLength: 255,
    example: '{"type":"boolean"}',
  })
  @IsString({ message: 'Validation schema must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Validation schema must not exceed 255 characters' })
  validationSchema?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { tags: ['feature-flag', 'important'] },
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Reason for this configuration change',
    maxLength: 500,
    example: 'Enabling new feature for beta testing',
  })
  @IsString({ message: 'Change reason must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Change reason must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  changeReason?: string;
}

export class UpdateConfigurationDto {
  @ApiPropertyOptional({
    description: 'Updated configuration value',
    example: 'false',
  })
  @IsString({ message: 'Value must be a string' })
  @IsOptional()
  @Transform(({ value }) => value?.toString().trim())
  value?: string;

  @ApiPropertyOptional({
    enum: ConfigurationStatus,
    description: 'Configuration status',
    example: ConfigurationStatus.ACTIVE,
  })
  @IsEnum(ConfigurationStatus, { message: 'Status must be a valid configuration status' })
  @IsOptional()
  status?: ConfigurationStatus;

  @ApiPropertyOptional({
    description: 'Updated configuration description',
    maxLength: 500,
    example: 'Updated description',
  })
  @IsString({ message: 'Description must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Description must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  description?: string;

  @ApiPropertyOptional({
    description: 'Whether the value is encrypted at rest',
    example: true,
  })
  @IsBoolean({ message: 'isEncrypted must be a boolean' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isEncrypted?: boolean;

  @ApiPropertyOptional({
    description: 'Whether the value is sensitive/secret',
    example: true,
  })
  @IsBoolean({ message: 'isSecret must be a boolean' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  isSecret?: boolean;

  @ApiPropertyOptional({
    description: 'JSON schema for value validation',
    maxLength: 255,
    example: '{"type":"string","minLength":1}',
  })
  @IsString({ message: 'Validation schema must be a string' })
  @IsOptional()
  @MaxLength(255, { message: 'Validation schema must not exceed 255 characters' })
  validationSchema?: string;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    example: { updatedBy: 'admin', reason: 'maintenance' },
  })
  @IsOptional()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Reason for this configuration change',
    maxLength: 500,
    example: 'Disabling feature due to performance issues',
  })
  @IsString({ message: 'Change reason must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Change reason must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  changeReason?: string;
}

export class ConfigurationQueryDto {
  @ApiPropertyOptional({
    description: 'Filter by key pattern (supports wildcards)',
    example: 'app.feature.*',
  })
  @IsString({ message: 'Key must be a string' })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  key?: string;

  @ApiPropertyOptional({
    enum: ConfigurationScope,
    description: 'Filter by configuration scope',
    example: ConfigurationScope.GLOBAL,
  })
  @IsEnum(ConfigurationScope, { message: 'Scope must be a valid configuration scope' })
  @IsOptional()
  scope?: ConfigurationScope;

  @ApiPropertyOptional({
    description: 'Filter by scope identifier',
    example: 'tenant-123',
  })
  @IsString({ message: 'Scope ID must be a string' })
  @IsOptional()
  @Transform(({ value }) => value?.trim())
  scopeId?: string;

  @ApiPropertyOptional({
    description: 'Filter by environment',
    example: 'production',
  })
  @IsString({ message: 'Environment must be a string' })
  @IsOptional()
  @Transform(({ value }) => value?.toLowerCase().trim())
  environment?: string;

  @ApiPropertyOptional({
    enum: ConfigurationStatus,
    description: 'Filter by configuration status',
    example: ConfigurationStatus.ACTIVE,
  })
  @IsEnum(ConfigurationStatus, { message: 'Status must be a valid configuration status' })
  @IsOptional()
  status?: ConfigurationStatus;

  @ApiPropertyOptional({
    description: 'Include secret configurations in results',
    default: false,
    example: false,
  })
  @IsBoolean({ message: 'includeSecrets must be a boolean' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  includeSecrets?: boolean = false;
}

export class RollbackConfigurationDto {
  @ApiProperty({
    description: 'Version ID to rollback to',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  @IsUUID('4', { message: 'Version ID must be a valid UUID' })
  versionId: string;

  @ApiPropertyOptional({
    description: 'Reason for rollback',
    maxLength: 500,
    example: 'Reverting due to configuration error',
  })
  @IsString({ message: 'Reason must be a string' })
  @IsOptional()
  @MaxLength(500, { message: 'Reason must not exceed 500 characters' })
  @Transform(({ value }) => value?.trim())
  reason?: string;
}

export class BulkConfigurationDto {
  @ApiProperty({
    description: 'List of configurations to create or update',
    type: [CreateConfigurationDto],
  })
  @ValidateNested({ each: true })
  @Type(() => CreateConfigurationDto)
  configurations: CreateConfigurationDto[];

  @ApiPropertyOptional({
    description: 'Validate all configurations before applying changes',
    default: true,
    example: true,
  })
  @IsBoolean({ message: 'validateAll must be a boolean' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  validateAll?: boolean = true;
}

export class ConfigurationResponseDto {
  @ApiProperty({
    description: 'Configuration ID',
    format: 'uuid',
    example: '550e8400-e29b-41d4-a716-446655440000',
  })
  id: string;

  @ApiProperty({
    description: 'Configuration key',
    example: 'app.feature.enabled',
  })
  key: string;

  @ApiProperty({
    description: 'Configuration value',
    example: 'true',
  })
  value: string;

  @ApiProperty({
    description: 'Configuration scope',
    enum: ConfigurationScope,
    example: ConfigurationScope.GLOBAL,
  })
  scope: ConfigurationScope;

  @ApiPropertyOptional({
    description: 'Scope identifier',
    example: 'tenant-123',
  })
  scopeId?: string;

  @ApiProperty({
    description: 'Environment',
    example: 'production',
  })
  environment: string;

  @ApiProperty({
    description: 'Configuration status',
    enum: ConfigurationStatus,
    example: ConfigurationStatus.ACTIVE,
  })
  status: ConfigurationStatus;

  @ApiPropertyOptional({
    description: 'Configuration description',
    example: 'Enable feature flag',
  })
  description?: string;

  @ApiProperty({
    description: 'Whether value is encrypted',
    example: false,
  })
  isEncrypted: boolean;

  @ApiProperty({
    description: 'Whether value is secret',
    example: false,
  })
  isSecret: boolean;

  @ApiProperty({
    description: 'Creation timestamp',
    example: '2024-12-17T10:30:00Z',
  })
  createdAt: Date;

  @ApiProperty({
    description: 'Last update timestamp',
    example: '2024-12-17T10:30:00Z',
  })
  updatedAt: Date;
}
