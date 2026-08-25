import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WebhookEvent } from "../entities/webhook.entity";

export class WebhookResponseDto {
  @ApiProperty({
    description: "Webhook unique identifier",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  id: string;

  @ApiPropertyOptional({
    description: "Friendly name for the webhook",
    example: "Delivery Status Webhook",
  })
  name?: string;

  @ApiProperty({
    description: "Webhook endpoint URL",
    example: "https://api.myapp.com/webhooks/notifications",
  })
  url: string;

  @ApiProperty({
    description: "Event types that trigger this webhook",
    example: ["email.delivered", "email.bounced", "sms.sent"],
    type: [String],
  })
  events: WebhookEvent[];

  @ApiProperty({
    description: "Whether the webhook is active",
    example: true,
  })
  active: boolean;

  @ApiProperty({
    description: "Creation timestamp",
    example: "2024-12-20T17:28:00Z",
  })
  createdAt: Date;

  @ApiProperty({
    description: "Last update timestamp",
    example: "2024-12-20T17:28:00Z",
  })
  updatedAt: Date;
}
