import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateIf,
  ValidateNested,
} from "class-validator";
import { MessagePriority, MessageRecipient } from "../message.entity";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { CHAT_CHANNEL_PROVIDERS, ChatProvider } from "../../../common/enums/chat-provider.enum";

export class SendMessageDto {
  @ApiProperty({
    description: "Channels to send the message through",
    enum: NotificationChannel,
    isArray: true,
    example: [NotificationChannel.EMAIL, NotificationChannel.SMS],
  })
  @IsArray()
  @IsEnum(NotificationChannel, { each: true })
  channels: NotificationChannel[];

  @ApiProperty({
    description: "List of message recipients",
    type: () => [MessageRecipientDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MessageRecipientDto)
  recipients: MessageRecipientDto[];

  @ApiPropertyOptional({
    description: "Template ID to use for the message",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiProperty({
    description: "Template variables substituted into the template at render time",
    example: { name: "John", orderNumber: "12345" },
  })
  @IsObject()
  variables: Record<string, any>;

  @ApiPropertyOptional({
    description: "Message priority",
    enum: MessagePriority,
    example: MessagePriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(MessagePriority)
  priority?: MessagePriority;

  @ApiPropertyOptional({
    description: "Message subject (for email)",
    example: "Welcome to our service",
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({
    description: "Message body (raw text/HTML when not using a template)",
    example: "Thank you for signing up!",
  })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiPropertyOptional({
    description: "Schedule message for future delivery",
    example: "2024-12-31T23:59:59Z",
    type: Date,
  })
  @IsOptional()
  scheduledAt?: Date;

  @ApiPropertyOptional({
    description: "Additional metadata for the message",
    example: { campaign: "welcome-series" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: "Brand ID for branded messaging",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({
    description: "Chat provider used when the `chat` channel is selected (defaults to slack)",
    enum: CHAT_CHANNEL_PROVIDERS,
  })
  @IsOptional()
  @IsIn(CHAT_CHANNEL_PROVIDERS)
  chatProvider?: ChatProvider;

  @ApiPropertyOptional({
    description:
      "Fallback behaviour when a delivery fails terminally. `true` cascades through the " +
      "requested `channels[]` in order; an array of channels is appended after them. " +
      "When set, channels are attempted sequentially per recipient instead of in parallel.",
    example: true,
  })
  @IsOptional()
  @ValidateIf((dto) => typeof dto.fallback !== "boolean")
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NotificationChannel, { each: true })
  fallback?: boolean | NotificationChannel[];
}

export class MessageRecipientDto implements MessageRecipient {
  @ApiProperty({
    description: "Recipient identifier",
    example: "user-123",
  })
  @IsString()
  id: string;

  @ApiPropertyOptional({
    description: "Recipient email address",
    example: "user@example.com",
  })
  @IsOptional()
  @IsString()
  email?: string;

  @ApiPropertyOptional({
    description: "Recipient phone number",
    example: "+1234567890",
  })
  @IsOptional()
  @IsString()
  phone?: string;

  @ApiPropertyOptional({
    description: "Device push notification token",
    example: "ExponentPushToken[xxxxxxxxxxxxxxxxxxxxxx]",
  })
  @IsOptional()
  @IsString()
  deviceToken?: string;

  @ApiPropertyOptional({
    description: "WhatsApp phone number",
    example: "+1234567890",
  })
  @IsOptional()
  @IsString()
  whatsappNumber?: string;

  @ApiPropertyOptional({
    description: "User ID reference",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @IsOptional()
  @IsString()
  userId?: string;

  @ApiPropertyOptional({
    description: "Slack channel or user ID (or incoming webhook URL) for chat delivery",
    example: "C0123456789",
  })
  @IsOptional()
  @IsString()
  slackChannel?: string;

  @ApiPropertyOptional({
    description: "Slack incoming webhook URL for chat delivery",
    example: "https://hooks.slack.com/services/T000/B000/XXXX",
  })
  @IsOptional()
  @IsString()
  slackWebhookUrl?: string;

  @ApiPropertyOptional({
    description: "Discord incoming webhook URL for chat delivery",
    example: "https://discord.com/api/webhooks/123456/abc",
  })
  @IsOptional()
  @IsString()
  discordWebhookUrl?: string;

  @ApiPropertyOptional({
    description: "Telegram chat ID for chat delivery",
    example: "-1001234567890",
  })
  @IsOptional()
  @IsString()
  telegramChatId?: string;

  @ApiPropertyOptional({
    description: "Generic chat destination used when the provider-specific field is absent",
  })
  @IsOptional()
  @IsString()
  chatAddress?: string;

  @ApiPropertyOptional({
    description: "Additional recipient metadata",
    example: { preferredLanguage: "en" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}

export class BulkMessageDto {
  @ApiProperty({
    description: "Array of messages to send in bulk",
    type: () => [SendMessageDto],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SendMessageDto)
  messages: SendMessageDto[];

  @ApiPropertyOptional({
    description: "Batch identifier for tracking",
    example: "batch-2024-001",
  })
  @IsOptional()
  @IsString()
  batchId?: string;
}
