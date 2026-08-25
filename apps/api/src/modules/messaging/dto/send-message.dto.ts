import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import { IsArray, IsEnum, IsObject, IsOptional, IsString, ValidateNested } from "class-validator";
import { MessageChannel, MessagePriority, MessageRecipient } from "../message.entity";

export class SendMessageDto {
  @ApiProperty({
    description: "Channels to send the message through",
    enum: MessageChannel,
    isArray: true,
    example: [MessageChannel.EMAIL, MessageChannel.SMS],
  })
  @IsArray()
  @IsEnum(MessageChannel, { each: true })
  channels: MessageChannel[];

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
    description: "Data for template variables or message content",
    example: { name: "John", orderNumber: "12345" },
  })
  @IsObject()
  data: Record<string, any>;

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
    description: "Message content/body",
    example: "Thank you for signing up!",
  })
  @IsOptional()
  @IsString()
  content?: string;

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
