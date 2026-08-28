import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { MessagingEntitiesModule } from "../shared/messaging-entities.module";
import { NotificationQueueDeadLetterService } from "./notification-queue-dead-letter.service";
import { NotificationQueueJobsService } from "./notification-queue-jobs.service";
import { NotificationQueueService } from "./notification-queue.service";

export const NOTIFICATION_QUEUE = "notification-queue";
export const NOTIFICATION_DELIVERY_QUEUE = "notification-delivery-queue";

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
  ],
  providers: [NotificationQueueJobsService, NotificationQueueDeadLetterService, NotificationQueueService],
  exports: [NotificationQueueService],
})
export class NotificationQueueCoreModule {}
