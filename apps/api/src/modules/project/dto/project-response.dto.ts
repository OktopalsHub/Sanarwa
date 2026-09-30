import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { ProjectStatus } from "../../../common/enums";

export class ProjectTenantDto {
  @ApiProperty({
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
    type: String,
  })
  id: string;

  @ApiProperty({
    description: "Tenant name",
    example: "Acme Corporation",
    type: String,
  })
  name: string;

  @ApiProperty({
    description: "Tenant subdomain",
    example: "acme-corp",
    type: String,
  })
  subdomain: string;
}

export class ProjectCreatedByDto {
  @ApiProperty({
    description: "Tenant member unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
    type: String,
  })
  id: string;

  @ApiProperty({
    description: "User information",
    type: Object,
    example: {
      id: "123e4567-e89b-12d3-a456-426614174000",
      email: "user@example.com",
      name: "John Doe",
    },
  })
  user: {
    id: string;
    email: string;
    name?: string;
  };
}

export class ProjectResponseDto {
  @ApiProperty({
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
    type: String,
  })
  id: string;

  @ApiProperty({
    description: "Project name",
    example: "My Project",
    type: String,
  })
  name: string;

  @ApiPropertyOptional({
    description: "Project description",
    example: "A description of the project",
    type: String,
  })
  description?: string;

  @ApiProperty({
    description: "Project status",
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
    type: String,
  })
  status: ProjectStatus;

  @ApiPropertyOptional({
    description: "Project settings",
    type: Object,
    nullable: true,
  })
  settings?: {
    webhookUrl?: string;
    webhookSecret?: string;
    retryPolicy?: {
      maxRetries?: number;
      retryDelay?: number;
    };
    rateLimiting?: {
      enabled?: boolean;
      requestsPerMinute?: number;
    };
  };

  @ApiPropertyOptional({
    description: "Additional metadata",
    type: Object,
    nullable: true,
  })
  metadata?: Record<string, any>;

  @ApiProperty({
    description: "Tenant information",
    type: ProjectTenantDto,
  })
  tenant: ProjectTenantDto;

  @ApiPropertyOptional({
    description: "Created by information",
    type: ProjectCreatedByDto,
  })
  createdBy?: ProjectCreatedByDto;

  @ApiProperty({
    description: "Project creation timestamp",
    example: "2024-01-01T00:00:00.000Z",
    type: Date,
  })
  createdAt: Date;

  @ApiProperty({
    description: "Project last update timestamp",
    example: "2024-01-01T00:00:00.000Z",
    type: Date,
  })
  updatedAt: Date;
}

export class ProjectListResponseDto {
  @ApiProperty({
    description: "Project unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
    type: String,
  })
  id: string;

  @ApiProperty({
    description: "Project name",
    example: "My Project",
    type: String,
  })
  name: string;

  @ApiPropertyOptional({
    description: "Project description",
    example: "A description of the project",
    type: String,
  })
  description?: string;

  @ApiProperty({
    description: "Project status",
    enum: ProjectStatus,
    example: ProjectStatus.ACTIVE,
    type: String,
  })
  status: ProjectStatus;

  @ApiProperty({
    description: "Project creation timestamp",
    example: "2024-01-01T00:00:00.000Z",
    type: Date,
  })
  createdAt: Date;
}
