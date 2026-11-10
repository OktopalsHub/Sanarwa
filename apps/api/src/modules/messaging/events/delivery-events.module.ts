import { Module } from "@nestjs/common";
import { DeliveryEvent } from "../entities/delivery-event.entity";
import { DeliveryEventService } from "./delivery-event.service";
import { MessagingEntitiesModule } from "../shared/messaging-entities.module";
import { TypeOrmModule } from "@nestjs/typeorm";
import { PreferencesModule } from "../../preferences/preferences.module";

@Module({
  imports: [MessagingEntitiesModule, TypeOrmModule.forFeature([DeliveryEvent]), PreferencesModule],
  providers: [DeliveryEventService],
  exports: [DeliveryEventService],
})
export class DeliveryEventsModule {}
