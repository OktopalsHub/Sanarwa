import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { FCMProvider } from "./providers/fcm.provider";
import { ExpoPushProvider } from "./providers/expo-push.provider";
import { SNSProvider } from "./providers/sns.provider";
import { ApplePushProvider } from "./providers/apple-push.provider";

@Module({
  imports: [ConfigModule],
  providers: [FCMProvider, ExpoPushProvider, SNSProvider, ApplePushProvider],
  exports: [FCMProvider, ExpoPushProvider, SNSProvider, ApplePushProvider],
})
export class PushModule {}
