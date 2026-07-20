import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional, IsString, MinLength } from 'class-validator';
import { CampaignStatus, CampaignType } from '../entities/campaign.entity';

export class CreateCampaignDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({ enum: ['one_time', 'recurring', 'triggered', 'drip'] })
  @IsOptional()
  @IsEnum(['one_time', 'recurring', 'triggered', 'drip'] as const)
  type?: CampaignType;

  @ApiPropertyOptional({ enum: ['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'] })
  @IsOptional()
  @IsEnum(['draft', 'scheduled', 'active', 'paused', 'completed', 'cancelled'] as const)
  status?: CampaignStatus;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  channels?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  audience?: Record<string, unknown>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  schedule?: Record<string, unknown>;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  templates?: Record<string, unknown>[];
}
