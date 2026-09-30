import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { TenantMemberRole, TenantMemberStatus } from "src/common/enums";

export class TenantMemberUserDto {
  @ApiProperty({
    description: "User unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
    type: String,
  })
  id: string;

  @ApiProperty({
    description: "User email address",
    example: "user@example.com",
    type: String,
  })
  email: string;

  @ApiPropertyOptional({
    description: "User name",
    example: "John Doe",
    type: String,
  })
  name?: string;

  @ApiPropertyOptional({
    description: "User avatar URL",
    example: "https://example.com/avatar.jpg",
    type: String,
  })
  image?: string;
}

export class TenantMemberTenantDto {
  @ApiProperty({
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
    type: String,
  })
  id: string;

  @ApiProperty({
    description: "Tenant name",
    example: "Acme Corp",
    type: String,
  })
  name: string;

  @ApiPropertyOptional({
    description: "Tenant subdomain",
    example: "acme-corp",
    type: String,
  })
  subdomain?: string;

  @ApiPropertyOptional({
    description: "Tenant status",
    example: "active",
    type: String,
  })
  status?: string;

  @ApiPropertyOptional({
    description: "Tenant creation timestamp",
    example: "2024-01-01T00:00:00.000Z",
    type: Date,
  })
  createdAt?: Date;
}

export class TenantMemberResponseDto {
  @ApiProperty({
    description: "Tenant member unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
    type: String,
  })
  id: string;

  @ApiProperty({
    description: "Member role in the tenant",
    enum: TenantMemberRole,
    example: TenantMemberRole.MEMBER,
    type: String,
  })
  role: TenantMemberRole;

  @ApiProperty({
    description: "Member status",
    enum: TenantMemberStatus,
    example: TenantMemberStatus.ACTIVE,
    type: String,
  })
  status: TenantMemberStatus;

  @ApiProperty({
    description: "User information",
    type: TenantMemberUserDto,
  })
  user: TenantMemberUserDto;

  @ApiPropertyOptional({
    description: "Tenant information (only included in some responses)",
    type: TenantMemberTenantDto,
  })
  tenant?: TenantMemberTenantDto;

  // @ApiProperty({
  //   description: 'Tenant member creation timestamp',
  //   example: '2024-01-01T00:00:00.000Z',
  //   type: Date,
  // })
  // createdAt: Date;

  // @ApiProperty({
  //   description: 'Tenant member last update timestamp',
  //   example: '2024-01-01T00:00:00.000Z',
  //   type: Date,
  // })
  // updatedAt: Date;
}
