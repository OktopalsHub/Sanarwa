import { PartialType } from "@nestjs/swagger";
import { CreateTenantMemberDto } from "./create-tenant-member.dto";

export class UpdateTenantMemberDto extends PartialType(CreateTenantMemberDto) {}
