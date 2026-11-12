import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { ScheduleModule } from "@nestjs/schedule";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { AppController } from "./app.controller";
import { AppService } from "./app.service";

import Redis from "ioredis";
import { CorrelationIdMiddleware } from "./common/logging/correlation-id.middleware";
import { RedisThrottlerStorage } from "./common/throttler/redis-throttler-storage";
import { LoggingModule } from "./common/logging/logging.module";

import { RedisModule } from "@nestjs-modules/ioredis";
import { BullModule } from "@nestjs/bullmq";
import { APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import type { ExecutionContext } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ErrorsModule } from "./common/errors";
import { ErrorHandlingModule } from "./common/errors/error-handling.module";
import { PasswordService } from "./common/helpers/password.service";
import { GlobalErrorInterceptor } from "./common/interceptors/global-error.interceptor";
import { AsyncLoggingInterceptor } from "./common/logging";
import { ErrorAlertingInterceptor } from "./common/monitoring/interceptors/error-alerting.interceptor";
import { MetricsInterceptor } from "./common/monitoring/interceptors/metrics.interceptor";
import { MonitoringModule } from "./common/monitoring/monitoring.module";
import { AuditLogModule } from "./common/security/audit-log.module";
import { AuditLogInterceptor } from "./common/security/interceptors/audit-log.interceptor";
import { appConfig, jwtConfig, queueConfig, redisConfig } from "./config";
import { validate } from "./config/environment.validator";
import loggingConfig from "./config/logging.config";
import { dataSourceOptions } from "./common/database/data-source";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { CampaignModule } from "./modules/campaign/campaign.module";
import { WorkflowModule } from "./modules/workflow/workflow.module";
import { ApiKeyModule } from "./modules/api-key/api-key.module";
import { AuthModule } from "./modules/auth/auth.module";
import { AuthGuard } from "./modules/auth/guards/jwt-auth.guard";
import { RolesGuard } from "./modules/auth/guards/roles.guard";
import { BillingModule } from "./modules/billing/billing.module";
import { BrandModule } from "./modules/brand/brand.module";
import { ComplianceModule } from "./modules/compliance/compliance.module";
import { ConfigurationModule } from "./modules/configuration/configuration.module";
import { EnvironmentValidationService } from "./modules/configuration/services/environment-validation.service";
import { InviteModule } from "./modules/invite/invite.module";
import { MessagingModule } from "./modules/messaging/messaging.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { ProjectModule } from "./modules/project/project.module";
import { ProviderModule } from "./modules/provider/provider.module";
import { ChannelsModule } from "./modules/channels/channels.module";
import { TopicsModule } from "./modules/topics/topics.module";
import { InAppModule } from "./modules/in-app/in-app.module";
import { PushCertificatesModule } from "./modules/push-certificates/push-certificates.module";
import { TemplateModule } from "./modules/template";
import { OrganizationModule } from "./modules/organization/organization.module";
import { TenantMemberModule } from "./modules/tenant-member/tenant-member.module";
import { TenantModule } from "./modules/tenant/tenant.module";
import { UserModule } from "./modules/user/user.module";
import { WebhookModule } from "./modules/webhook/webhook.module";
import { WhatsAppModule } from "./modules/whatsapp/whatsapp.module";

import { SecurityModule } from "./common/security/security.module";
import { SanarwaMcpModule } from "./modules/mcp/mcp.module";
import { QuotasModule } from "./modules/quotas/quotas.module";

@Module({
  imports: [
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, redisConfig, queueConfig, jwtConfig, loggingConfig],
      validate,
      envFilePath: [".env.local", ".env"],
    }),

    TypeOrmModule.forRoot(dataSourceOptions),

    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        connection: configService.get("queue.redis") ?? { host: "localhost", port: 6379 },
      }),
      inject: [ConfigService],
    }),

    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>("redis.url");
        return {
          type: "single",
          url: redisUrl,
          options: {
            maxRetriesPerRequest: 3,
          },
        };
      },
      inject: [ConfigService],
    }),

    EventEmitterModule.forRoot(),

    ConfigurationModule,

    LoggingModule,

    AuditLogModule,

    AuthModule,
    UserModule,
    WebhookModule,
    TenantModule,
    TenantMemberModule,
    OrganizationModule,
    InviteModule,
    BrandModule,
    ProjectModule,
    MessagingModule,
    TemplateModule,
    BillingModule,
    AnalyticsModule,
    CampaignModule,
    WorkflowModule,
    ProviderModule,
    ChannelsModule,
    TopicsModule,
    InAppModule,
    NotificationsModule,
    WhatsAppModule,
    SecurityModule,
    QuotasModule,

    ErrorsModule,
    ErrorHandlingModule,
    MonitoringModule,
    ApiKeyModule,
    ComplianceModule,
    PushCertificatesModule,
    SanarwaMcpModule,

    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redis = new Redis(
          configService.get<string>("redis.url") ?? "redis://localhost:6379",
          { maxRetriesPerRequest: 3 },
        );
        redis.on("error", () => undefined);
        return {
          skipIf: (context: ExecutionContext) => context.getType() !== "http",
          storage: new RedisThrottlerStorage(redis),
          throttlers: [
            {
              ttl: configService.get<number>("RATE_LIMIT_WINDOW", 60) * 1000,
              limit: configService.get<number>("DEFAULT_RATE_LIMIT", 100),
            },
          ],
        };
      },
      inject: [ConfigService],
    }),
  ],
  controllers: [AppController],
  providers: [
    AppService,
    EnvironmentValidationService,
    PasswordService,
    {
      provide: APP_GUARD,
      useClass: ThrottlerGuard,
    },
    {
      provide: APP_GUARD,
      useClass: AuthGuard,
    },
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AsyncLoggingInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditLogInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: GlobalErrorInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ErrorAlertingInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(CorrelationIdMiddleware).forRoutes("*path");
  }
}
