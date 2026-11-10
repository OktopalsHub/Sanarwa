import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { NotificationPreference } from "./entities/notification-preference.entity";
import { NotificationSuppression } from "./entities/notification-suppression.entity";
import { SubscriberQuietHours } from "./entities/subscriber-quiet-hours.entity";
import { Topic, TopicSubscription } from "../topics/entities/topic.entity";
import { DeviceRegistration } from "../provider/entities/device-registration.entity";
import { Message } from "../messaging/message.entity";
import { MessageDelivery } from "../messaging/message-delivery.entity";
import { DeliveryEvent } from "../messaging/entities/delivery-event.entity";
import { NotificationLog } from "../notifications/entities/notification-log.entity";
import { DeadLetter } from "../messaging/entities/dead-letter.entity";
import { InAppNotification } from "../messaging/entities/in-app-notification.entity";
import { ConsentService } from "./consent.service";
import { PreferencesService } from "./preferences.service";
import { SubscriberErasureService } from "./subscriber-erasure.service";
import { PreferencesController } from "./preferences.controller";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationPreference,
      NotificationSuppression,
      SubscriberQuietHours,
      Topic,
      TopicSubscription,
      DeviceRegistration,
      Message,
      MessageDelivery,
      DeliveryEvent,
      NotificationLog,
      DeadLetter,
      InAppNotification,
    ]),
  ],
  controllers: [PreferencesController],
  providers: [ConsentService, SubscriberErasureService, PreferencesService],
  exports: [ConsentService, SubscriberErasureService, PreferencesService],
})
export class PreferencesModule {}
