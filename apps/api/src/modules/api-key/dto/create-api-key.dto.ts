import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
  Max,
} from 'class-validator';
import { ApiKeyEnvironment } from '../entities/api-key.entity';

export class CreateApiKeyDto {
  @ApiProperty({
    description: 'Name of the API key for identification',
    example: 'Production API Key',
    type: String,
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: 'Environment for the API key',
    enum: ApiKeyEnvironment,
    example: ApiKeyEnvironment.PRODUCTION,
    type: String,
  })
  @IsOptional()
  @IsEnum(ApiKeyEnvironment)
  environment?: ApiKeyEnvironment;

  @ApiPropertyOptional({
    description: 'List of permissions for the API key',
    type: [String],
    example: ['notifications:send', 'templates:read'],
  })
  @IsOptional()
  @IsArray()
  permissions?: string[];

  @ApiPropertyOptional({
    description: 'List of IP addresses allowed to use this API key',
    type: [String],
    example: ['192.168.1.1', '10.0.0.1'],
  })
  @IsOptional()
  @IsArray()
  ipWhitelist?: string[];

  @ApiPropertyOptional({
    description: 'Expiration date for the API key',
    example: '2025-12-31T23:59:59.000Z',
    type: String,
  })
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of requests per minute',
    example: 1000,
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimitPerMinute?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of requests per hour',
    example: 10000,
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimitPerHour?: number;

  @ApiPropertyOptional({
    description: 'Maximum number of requests per day',
    example: 100000,
    type: Number,
    minimum: 1,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  rateLimitPerDay?: number;

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: Object,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
