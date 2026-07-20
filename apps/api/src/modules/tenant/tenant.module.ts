import {
  MiddlewareConsumer,
  Module,
  RequestMethod,
  forwardRef,
} from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { TenantMemberModule } from '../tenant-member/tenant-member.module';
import { UserModule } from '../user/user.module';
import { ProviderModule } from '../provider/provider.module';
import { BillingModule } from '../billing/billing.module';
import { Tenant } from './entities/tenant.entity';
import { TenantContextMiddleware } from './middleware/tenant-context.middleware';
import { TenantController } from './controllers/tenant.controller';
import { TenantRepository } from './tenant.repository';
import { TenantService } from './tenant.service';
import { QuotaController } from './controllers/quota.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Tenant]),
    AuthModule,
    UserModule,
    forwardRef(() => TenantMemberModule),
    forwardRef(() => ProviderModule),
    forwardRef(() => BillingModule),
  ],
  controllers: [TenantController, QuotaController],
  providers: [TenantService, TenantRepository],
  exports: [TenantService, TenantRepository],
})
export class TenantModule {
  configure(consumer: MiddlewareConsumer) {
    // Apply tenant context middleware to all routes except tenant management, health, and auth routes
    consumer
      .apply(TenantContextMiddleware)
      .exclude(
        { path: 'tenants', method: RequestMethod.ALL },
        { path: 'tenants/*path', method: RequestMethod.ALL },
        { path: 'health', method: RequestMethod.ALL },
        { path: 'health/*path', method: RequestMethod.ALL },
        { path: 'auth', method: RequestMethod.ALL },
        { path: 'auth/*path', method: RequestMethod.ALL },
        { path: '', method: RequestMethod.GET }, // Base route
      )
      .forRoutes('*path');
  }
}
