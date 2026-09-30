import { ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsArray,
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from "class-validator";
import { ApiKeyStatus } from "../entities/api-key.entity";

export class UpdateApiKeyDto {
  @ApiPropertyOptional({
    description: "New name for the API key",
    example: "Updated API Key Name",
    type: String,
  })
  @IsString()
  @IsOptional()
  name?: string;

  @ApiPropertyOptional({
    description: "New status for the API key",
    enum: ApiKeyStatus,
    example: ApiKeyStatus.ACTIVE,
    type: String,
  })
  @IsEnum(ApiKeyStatus)
  @IsOptional()
  status?: ApiKeyStatus;

  @ApiPropertyOptional({
    description: "Updated list of permissions",
    type: [String],
    example: ["notifications:send", "templates:read", "templates:write"],
  })
  @IsArray()
  @IsOptional()
  permissions?: string[];

  @ApiPropertyOptional({
    description: "Updated list of IP addresses allowed to use this API key",
    type: [String],
    example: ["192.168.1.1", "10.0.0.1", "172.16.0.1"],
  })
  @IsArray()
  @IsOptional()
  ipWhitelist?: string[];

  @ApiPropertyOptional({
    description: "New expiration date for the API key",
    example: "2025-12-31T23:59:59.000Z",
    type: String,
  })
  @IsDateString()
  @IsOptional()
  expiresAt?: string;

  @ApiPropertyOptional({
    description: "Updated maximum number of requests per minute",
    example: 2000,
    type: Number,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  rateLimitPerMinute?: number;

  @ApiPropertyOptional({
    description: "Updated maximum number of requests per hour",
    example: 20000,
    type: Number,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  rateLimitPerHour?: number;

  @ApiPropertyOptional({
    description: "Updated maximum number of requests per day",
    example: 200000,
    type: Number,
    minimum: 1,
  })
  @IsNumber()
  @Min(1)
  @IsOptional()
  rateLimitPerDay?: number;

  @ApiPropertyOptional({
    description: "Updated metadata",
    type: Object,
  })
  @IsOptional()
  metadata?: Record<string, any>;
}
