import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationLog } from "../entities/notification-log.entity";
import { TenantSettings } from "../../tenant/entities/tenant-settings.entity";
import { MessagingEntitiesModule } from "../../messaging/shared/messaging-entities.module";
import { NotificationStorageService } from "./notification-storage.service";

@Module({
  imports: [MessagingEntitiesModule, TypeOrmModule.forFeature([NotificationLog, TenantSettings])],
  providers: [NotificationStorageService],
  exports: [NotificationStorageService],
})
export class NotificationStorageModule {}
