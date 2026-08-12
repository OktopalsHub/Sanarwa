import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { CorrelationIdMiddleware } from './common/logging/correlation-id.middleware';
import { LoggingModule } from './common/logging/logging.module';

import { RedisModule } from '@nestjs-modules/ioredis';
import { BullModule } from '@nestjs/bull';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AlertModule } from './common/alerts/alert.module';
import { ErrorsModule } from './common/errors';
import { ErrorHandlingModule } from './common/errors/error-handling.module';
import { MetricsMiddleware } from './common/health/middleware/metrics.middleware';
import { PasswordService } from './common/helpers/password.service';
import { GlobalErrorInterceptor } from './common/interceptors/global-error.interceptor';
import { AsyncLoggingInterceptor } from './common/logging';
import { ErrorAlertingInterceptor } from './common/monitoring/interceptors/error-alerting.interceptor';
import { MetricsInterceptor } from './common/monitoring/interceptors/metrics.interceptor';
import { MonitoringModule } from './common/monitoring/monitoring.module';
import { AuditLogModule } from './common/security/audit-log.module';
import { AuditLogInterceptor } from './common/security/interceptors/audit-log.interceptor';
import { appConfig, jwtConfig, queueConfig, redisConfig } from './config';
import { validate } from './config/environment.validator';
import loggingConfig from './config/logging.config';
import { dataSourceOptions } from './database/data-source';
import { AnalyticsModule } from './modules/analytics/analytics.module';
import { CampaignModule } from './modules/campaign/campaign.module';
import { ApiKeyModule } from './modules/api-key/api-key.module';
import { AuthModule } from './modules/auth/auth.module';
import { AuthGuard } from './modules/auth/guards/jwt-auth.guard';
import { BillingModule } from './modules/billing/billing.module';
import { BrandModule } from './modules/brand/brand.module';
import { ComplianceModule } from './modules/compliance/compliance.module';
import { ConfigurationModule } from './modules/configuration/configuration.module';
import { EnvironmentValidationService } from './modules/configuration/services/environment-validation.service';
import { InviteModule } from './modules/invite/invite.module';
import { MessagingModule } from './modules/messaging/messaging.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { ProjectModule } from './modules/project/project.module';
import { ProviderModule } from './modules/provider/provider.module';
import { PushCertificatesModule } from './modules/push-certificates/push-certificates.module';
import { TemplateModule } from './modules/template';
import { TenantMemberModule } from './modules/tenant-member/tenant-member.module';
import { TenantModule } from './modules/tenant/tenant.module';
import { UserModule } from './modules/user/user.module';
import { WebhookModule } from './modules/webhook/webhook.module';
import { WhatsAppModule } from './modules/whatsapp/whatsapp.module';

import { SecurityModule } from './common/security/security.module';

@Module({
  imports: [
    // Configuration Module
    ConfigModule.forRoot({
      isGlobal: true,
      load: [appConfig, redisConfig, queueConfig, jwtConfig, loggingConfig],
      validate,
      envFilePath: ['.env.local', '.env'],
    }),

    // Database Module
    TypeOrmModule.forRoot(dataSourceOptions),

    // Queue Module (Redis-based)
    BullModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        redis: configService.get('queue.redis'),
      }),
      inject: [ConfigService],
    }),

    // IORedis Module for @InjectRedis() decorator
    RedisModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => {
        const redisUrl = configService.get<string>('redis.url');
        return {
          type: 'single',
          url: redisUrl,
          options: {
            maxRetriesPerRequest: 3,
          },
        };
      },
      inject: [ConfigService],
    }),

    // Event Emitter Module
    EventEmitterModule.forRoot(),

    // Configuration Management Module
    ConfigurationModule,

    // Logging Module (must be imported early)
    LoggingModule,

    // Audit Log Module
    AuditLogModule,

    // Application Modules
    AuthModule,
    UserModule,
    WebhookModule,
    TenantModule,
    TenantMemberModule,
    InviteModule,
    BrandModule,
    ProjectModule,
    MessagingModule,
    TemplateModule,
    BillingModule,
    AnalyticsModule,
    CampaignModule,
    ProviderModule,
    NotificationsModule,
    WhatsAppModule,
    SecurityModule,

    ErrorsModule,
    ErrorHandlingModule,
    MonitoringModule,
    AlertModule,
    ApiKeyModule,
    ComplianceModule,
    PushCertificatesModule,

    // Throttler Module for rate limiting
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        throttlers: [
          {
            ttl: configService.get<number>('RATE_LIMIT_WINDOW', 60) * 1000, // Convert to milliseconds
            limit: configService.get<number>('DEFAULT_RATE_LIMIT', 100),
          },
        ],
      }),
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
    consumer
      .apply(
        CorrelationIdMiddleware,

        // FIXME: blocks better auth authentication
        // SecurityMiddleware,
        MetricsMiddleware,
      )
      .forRoutes('*path');
  }
}
