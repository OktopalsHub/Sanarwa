import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  IsString,
  IsOptional,
  IsEnum,
  IsObject,
  IsArray,
  ValidateNested,
  IsIn,
} from "class-validator";
import { Type } from "class-transformer";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { CHAT_CHANNEL_PROVIDERS, ChatProvider } from "../../../common/enums/chat-provider.enum";

export enum Priority {
  LOW = "low",
  NORMAL = "normal",
  HIGH = "high",
  URGENT = "urgent",
}

export class NotificationRequestDto {
  @ApiProperty({ description: "Recipient identifier (email, phone number, user ID, etc.)" })
  @IsString()
  to: string;

  @ApiPropertyOptional({ description: "Template ID or name (use this OR html/message)" })
  @IsOptional()
  @IsString()
  template?: string;

  @ApiPropertyOptional({ description: "Raw HTML content for email (use this OR template)" })
  @IsOptional()
  @IsString()
  html?: string;

  @ApiPropertyOptional({ description: "Plain text message (use this OR template)" })
  @IsOptional()
  @IsString()
  message?: string;

  @ApiPropertyOptional({ description: "Email/notification subject" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    enum: NotificationChannel,
    description: "Notification channel (email, sms, whatsapp, etc.)",
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiPropertyOptional({ description: "Template variables (used when template is specified)" })
  @IsOptional()
  @IsObject()
  variables?: Record<string, any>;

  @ApiPropertyOptional({ enum: Priority, description: "Notification priority" })
  @IsOptional()
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({
    enum: CHAT_CHANNEL_PROVIDERS,
    description: "Chat provider used when channel is `chat` (defaults to slack)",
  })
  @IsOptional()
  @IsIn(CHAT_CHANNEL_PROVIDERS)
  chatProvider?: ChatProvider;

  @ApiPropertyOptional({ description: "Additional metadata" })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: "Brand ID for branded email sending" })
  @IsOptional()
  @IsString()
  brandId?: string;
}

export class BulkNotificationRequestDto {
  @ApiProperty({ type: [NotificationRequestDto], description: "Array of notifications" })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NotificationRequestDto)
  notifications: NotificationRequestDto[];
}
