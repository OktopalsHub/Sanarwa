import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { FCMProvider } from "./providers/fcm.provider";
import { ExpoPushProvider } from "./providers/expo-push.provider";
import { SNSProvider } from "./providers/sns.provider";
import { ApplePushProvider } from "./providers/apple-push.provider";
import { WebPushProvider } from "./providers/web-push.provider";
import { WebPushSubscriptionService } from "../../services/web-push-subscription.service";
import { TypeOrmModule } from "@nestjs/typeorm";
import { DeviceRegistration } from "../../entities/device-registration.entity";

@Module({
  imports: [ConfigModule, TypeOrmModule.forFeature([DeviceRegistration])],
  providers: [
    FCMProvider,
    ExpoPushProvider,
    SNSProvider,
    ApplePushProvider,
    WebPushSubscriptionService,
    WebPushProvider,
  ],
  exports: [FCMProvider, ExpoPushProvider, SNSProvider, ApplePushProvider, WebPushProvider],
})
export class PushModule {}
