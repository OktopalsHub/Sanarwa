import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuditEventType } from '../audit-log.service';

export class AuditQueryDto {
  @ApiProperty({
    description: 'Tenant ID to filter audit logs',
    example: 'tenant-uuid-123',
  })
  @IsString()
  tenantId: string;

  @ApiPropertyOptional({
    description: 'Type of audit event to filter by',
    example: 'user_login',
    enum: AuditEventType,
  })
  @IsOptional()
  @IsEnum(AuditEventType)
  eventType?: AuditEventType;

  @ApiPropertyOptional({
    description: 'Resource type affected by the audit event',
    example: 'user',
  })
  @IsOptional()
  @IsString()
  resourceType?: string;

  @ApiPropertyOptional({
    description: 'ID of the resource affected',
    example: 'resource-uuid-456',
  })
  @IsOptional()
  @IsString()
  resourceId?: string;

  @ApiPropertyOptional({
    description: 'User ID who performed the action',
    example: 'user-uuid-789',
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: 'Start date for audit log period (ISO 8601 format)',
    example: '2024-01-01T00:00:00Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'End date for audit log period (ISO 8601 format)',
    example: '2024-12-31T23:59:59Z',
    format: 'date-time',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({
    description: 'Maximum number of audit log entries to return',
    example: 50,
    minimum: 1,
    default: 50,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(1)
  limit?: number = 50;

  @ApiPropertyOptional({
    description: 'Number of entries to skip for pagination',
    example: 0,
    minimum: 0,
    default: 0,
  })
  @IsOptional()
  @Transform(({ value }) => parseInt(value))
  @IsNumber()
  @Min(0)
  offset?: number = 0;
}

export class AuditExportDto extends AuditQueryDto {
  @ApiPropertyOptional({
    description: 'Export format for audit logs',
    example: 'json',
    enum: ['json', 'csv'],
    default: 'json',
  })
  @IsOptional()
  @IsEnum(['json', 'csv'])
  format?: 'json' | 'csv' = 'json';
}
