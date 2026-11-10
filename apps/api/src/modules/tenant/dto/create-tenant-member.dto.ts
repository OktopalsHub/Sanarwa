import { IsEnum, IsOptional } from "class-validator";
import { TenantMemberRole } from "../../../common/enums";

export class CreateTenantMemberDto {
  @IsEnum(TenantMemberRole)
  @IsOptional()
  role?: TenantMemberRole = TenantMemberRole.MEMBER;
}
