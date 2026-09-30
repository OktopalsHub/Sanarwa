import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TenantContextGuard } from "../../common/guards";
import { AuthModule } from "../auth/auth.module";
import { MessageDelivery } from "../messaging/message-delivery.entity";
import { Message } from "../messaging/message.entity";
import { NotificationLog } from "../notifications/entities/notification-log.entity";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";
import { AnalyticsController } from "./analytics.controller";
import { AnalyticsAuditController } from "./analytics-audit.controller";
import { AnalyticsInsightsController } from "./analytics-insights.controller";
import { AnalyticsPerformanceController } from "./analytics-performance.controller";
import { AnalyticsWebhooksController } from "./analytics-webhooks.controller";
import { AnalyticsService } from "./analytics.service";
import { AdvancedAnalyticsService } from "./advanced-analytics.service";
import { AuditLogService } from "./audit-log.service";
import { DeliveryTrackingService } from "./delivery-tracking.service";
import { PerformanceMetricsService } from "./performance-metrics.service";
import { WebhookService } from "./webhook.service";
import { WebhookQueueModule } from "./queue/webhook-queue.module";

@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageDelivery, NotificationLog]),
    AuthModule,
    TenantMemberModule,
    WebhookQueueModule,
  ],
  controllers: [
    AnalyticsController,
    AnalyticsWebhooksController,
    AnalyticsAuditController,
    AnalyticsPerformanceController,
    AnalyticsInsightsController,
  ],
  providers: [
    AnalyticsService,
    AdvancedAnalyticsService,
    DeliveryTrackingService,
    WebhookService,
    PerformanceMetricsService,
    AuditLogService,
    TenantContextGuard,
  ],
  exports: [
    AnalyticsService,
    AdvancedAnalyticsService,
    DeliveryTrackingService,
    WebhookService,
    PerformanceMetricsService,
    AuditLogService,
  ],
})
export class AnalyticsModule {}
