import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ApiKeyController } from "./api-key.controller";
import { ApiKeyService } from "./api-key.service";
import { ApiKeyVerificationService } from "./api-key-verification.service";
import { ApiKey } from "./entities/api-key.entity";
import { BetterAuthApiKey } from "./entities/better-auth-apikey.entity";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";
import { TenantModule } from "../tenant/tenant.module";
import { TokenManagementModule } from "../token-management/token-management.module";
import { OrganizationModule } from "../organization/organization.module";
import { ApiKeyAuthGuard } from "./guards/api-key-auth.guard";

@Module({
  imports: [
    TypeOrmModule.forFeature([ApiKey, BetterAuthApiKey]),
    TenantModule,
    TenantMemberModule,
    TokenManagementModule,
    OrganizationModule,
  ],
  controllers: [ApiKeyController],
  providers: [ApiKeyService, ApiKeyVerificationService, ApiKeyAuthGuard],
  exports: [ApiKeyService, ApiKeyVerificationService, ApiKeyAuthGuard],
})
export class ApiKeyModule {}
