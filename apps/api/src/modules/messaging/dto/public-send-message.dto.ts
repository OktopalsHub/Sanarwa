import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayNotEmpty,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateIf,
} from 'class-validator';

export const PUBLIC_SEND_CHANNELS = [
  'email',
  'sms',
  'push',
  'whatsapp',
  'in_app',
  'webhook',
] as const;

export type PublicSendChannel = (typeof PUBLIC_SEND_CHANNELS)[number];

export class PublicSendMessageDto {
  @ApiProperty({
    enum: PUBLIC_SEND_CHANNELS,
    example: 'email',
  })
  @IsIn(PUBLIC_SEND_CHANNELS)
  channel: PublicSendChannel;

  @ApiProperty({
    description: 'Recipient address (email, phone, device token, etc.)',
    example: 'amaka@halo.ng',
    oneOf: [{ type: 'string' }, { type: 'array', items: { type: 'string' } }],
  })
  @ValidateIf(({ to }) => !Array.isArray(to))
  @IsString()
  @IsNotEmpty()
  @ValidateIf(({ to }) => Array.isArray(to))
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  to: string | string[];

  @ApiPropertyOptional({
    example: 'PayLink <receipts@paylink.ng>',
  })
  @IsOptional()
  @IsString()
  from?: string;

  @ApiPropertyOptional({ example: 'Receipt for ₦45,000' })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  html?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  text?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  templateId?: string;
}
