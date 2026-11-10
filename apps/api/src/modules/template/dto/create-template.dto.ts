import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from "class-validator";
import { TemplateStatus } from "../../../common/enums";
import { TemplateVariable } from "../../../common/interfaces";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";

export class CreateTemplateDto {
  @ApiProperty({
    description: "Template name",
    example: "Welcome Email Template",
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: "Template description",
    example: "A template for welcoming new users",
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({
    description: "Notification channel for the template",
    enum: NotificationChannel,
    example: "email",
  })
  @IsEnum(NotificationChannel)
  channel: NotificationChannel;

  @ApiPropertyOptional({
    description: "Email subject line (for email templates)",
    example: "Welcome to Our Platform!",
  })
  @IsOptional()
  @IsString()
  subject?: string;

  @ApiProperty({
    description: "Template body",
    example: "Hello {{name}}, welcome to our platform!",
  })
  @IsString()
  data: string;

  @ApiProperty({
    description: "Template variables configuration",
    type: [Object],
    example: [
      { name: "name", type: "string", required: true },
      { name: "email", type: "string", required: false },
    ],
  })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => Object)
  variables: TemplateVariable[];

  @ApiPropertyOptional({
    description: "Template status",
    enum: TemplateStatus,
    example: TemplateStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(TemplateStatus)
  status?: TemplateStatus;

  @ApiPropertyOptional({
    description: "Whether this is the default template",
    example: false,
  })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;

  @ApiPropertyOptional({
    description: "ID of the parent template",
    example: "parent-template-uuid",
  })
  @IsOptional()
  @IsString()
  parentTemplateId?: string;

  @ApiPropertyOptional({
    description: "Styling configuration for the template",
    example: {
      backgroundColor: "#ffffff",
      textColor: "#000000",
      fontFamily: "Arial",
      fontSize: "14px",
      customCss: "body { margin: 0; }",
    },
  })
  @IsOptional()
  @IsObject()
  styling?: {
    backgroundColor?: string;
    textColor?: string;
    fontFamily?: string;
    fontSize?: string;
    customCss?: string;
  };

  @ApiPropertyOptional({
    description: "NotificationChannel-specific configuration",
  })
  @IsOptional()
  @IsObject()
  channelSpecific?: any;

  @ApiPropertyOptional({
    description: "Additional metadata",
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  @ApiPropertyOptional({
    description: "ID of the user who created the template",
    example: "user-uuid",
  })
  @IsOptional()
  @IsString()
  createdBy?: string;
}
