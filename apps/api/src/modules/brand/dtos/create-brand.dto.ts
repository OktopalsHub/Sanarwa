import {
  IsEmail,
  IsHexColor,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from "class-validator";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { WhiteLabelConfig } from "src/common/interfaces";

export class CreateBrandDto {
  @ApiProperty({
    description: "Brand name",
    example: "My Brand",
    maxLength: 255,
  })
  @IsString()
  @MaxLength(255)
  name: string;

  @ApiPropertyOptional({
    description: "Brand description",
    example: "A description of the brand",
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiPropertyOptional({
    description: "Brand domain",
    example: "mybrand.com",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  domain?: string;

  @ApiPropertyOptional({
    description: "Brand logo URL",
    example: "https://example.com/logo.png",
  })
  @IsOptional()
  @IsString()
  logo?: string;

  @ApiPropertyOptional({
    description: "Primary brand color in hex format",
    example: "#FF5733",
  })
  @IsOptional()
  @IsHexColor()
  primaryColor?: string;

  @ApiPropertyOptional({
    description: "Secondary brand color in hex format",
    example: "#33FF57",
  })
  @IsOptional()
  @IsHexColor()
  secondaryColor?: string;

  @ApiPropertyOptional({
    description: "Default from email address",
    example: "noreply@mybrand.com",
    format: "email",
    maxLength: 255,
  })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  defaultFromEmail?: string;

  @ApiPropertyOptional({
    description: "Default from name",
    example: "My Brand Support",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  defaultFromName?: string;

  @ApiPropertyOptional({
    description: "Reply-to email address",
    example: "support@mybrand.com",
    maxLength: 255,
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  replyToEmail?: string;

  @ApiPropertyOptional({
    description: "White label configuration",
  })
  @IsOptional()
  @IsObject()
  whiteLabelConfig?: WhiteLabelConfig;

  @ApiPropertyOptional({
    description: "Email settings configuration",
    example: {
      signature: "Best regards, My Brand Team",
      footerText: "© 2024 My Brand",
      unsubscribeText: "Unsubscribe",
      trackingEnabled: true,
    },
  })
  @IsOptional()
  @IsObject()
  emailSettings?: {
    signature?: string;
    footerText?: string;
    unsubscribeText?: string;
    trackingEnabled?: boolean;
  };

  @ApiPropertyOptional({
    description: "SMS settings configuration",
    example: {
      defaultSenderId: "MyBrand",
      optOutKeywords: ["STOP", "UNSUBSCRIBE"],
      optInKeywords: ["START", "SUBSCRIBE"],
    },
  })
  @IsOptional()
  @IsObject()
  smsSettings?: {
    defaultSenderId?: string;
    optOutKeywords?: string[];
    optInKeywords?: string[];
  };

  @ApiPropertyOptional({
    description: "Social media links",
    example: {
      website: "https://mybrand.com",
      facebook: "https://facebook.com/mybrand",
      twitter: "https://twitter.com/mybrand",
      linkedin: "https://linkedin.com/company/mybrand",
      instagram: "https://instagram.com/mybrand",
    },
  })
  @IsOptional()
  @IsObject()
  socialLinks?: {
    website?: string;
    facebook?: string;
    twitter?: string;
    linkedin?: string;
    instagram?: string;
  };

  @ApiPropertyOptional({
    description: "Additional metadata",
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
