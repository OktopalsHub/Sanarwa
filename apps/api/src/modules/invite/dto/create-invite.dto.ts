import {
  IsArray,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TenantMemberRole } from 'src/common/enums';

export class CreateInviteDto {
  @ApiProperty({
    description: 'Email address of the user to invite',
    example: 'user@example.com',
    format: 'email',
  })
  @IsEmail()
  email: string;

  @ApiPropertyOptional({
    description: 'Role to assign to the invited user',
    enum: TenantMemberRole,
    example: TenantMemberRole.MEMBER,
    default: TenantMemberRole.MEMBER,
  })
  @IsEnum(TenantMemberRole)
  @IsOptional()
  role?: TenantMemberRole = TenantMemberRole.MEMBER;
}
