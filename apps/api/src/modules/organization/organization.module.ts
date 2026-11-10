import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TenantMember } from "../tenant-member/entities/tenant-member.entity";
import { Member } from "./entities/member.entity";
import { Organization } from "./entities/organization.entity";
import { OrganizationService } from "./organization.service";

@Module({
  imports: [TypeOrmModule.forFeature([Organization, Member, TenantMember])],
  providers: [OrganizationService],
  exports: [OrganizationService],
})
export class OrganizationModule {}
