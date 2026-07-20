import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { ApiKeyEnvironment, ApiKeyStatus } from '../entities/api-key.entity';

export class ProjectSummary {
  @ApiProperty({
    type: String,
    description: 'ID of the project this API key belongs to',
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  id: string;

  @ApiProperty({
    type: String,
    description: 'Name of the project this API key belongs to',
    example: 'My Project',
  })
  name: string;
}

export class ApiKeyResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the API key',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'Name of the API key for identification',
    example: 'Production API Key',
    type: String,
  })
  name: string;

  @ApiPropertyOptional({
    description: 'The full API key (only shown once on creation)',
    example: 'sk_prod_1234567890abcdef',
    type: String,
  })
  key?: string;

  @ApiProperty({
    description: 'First 8 characters of the API key for identification',
    example: 'sk_prod_1',
    type: String,
  })
  keyPrefix: string;

  @ApiProperty({
    enum: ApiKeyEnvironment,
    description: 'Environment of the API key',
    example: ApiKeyEnvironment.PRODUCTION,
    type: String,
  })
  environment: ApiKeyEnvironment;

  @ApiProperty({
    enum: ApiKeyStatus,
    description: 'Current status of the API key',
    example: ApiKeyStatus.ACTIVE,
    type: String,
  })
  status: ApiKeyStatus;

  @ApiProperty({
    type: [String],
    description: 'List of permissions granted to this API key',
    example: ['notifications:send', 'templates:read'],
  })
  permissions: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'List of IP addresses allowed to use this API key',
    example: ['192.168.1.1', '10.0.0.1'],
  })
  ipWhitelist?: string[];

  @ApiPropertyOptional({
    type: Date,
    description: 'Expiration date of the API key',
    example: '2025-12-31T23:59:59.000Z',
    nullable: true,
  })
  expiresAt?: Date;

  @ApiPropertyOptional({
    type: Date,
    description: 'Last time this API key was used',
    example: '2024-01-15T10:30:00.000Z',
    nullable: true,
  })
  lastUsedAt?: Date;

  @ApiPropertyOptional({
    type: String,
    description: 'IP address from which the API key was last used',
    example: '192.168.1.100',
    nullable: true,
  })
  lastUsedIp?: string;

  @ApiProperty({
    type: Number,
    description: 'Total number of times this API key has been used',
    example: 1500,
  })
  usageCount: number;

  @ApiProperty({
    type: Number,
    description: 'Maximum number of requests per minute',
    example: 1000,
  })
  rateLimitPerMinute: number;

  @ApiProperty({
    type: Number,
    description: 'Maximum number of requests per hour',
    example: 10000,
  })
  rateLimitPerHour: number;

  @ApiProperty({
    type: Number,
    description: 'Maximum number of requests per day',
    example: 100000,
  })
  rateLimitPerDay: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: Object,
    nullable: true,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    type: ProjectSummary,
    description: 'Project information',
  })
  project: ProjectSummary;

  @ApiPropertyOptional({
    type: String,
    description: 'ID of the tenant member who created this API key',
    example: '123e4567-e89b-12d3-a456-426614174000',
    nullable: true,
  })
  createdById?: string;

  @ApiProperty({
    description: 'API key creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    description: 'API key last update timestamp',
    example: '2024-01-01T00:00:00.000Z',
    type: Date,
  })
  updatedAt: Date;
}

export class ApiKeyListResponseDto {
  @ApiProperty({
    description: 'Unique identifier for the API key',
    example: '123e4567-e89b-12d3-a456-426614174000',
    type: String,
  })
  id: string;

  @ApiProperty({
    description: 'Name of the API key for identification',
    example: 'Production API Key',
    type: String,
  })
  name: string;

  @ApiProperty({
    description: 'First 8 characters of the API key for identification',
    example: 'sk_prod_1',
    type: String,
  })
  keyPrefix: string;

  @ApiProperty({
    enum: ApiKeyEnvironment,
    description: 'Environment of the API key',
    example: ApiKeyEnvironment.PRODUCTION,
    type: String,
  })
  environment: ApiKeyEnvironment;

  @ApiProperty({
    enum: ApiKeyStatus,
    description: 'Current status of the API key',
    example: ApiKeyStatus.ACTIVE,
    type: String,
  })
  status: ApiKeyStatus;

  @ApiPropertyOptional({
    type: Date,
    description: 'Expiration date of the API key',
    example: '2025-12-31T23:59:59.000Z',
    nullable: true,
  })
  expiresAt?: Date;

  @ApiPropertyOptional({
    type: Date,
    description: 'Last time this API key was used',
    example: '2024-01-15T10:30:00.000Z',
    nullable: true,
  })
  lastUsedAt?: Date;

  @ApiProperty({
    description: 'API key creation timestamp',
    example: '2024-01-01T00:00:00.000Z',
    type: Date,
  })
  createdAt: Date;
}
