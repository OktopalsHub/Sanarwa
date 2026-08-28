import { Module } from "@nestjs/common";
import { BullModule } from "@nestjs/bull";
import { AuthModule } from "../../auth/auth.module";
import { NOTIFICATION_QUEUE } from "../queue/notification-queue.constants";
import { NotificationQueueModule } from "../queue/notification-queue.module";
import { DeadLetterProcessor } from "../queue/dead-letter.processor";
import { DeadLetterAlertService } from "../queue/dead-letter-alert.service";
import { MessagingEntitiesModule } from "../shared/messaging-entities.module";
import { DeadLetterController } from "./dead-letter.controller";

@Module({
  imports: [
    NotificationQueueModule,
    MessagingEntitiesModule,
    AuthModule,
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
    }),
  ],
  controllers: [DeadLetterController],
  providers: [DeadLetterProcessor, DeadLetterAlertService],
})
export class DeadLetterModule {}
