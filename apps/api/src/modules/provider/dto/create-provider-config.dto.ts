import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  Max,
  Min
} from 'class-validator';
import { NotificationChannel } from '../../../common/enums/notification-channel.enum';
import { ProviderType } from '../provider-config.entity';

export class CreateProviderConfigDto {
  @ApiProperty({
    description: 'Provider identifier',
    example: 'twilio',
  })
  @IsString()
  providerId: string;

  @ApiProperty({
    description: 'Provider display name',
    example: 'Twilio',
  })
  @IsString()
  providerName: string;

  @ApiProperty({
    description: 'Type of provider',
    enum: ProviderType,
    example: ProviderType.TWILIO,
  })
  @IsEnum(ProviderType)
  providerType: ProviderType;

  @ApiProperty({
    description: 'Notification channel this provider supports',
    enum: NotificationChannel,
    example: NotificationChannel.SMS,
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({
    description: 'Provider configuration object (API keys, secrets, etc.)',
    example: { apiKey: 'AC123...', authToken: 'secret123', fromNumber: '+1234567890' },
  })
  @IsObject()
  config: Record<string, any>;

  @ApiPropertyOptional({
    description: 'Provider priority (1 = highest priority)',
    minimum: 1,
    maximum: 10,
    default: 1,
    example: 1,
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(10)
  priority?: number = 1;

  @ApiPropertyOptional({
    description: 'Whether the provider is active',
    default: true,
    example: true,
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean = true;

  @ApiPropertyOptional({
    description: 'Whether this is the default provider for the channel',
    default: false,
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean = false;

  @ApiPropertyOptional({
    description: 'List of supported country codes (ISO 3166-1 alpha-2)',
    type: [String],
    example: ['US', 'CA', 'GB'],
  })
  @IsOptional()
  @IsString({ each: true })
  supportedCountries?: string[];

  @ApiPropertyOptional({
    description: 'Rate limit configuration for the provider',
    example: {
      requestsPerSecond: 10,
      requestsPerMinute: 100,
      requestsPerHour: 1000,
      requestsPerDay: 10000,
    },
  })
  @IsOptional()
  @IsObject()
  rateLimits?: {
    requestsPerSecond?: number;
    requestsPerMinute?: number;
    requestsPerHour?: number;
    requestsPerDay?: number;
  };

  @ApiPropertyOptional({
    description: 'Health check configuration for monitoring provider status',
    example: {
      url: 'https://status.twilio.com/api/v2/status.json',
      interval: 300,
      timeout: 5000,
      retries: 3,
    },
  })
  @IsOptional()
  @IsObject()
  healthCheck?: {
    url?: string;
    interval?: number;
    timeout?: number;
    retries?: number;
  };

  @ApiPropertyOptional({
    description: 'Additional provider metadata',
    example: { region: 'us-east-1', tier: 'production' },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
