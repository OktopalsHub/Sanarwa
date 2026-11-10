import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsBoolean, IsObject, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ConnectChannelDto {
  @ApiPropertyOptional({
    description: "Display name for the connection",
    example: "Support alerts",
  })
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(50)
  name?: string;

  @ApiProperty({
    description: "Provider credentials. Shape depends on the provider.",
    example: { botToken: "xoxb-...", defaultChannel: "C0123456789" },
  })
  @IsObject()
  config: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Whether sends should use this connection", default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class TestChannelDto {
  @ApiPropertyOptional({
    description: "Destination override (Slack channel id, Telegram chat id, WhatsApp number)",
  })
  @IsOptional()
  @IsString()
  to?: string;

  @ApiPropertyOptional({
    description: "Message body used for the test send",
    example: "Sanarwa test message",
  })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  message?: string;

  @ApiPropertyOptional({
    description:
      "Only verify credentials instead of sending a message. Defaults to true for WhatsApp.",
  })
  @IsOptional()
  @IsBoolean()
  verifyOnly?: boolean;
}
