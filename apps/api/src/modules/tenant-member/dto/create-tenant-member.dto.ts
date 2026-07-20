import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsObject, IsOptional } from 'class-validator';
import { TenantMemberRole, TenantMemberStatus } from 'src/common/enums';
import { User } from '../../user/entities/user.entity';

export class CreateTenantMemberDto {
  @ApiProperty({
    description: 'Member role in the tenant',
    enum: TenantMemberRole,
    example: TenantMemberRole.MEMBER,
    type: String,
  })
  @IsEnum(TenantMemberRole)
  role: TenantMemberRole;

  @ApiPropertyOptional({
    description: 'Member status',
    enum: TenantMemberStatus,
    example: TenantMemberStatus.ACTIVE,
    type: String,
  })
  @IsOptional()
  @IsEnum(TenantMemberStatus)
  status?: TenantMemberStatus;

  @ApiPropertyOptional({
    description: 'Member permissions',
    type: [String],
    example: ['read', 'write'],
  })
  @IsOptional()
  @IsArray()
  permissions?: string[];

  @ApiPropertyOptional({
    description: 'Additional metadata',
    type: Object,
  })
  @IsOptional()
  @IsObject()
  metadata?: Record<string, any>;

  user?: User;
}
