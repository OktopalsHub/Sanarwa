import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { JwtModule } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { NotificationLog } from "./entities/notification-log.entity";
import { InAppNotification } from "../messaging/entities/in-app-notification.entity";
import { NotificationTransportService } from "./transport/notification-transport.service";
import { EmailInboundController } from "./transport/inbound-email/email-inbound.controller";
import { NotificationTransportController } from "./controllers/notification-transport.controller";
import { NotificationCenterService } from "./services/notification-center.service";
import { NotificationCenterController } from "./controllers/notification-center.controller";
import { PublicPushController } from "./controllers/public-push.controller";
import { NotificationGateway } from "./gateways/notification.gateway";
import { NotificationEngineService } from "./engine/notification-engine.service";
import { NotificationStorageModule } from "./storage/notification-storage.module";
import { ProviderModule } from "../provider/provider.module";
import { ApiKeyModule } from "../api-key/api-key.module";
import { MessagingEntitiesModule } from "../messaging/shared/messaging-entities.module";
import { NotificationQueueModule } from "../messaging/queue/notification-queue.module";
import { IdempotencyModule } from "../messaging/idempotency/idempotency.module";
import { PreferencesModule } from "../preferences/preferences.module";
import { UnifiedSendService } from "../messaging/unified-send.service";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";
import { WebPushSubscriptionService } from "../provider/services/web-push-subscription.service";
import { DeviceRegistration } from "../provider/entities/device-registration.entity";
import { TopicsModule } from "../topics/topics.module";
import { TenantSettings } from "../tenant/entities/tenant-settings.entity";
import { QuotasModule } from "../quotas/quotas.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationLog,
      InAppNotification,
      TenantSettings,
      DeviceRegistration,
    ]),
    MessagingEntitiesModule,
    NotificationQueueModule,
    IdempotencyModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>("JWT_AUTH_SECRET"),
        signOptions: { expiresIn: "24h" },
      }),
      inject: [ConfigService],
    }),
    ProviderModule,
    ApiKeyModule,
    TenantMemberModule,
    PreferencesModule,
    TopicsModule,
    QuotasModule,
    NotificationStorageModule,
  ],
  controllers: [
    NotificationTransportController,
    EmailInboundController,
    NotificationCenterController,
    PublicPushController,
  ],
  providers: [
    NotificationTransportService,
    NotificationCenterService,
    NotificationGateway,
    NotificationEngineService,
    UnifiedSendService,
    WebPushSubscriptionService,
  ],
  exports: [
    UnifiedSendService,
    NotificationTransportService,
    NotificationCenterService,
    NotificationGateway,
    NotificationEngineService,
  ],
})
export class NotificationsModule {}
