import { ApiPropertyOptional } from "@nestjs/swagger";
import { IsEnum, IsOptional, IsString } from "class-validator";
import { PaginationDto } from "src/common/dto/pagination.dto";
import { TenantMemberRole } from "src/common/enums";

export class UserTenantsQueryDto extends PaginationDto {
  @ApiPropertyOptional({
    description: "Search by tenant name or subdomain",
    example: "acme",
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: "Filter by user role in tenant",
    enum: TenantMemberRole,
    example: TenantMemberRole.OWNER,
  })
  @IsOptional()
  @IsEnum(TenantMemberRole)
  role?: TenantMemberRole;

  @ApiPropertyOptional({
    description: "Sort field",
    enum: ["createdAt", "role", "tenantName"],
    default: "createdAt",
  })
  @IsOptional()
  @IsString()
  sortBy?: "createdAt" | "role" | "tenantName" = "createdAt";

  @ApiPropertyOptional({
    description: "Sort order",
    enum: ["ASC", "DESC"],
    default: "DESC",
  })
  @IsOptional()
  @IsEnum(["ASC", "DESC"])
  sortOrder?: "ASC" | "DESC" = "DESC";
}
