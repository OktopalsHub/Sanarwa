import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from "class-validator";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";

export class ChannelPreferenceDto {
  @ApiProperty({ enum: NotificationChannel, example: NotificationChannel.EMAIL })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;
}

export class SetPreferencesDto {
  @ApiProperty({ type: () => [ChannelPreferenceDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ChannelPreferenceDto)
  preferences: ChannelPreferenceDto[];
}

export class QuietHoursDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ example: "Europe/Berlin", description: "IANA timezone name" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  timezone: string;

  @ApiProperty({ example: 1320, description: "Minute of day the quiet window opens (0-1439)" })
  @IsInt()
  @Min(0)
  @Max(1439)
  startMinute: number;

  @ApiProperty({ example: 420, description: "Minute of day the quiet window closes (0-1439)" })
  @IsInt()
  @Min(0)
  @Max(1439)
  endMinute: number;
}

export class CreateSuppressionDto {
  @ApiProperty({ example: "user@example.com" })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  address: string;

  @ApiPropertyOptional({
    enum: NotificationChannel,
    description: "Channel-specific suppression; omitted means all channels",
  })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiProperty({
    example: "unsubscribe",
    description:
      "Why the address is suppressed (free-form, e.g. unsubscribe, bounce, complaint, manual)",
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(32)
  reason: string;
}

export class ListSuppressionsQueryDto {
  @ApiPropertyOptional({
    example: "user@",
    description: "Case-insensitive substring match on the address",
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string;

  @ApiPropertyOptional({ enum: NotificationChannel })
  @IsOptional()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({ example: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({ example: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
