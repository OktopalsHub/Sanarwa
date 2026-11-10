import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MessageDelivery } from "../message-delivery.entity";
import { NotificationLog } from "../../notifications/entities/notification-log.entity";
import { Message } from "../message.entity";
import { DeadLetter } from "../entities/dead-letter.entity";
import { SystemAlert } from "../entities/system-alert.entity";

/**
 * The single import surface for messaging-owned entities. Re-exports the
 * TypeOrmModule forFeature scope so consumers can inject the repositories
 * without duplicating the entity list in every module.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([Message, MessageDelivery, NotificationLog, DeadLetter, SystemAlert]),
  ],
  exports: [TypeOrmModule],
})
export class MessagingEntitiesModule {}
