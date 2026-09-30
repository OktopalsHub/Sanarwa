import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsObject, IsOptional, IsString } from "class-validator";
import { ProjectStatus } from "src/common/enums";

export class CreateProjectDto {
  @ApiProperty({
    description: "Project name",
    example: "My Project",
    type: String,
  })
  @IsString()
  name: string;

  @ApiPropertyOptional({
    description: "Project description",
    example: "A description of the project",
    type: String,
  })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    description: "Project status",
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
    type: String,
  })
  @IsOptional()
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;

  @ApiPropertyOptional({
    description: "Brand ID associated with the project",
    example: "123e4567-e89b-12d3-a456-426614174000",
    type: String,
  })
  @IsOptional()
  @IsString()
  brandId?: string;

  @ApiPropertyOptional({
    description: "Additional project metadata",
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;
}
