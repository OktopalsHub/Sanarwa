import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  BOUNCED = 'bounced',
  OPENED = 'opened',
  CLICKED = 'clicked',
}

export class NotificationResponseDto {
  @ApiProperty({ description: 'Notification ID' })
  id: string;

  @ApiProperty({ description: 'Notification status' })
  status: string;

  @ApiPropertyOptional({ description: 'Error message if failed' })
  error?: string;

  @ApiProperty({ description: 'Creation timestamp' })
  createdAt: Date;
}

export class NotificationStatusDto {
  @ApiProperty({ description: 'Notification ID' })
  id: string;

  @ApiProperty({ enum: DeliveryStatus, description: 'Delivery status' })
  status: DeliveryStatus;

  @ApiProperty({ description: 'Last updated timestamp' })
  updatedAt: Date;

  @ApiPropertyOptional({ description: 'Delivery attempts' })
  retryCount?: number;

  @ApiPropertyOptional({ description: 'Error details if failed' })
  errorDetails?: string;
}

export class BulkNotificationResponseDto {
  @ApiProperty({ description: 'Total notifications processed' })
  total: number;

  @ApiProperty({ description: 'Successfully sent notifications' })
  successful: number;

  @ApiProperty({ description: 'Failed notifications' })
  failed: number;

  @ApiProperty({ type: [NotificationResponseDto], description: 'Individual notification results' })
  results: NotificationResponseDto[];
}