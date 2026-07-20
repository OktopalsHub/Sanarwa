import { PartialType } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { TenantMemberStatus } from 'src/common/enums';
import { CreateTenantMemberDto } from './create-tenant-member.dto';

export class UpdateTenantMemberDto extends PartialType(CreateTenantMemberDto) {
  @IsEnum(TenantMemberStatus)
  @IsOptional()
  status?: TenantMemberStatus;
}
