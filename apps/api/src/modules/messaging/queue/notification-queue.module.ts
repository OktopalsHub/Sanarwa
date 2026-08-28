import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { TemplateModule } from "../../template/template.module";
import { ProviderModule } from "../../provider/provider.module";
import { MessagingEntitiesModule } from "../shared/messaging-entities.module";
import { NotificationQueueDeadLetterService } from "./notification-queue-dead-letter.service";
import { NotificationQueueJobsService } from "./notification-queue-jobs.service";
import { NotificationQueueService } from "./notification-queue.service";
import { NotificationJobProcessor } from "./notification-job.processor";
import { NotificationDeliveryProcessor } from "./notification-delivery.processor";
import { NotificationProcessorSupport } from "./notification-processor.support";
import { NOTIFICATION_DELIVERY_QUEUE, NOTIFICATION_QUEUE } from "./notification-queue.constants";

export { NOTIFICATION_DELIVERY_QUEUE, NOTIFICATION_QUEUE } from "./notification-queue.constants";

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
    ),
    MessagingEntitiesModule,
    TemplateModule,
    ProviderModule,
  ],
  providers: [
    NotificationQueueJobsService,
    NotificationQueueDeadLetterService,
    NotificationQueueService,
    NotificationProcessorSupport,
    NotificationJobProcessor,
    NotificationDeliveryProcessor,
  ],
  exports: [
    NotificationQueueService,
    NotificationJobProcessor,
    NotificationDeliveryProcessor,
  ],
})
export class NotificationQueueModule {}
