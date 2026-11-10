import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { TemplateModule } from "../../template/template.module";
import { ProviderModule } from "../../provider/provider.module";
import { MessagingEntitiesModule } from "../shared/messaging-entities.module";
import { NotificationStorageModule } from "../../notifications/storage/notification-storage.module";
import { DeliveryProcessor } from "./delivery.processor";
import { DeliveryExecutorService } from "../../notifications/engine/delivery-executor.service";
import { DeliveryEventsModule } from "../events/delivery-events.module";
import { PreferencesModule } from "../../preferences/preferences.module";
import { IdempotencyModule } from "../idempotency/idempotency.module";
import { QuotasModule } from "../../quotas/quotas.module";
import { TopicsModule } from "../../topics/topics.module";
import { NotificationQueueService } from "./notification-queue.service";
import { NotificationProcessor } from "./notification.processor";
import {
  NOTIFICATION_ADMIN_QUEUE,
  NOTIFICATION_DELIVERY_QUEUE,
  NOTIFICATION_QUEUE,
} from "./notification-queue.constants";

export {
  NOTIFICATION_ADMIN_QUEUE,
  NOTIFICATION_DELIVERY_QUEUE,
  NOTIFICATION_QUEUE,
} from "./notification-queue.constants";

@Module({
  imports: [
    BullModule.registerQueue(
      {
        name: NOTIFICATION_QUEUE,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      },
      {
        name: NOTIFICATION_DELIVERY_QUEUE,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
        },
      },
      {
        name: NOTIFICATION_ADMIN_QUEUE,
        defaultJobOptions: {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 2000,
          },
        },
      },
    ),
    MessagingEntitiesModule,
    TemplateModule,
    ProviderModule,
    PreferencesModule,
    IdempotencyModule,
    QuotasModule,
    TopicsModule,
    DeliveryEventsModule,
    NotificationStorageModule,
  ],
  providers: [
    NotificationQueueService,
    NotificationProcessor,
    DeliveryProcessor,
    DeliveryExecutorService,
  ],
  exports: [
    NotificationQueueService,
    NotificationProcessor,
    DeliveryProcessor,
    DeliveryExecutorService,
  ],
})
export class NotificationQueueModule {}
