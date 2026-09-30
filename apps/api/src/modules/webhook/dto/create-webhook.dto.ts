import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsBoolean, IsOptional, IsString, IsUrl, MaxLength } from "class-validator";
import { WebhookEvent } from "../entities/webhook.entity";

export class CreateWebhookDto {
  @ApiPropertyOptional({
    description: "Friendly name for the webhook",
    example: "Delivery Status Webhook",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  name?: string;

  @ApiProperty({
    description: "Webhook endpoint URL",
    example: "https://api.myapp.com/webhooks/notifications",
  })
  @IsString()
  @IsUrl()
  url: string;

  @ApiPropertyOptional({
    description: "Secret for webhook signature verification",
    example: "whsec_1234567890abcdef",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  secret?: string;

  @ApiProperty({
    description: "Event types to trigger this webhook",
    example: ["email.delivered", "email.bounced", "sms.sent"],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  events: WebhookEvent[];

  @ApiPropertyOptional({
    description: "Whether the webhook is active",
    example: true,
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  active?: boolean = true;
}
