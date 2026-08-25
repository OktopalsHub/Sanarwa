import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { provideBaseRepository } from "../../database/repositories/provide-base-repository";
import { TenantContextGuard } from "../../common/guards/tenant-context.guard";
import { TenantMemberGuard } from "../../common/guards/tenant-member.guard";
import { TenantMember } from "./entities/tenant-member.entity";
import { TenantMemberController } from "./tenant-member.controller";
import { TenantMemberService } from "./tenant-member.service";
import { TENANT_MEMBER_REPO } from "./tenant-member.tokens";
import { AuthModule } from "../auth/auth.module";

@Module({
  imports: [TypeOrmModule.forFeature([TenantMember]), AuthModule],
  controllers: [TenantMemberController],
  providers: [
    TenantMemberService,
    TenantMemberGuard,
    TenantContextGuard,
    provideBaseRepository(TenantMember, TENANT_MEMBER_REPO),
  ],
  exports: [TenantMemberService, TenantMemberGuard, TenantContextGuard, TENANT_MEMBER_REPO],
})
export class TenantMemberModule {}
