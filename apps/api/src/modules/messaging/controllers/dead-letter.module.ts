import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { NotificationQueueModule, NOTIFICATION_QUEUE } from '../queue/notification-queue.module';
import { DeadLetterProcessor } from '../queue/dead-letter.processor';
import { DeadLetterController } from './dead-letter.controller';

@Module({
  imports: [
    NotificationQueueModule,
    BullModule.registerQueue({
      name: NOTIFICATION_QUEUE,
    }),
  ],
  controllers: [DeadLetterController],
  providers: [DeadLetterProcessor],
})
export class DeadLetterModule { }