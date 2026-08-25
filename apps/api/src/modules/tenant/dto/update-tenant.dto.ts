import { ApiPropertyOptional } from "@nestjs/swagger";
import { PartialType } from "@nestjs/mapped-types";
import { IsEnum, IsOptional, IsString, Length, Matches } from "class-validator";
import { CreateTenantDto } from "./create-tenant.dto";
import { TenantStatus } from "src/common/enums";

export class UpdateTenantDto extends PartialType(CreateTenantDto) {
  @ApiPropertyOptional({
    description: "Tenant name",
    example: "Acme Corporation",
    minLength: 1,
    maxLength: 255,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(1, 255)
  name?: string;

  @ApiPropertyOptional({
    description: "Tenant subdomain",
    example: "acme-corp",
    minLength: 3,
    maxLength: 100,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(3, 100)
  @Matches(/^[a-z0-9-]+$/, {
    message: "Subdomain must contain only lowercase letters, numbers, and hyphens",
  })
  subdomain?: string;

  @ApiPropertyOptional({
    description: "Tenant status",
    enum: TenantStatus,
    example: TenantStatus.ACTIVE,
    type: String,
  })
  @IsOptional()
  @IsEnum(TenantStatus)
  status?: TenantStatus;

  @ApiPropertyOptional({
    description: "Tenant description",
    example: "A description of the tenant",
    minLength: 1,
    maxLength: 500,
    type: String,
  })
  @IsOptional()
  @IsString()
  @Length(1, 500)
  description?: string;
}
