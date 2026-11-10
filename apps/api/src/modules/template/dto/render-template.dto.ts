import { IsObject, IsOptional, IsString } from "class-validator";

export class RenderTemplateDto {
  @IsString()
  templateId: string;

  @IsString()
  tenantId: string;

  @IsObject()
  variables: Record<string, any>;

  @IsOptional()
  @IsString()
  version?: string;
}

export class RenderedTemplate {
  subject?: string;
  data: string;
  channelSpecific?: any;
  variables: Record<string, any>;
  templateId: string;
  version: number;
}
