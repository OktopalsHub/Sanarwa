import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

export class WebhookConfigDto {
  @ApiProperty({
    description: 'Webhook URL endpoint',
    example: 'https://example.com/webhook',
  })
  @IsString()
  url: string;

  @ApiPropertyOptional({
    description: 'Secret key for webhook signature verification',
    example: 'webhook-secret-key',
  })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({
    description: 'Custom headers to include in webhook requests',
    example: { Authorization: 'Bearer token', 'X-Custom': 'value' },
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Number of retry attempts for failed webhook deliveries',
    example: 3,
    minimum: 1,
    maximum: 10,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  retryAttempts?: number;

  @ApiPropertyOptional({
    description: 'Timeout in milliseconds for webhook requests',
    example: 10000,
    minimum: 0,
    maximum: 60000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60000)
  timeout?: number;
}

export class RegisterWebhookDto {
  @ApiProperty({
    description: 'Tenant ID for webhook registration',
    example: 'tenant-uuid-123',
  })
  @IsString()
  tenantId: string;

  @ApiProperty({
    description: 'Webhook URL endpoint',
    example: 'https://example.com/webhook',
  })
  @IsString()
  url: string;

  @ApiPropertyOptional({
    description: 'Secret key for webhook signature verification',
    example: 'webhook-secret-key',
  })
  @IsOptional()
  @IsString()
  secret?: string;

  @ApiPropertyOptional({
    description: 'Custom headers to include in webhook requests',
    example: { Authorization: 'Bearer token', 'X-Custom': 'value' },
  })
  @IsOptional()
  @IsObject()
  headers?: Record<string, string>;

  @ApiPropertyOptional({
    description: 'Number of retry attempts for failed webhook deliveries',
    example: 3,
    minimum: 1,
    maximum: 10,
    default: 3,
  })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10)
  retryAttempts?: number = 3;

  @ApiPropertyOptional({
    description: 'Timeout in milliseconds for webhook requests',
    example: 10000,
    minimum: 0,
    maximum: 60000,
    default: 10000,
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(60000)
  timeout?: number = 10000;
}
