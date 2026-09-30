import { BullModule } from "@nestjs/bull";
import { Module } from "@nestjs/common";
import { WEBHOOK_RETRY_QUEUE } from "./webhook-queue.constants";
import { WebhookQueueService } from "./webhook-queue.service";
import { WebhookRetryProcessor } from "./webhook-retry.processor";

export { WEBHOOK_RETRY_QUEUE } from "./webhook-queue.constants";

@Module({
  imports: [
    BullModule.registerQueue({
      name: WEBHOOK_RETRY_QUEUE,
      defaultJobOptions: {
        removeOnComplete: 100,
        removeOnFail: 50,
        attempts: 5,
        backoff: {
          type: "exponential",
          delay: 2000,
        },
      },
    }),
  ],
  providers: [WebhookQueueService, WebhookRetryProcessor],
  exports: [WebhookQueueService],
})
export class WebhookQueueModule {}
