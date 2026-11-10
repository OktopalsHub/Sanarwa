import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { NOTIFICATION_ADMIN_QUEUE } from "../queue/notification-queue.constants";
import { NotificationQueueModule } from "../queue/notification-queue.module";
import { DeadLetterProcessor } from "../queue/dead-letter.processor";
import { DeadLetterController } from "./dead-letter.controller";

@Module({
  imports: [
    NotificationQueueModule,
    BullModule.registerQueue({
      name: NOTIFICATION_ADMIN_QUEUE,
    }),
  ],
  controllers: [DeadLetterController],
  providers: [DeadLetterProcessor],
})
export class DeadLetterModule {}
