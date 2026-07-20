import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsString } from 'class-validator';
import { MessageDeliveryStatus as DeliveryStatus } from '../../messaging/message-delivery.entity';
import {
  MessageChannel as NotificationChannel,
  MessageStatus as NotificationStatus,
  MessagePriority as Priority,
} from '../../messaging/message.entity';

export class AnalyticsQueryDto {
  @ApiProperty({
    description: 'Tenant ID to filter analytics data',
    example: 'tenant-uuid-123',
  })
  @IsString()
  tenantId: string;

  @ApiPropertyOptional({
    description: 'Start date for analytics period (ISO 8601 format)',
    example: '2024-01-01T00:00:00Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for analytics period (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Notification channel to filter by',
    example: 'email',
    enum: NotificationChannel,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Notification or delivery status to filter by',
    example: 'delivered',
    enum: [
      ...Object.values(NotificationStatus),
      ...Object.values(DeliveryStatus),
    ],
  })
  @IsOptional()
  @IsEnum([
    ...Object.values(NotificationStatus),
    ...Object.values(DeliveryStatus),
  ])
  status?: NotificationStatus | DeliveryStatus;

  @ApiPropertyOptional({
    description: 'Message priority to filter by',
    example: 'high',
    enum: Priority,
  })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;
}

export class DeliveryStatsQueryDto {
  @ApiProperty({
    description: 'Tenant ID to filter delivery statistics',
    example: 'tenant-uuid-123',
  })
  @IsString()
  tenantId: string;

  @ApiPropertyOptional({
    description: 'Notification channel to filter by',
    example: 'sms',
    enum: NotificationChannel,
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: 'Start date for statistics period (ISO 8601 format)',
    example: '2024-01-01T00:00:00Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for statistics period (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}

export class TimeSeriesQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Time interval for grouping time series data',
    example: 'day',
    enum: ['hour', 'day', 'week', 'month'],
    default: 'day',
  })
  @IsOptional()
  @IsEnum(['hour', 'day', 'week', 'month'])
  interval?: 'hour' | 'day' | 'week' | 'month' = 'day';
}

export class ProviderAnalyticsQueryDto extends AnalyticsQueryDto {
  @ApiPropertyOptional({
    description: 'Provider ID to filter analytics by specific provider',
    example: 'provider-uuid-456',
  })
  @IsOptional()
  @IsString()
  providerId?: string;
}

export class DeliveryTrendsQueryDto {
  @ApiProperty({
    description: 'Tenant ID for delivery trends analysis',
    example: 'tenant-uuid-123',
  })
  @IsString()
  tenantId: string;

  @ApiProperty({
    description: 'Start date of current period (ISO 8601 format)',
    example: '2024-06-01T00:00:00Z',
    format: 'date-time',
  })
  @IsDateString()
  currentPeriodStart: string;

  @ApiProperty({
    description: 'End date of current period (ISO 8601 format)',
    example: '2024-06-30T23:59:59Z',
    format: 'date-time',
  })
  @IsDateString()
  currentPeriodEnd: string;

  @ApiProperty({
    description: 'Start date of previous period for comparison (ISO 8601 format)',
    example: '2024-05-01T00:00:00Z',
    format: 'date-time',
  })
  @IsDateString()
  previousPeriodStart: string;

  @ApiProperty({
    description: 'End date of previous period for comparison (ISO 8601 format)',
    example: '2024-05-31T23:59:59Z',
    format: 'date-time',
  })
  @IsDateString()
  previousPeriodEnd: string;
}
