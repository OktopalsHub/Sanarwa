import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  ArrayNotEmpty,
  IsArray,
  IsDateString,
  IsDefined,
  IsEnum,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  Validate,
  ValidateIf,
  ValidateNested,
  ValidationArguments,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from "class-validator";
import { CHAT_CHANNEL_PROVIDERS, ChatProvider } from "../../../common/enums/chat-provider.enum";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { MessagePriority } from "../message.entity";
import { MessageRecipientDto } from "./send-message.dto";

@ValidatorConstraint({ name: "unifiedSendShape", async: false })
export class UnifiedSendShapeConstraint implements ValidatorConstraintInterface {
  validate(_: unknown, args?: ValidationArguments): boolean {
    const dto = args?.object as SendUnifiedDto | undefined;
    if (!dto) {
      return false;
    }

    const hasChannel = dto.channel !== undefined;
    const hasChannels = Array.isArray(dto.channels) && dto.channels.length > 0;
    if (hasChannel === hasChannels) {
      return false;
    }

    const hasTo = typeof dto.to === "string" && dto.to.length > 0;
    const hasRecipients = Array.isArray(dto.recipients) && dto.recipients.length > 0;

    return hasTo !== hasRecipients;
  }

  defaultMessage(): string {
    return "Provide exactly one of `to` or `recipients`, and exactly one of `channel` or `channels`";
  }
}

export class SendUnifiedDto {
  @ApiPropertyOptional({
    description: "Shorthand recipient address (used for every requested channel)",
    example: "user-42",
  })
  @ValidateIf((dto) => !dto.recipients || dto.recipients.length === 0)
  @IsDefined()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    description: "Single channel to send through",
    enum: NotificationChannel,
    example: NotificationChannel.EMAIL,
  })
  @ValidateIf((dto) => dto.channels === undefined || dto.channels.length === 0)
  @IsDefined()
  @IsEnum(NotificationChannel)
  channel?: NotificationChannel;

  @ApiPropertyOptional({
    description: "Channels to fan out to",
    enum: NotificationChannel,
    isArray: true,
    example: [NotificationChannel.IN_APP, NotificationChannel.EMAIL],
  })
  @ValidateIf((dto) => dto.channel === undefined)
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NotificationChannel, { each: true })
  channels?: NotificationChannel[];

  @ApiPropertyOptional({
    description: "List of message recipients",
    type: () => [MessageRecipientDto],
  })
  @Validate(UnifiedSendShapeConstraint)
  @ValidateIf((dto) => dto.to === undefined)
  @IsArray()
  @ArrayNotEmpty()
  @ValidateNested({ each: true })
  @Type(() => MessageRecipientDto)
  recipients?: MessageRecipientDto[];

  @ApiProperty({
    description: "Template variables substituted into the template at render time",
    example: { name: "John", orderNumber: "12345" },
  })
  @IsObject()
  variables: Record<string, any>;

  @ApiPropertyOptional({ description: "Template ID to render against `variables`" })
  @IsOptional()
  @IsString()
  templateId?: string;

  @ApiPropertyOptional({
    description: "Message priority",
    enum: MessagePriority,
    example: MessagePriority.NORMAL,
  })
  @IsOptional()
  @IsEnum(MessagePriority)
  priority?: MessagePriority;

  @ApiPropertyOptional({ description: "Message subject (email)" })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiPropertyOptional({ description: "Message body (raw text/HTML when not using a template)" })
  @IsOptional()
  @IsString()
  data?: string;

  @ApiPropertyOptional({
    description: "Schedule delivery for a future time",
    example: "2026-12-31T23:59:59Z",
  })
  @IsOptional()
  @IsDateString()
  scheduledAt?: string;

  @ApiPropertyOptional({
    description: "Additional metadata for the message",
    example: { campaign: "welcome-series" },
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({ description: "Brand ID for branded messaging" })
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
      "When set, channels are attempted sequentially per recipient instead of in parallel: " +
      "the first channel with an address goes out, the rest roll over on terminal failure.",
    example: true,
  })
  @IsOptional()
  @ValidateIf((dto) => typeof dto.fallback !== "boolean")
  @IsArray()
  @ArrayNotEmpty()
  @IsEnum(NotificationChannel, { each: true })
  fallback?: boolean | NotificationChannel[];
}

export interface UnifiedDeliverySummary {
  channel: NotificationChannel;
  status: "queued" | "failed";
  error?: string;
}

export interface UnifiedSendResponse {
  messageId?: string;
  /** Tracking id placed on the message and every queued delivery log row. */
  trackingId?: string;
  status: "queued" | "failed";
  deliveries: UnifiedDeliverySummary[];
}
