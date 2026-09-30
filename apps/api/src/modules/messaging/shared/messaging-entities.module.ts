import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessageDelivery } from "../message-delivery.entity";
import { Message } from "../message.entity";
import { DeadLetter } from "../entities/dead-letter.entity";
import { SystemAlert } from "../entities/system-alert.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Message, MessageDelivery, DeadLetter, SystemAlert])],
  exports: [TypeOrmModule],
})
export class MessagingEntitiesModule {}
