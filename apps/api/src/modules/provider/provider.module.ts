import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProviderFactory } from "../../providers/factory/provider-factory";
import { ProviderConfigValidator } from "./provider-config-validator";
import { ProviderConfig } from "./provider-config.entity";
import { ProviderEncryptionService } from "./provider-encryption.service";
import { ProviderService } from "./provider.service";

import { ProviderOrchestratorService } from "./provider-orchestrator.service";
import { BillingModule } from "../billing/billing.module";
import { ApiKeyModule } from "../api-key/api-key.module";
import { TokenManagementModule } from "../token-management/token-management.module";
import { ProviderConfigRepository } from "./provider-config.repository";
import { BrandedPushService } from "./services/branded-push.service";
import { DeviceRegistrationService } from "./services/device-registration.service";
import { SmartPushRouterService } from "./services/smart-push-router.service";
import { WebhookValidatorService } from "./services/webhook-validator.service";
import { SnsMessageVerifierService } from "./services/sns-message-verifier.service";
import { DeviceRegistration } from "./entities/device-registration.entity";
import { DeviceRegistrationController } from "./controllers/device-registration.controller";
import { TelnyxWebhookController } from "./controllers/telnyx-webhook.controller";
import { WhatsAppWebhookController } from "./controllers/whatsapp-webhook.controller";
import { EmailWebhookController } from "./controllers/email-webhook.controller";

import { EmailModule } from "./providers/email/email.module";
import { ErrorsModule } from "../../common/errors";
import { ChatModule } from "./providers/chat/chat.module";
import { configServiceFrom } from "./byop-config.shim";
import { PushModule } from "./providers/push/push.module";
import { SMSModule } from "./providers/sms/sms.module";
import { InAppModule } from "./providers/in-app/in-app.module";
import { VoiceModule } from "./providers/voice/voice.module";
import { SMSRoutingService } from "./providers/sms/sms-routing.service";

import { SecurityModule } from "../../common/security/security.module";
import { SESEmailProvider } from "../../providers/email/ses-email-provider";
import { PinpointPushProvider } from "../../providers/push/pinpoint-push-provider";
import { AsiaSMSProvider } from "../../providers/sms/asia-sms-provider";
import { SNSSMSProvider } from "../../providers/sms/sns-sms-provider";
import { TermiiSMSProvider } from "../../providers/sms/termii-sms-provider";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { MetaWhatsAppProvider } from "../../providers/whatsapp/meta-whatsapp-provider";
import { ProviderConfigController } from "./provider-config.controller";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BYOPController } from "./controllers/byop.controller";
import { ProviderUsageLog } from "./entities/provider-usage-log.entity";
import { ProviderCostTrackerService } from "./services/provider-cost-tracker.service";
import { ProviderTemplateService } from "./services/provider-template.service";
import { NotificationLog } from "../notifications/entities/notification-log.entity";

import {
  MailgunProvider,
  SendGridProvider,
  SESProvider,
  SMTPProvider,
  ZeptoMailProvider,
} from "./providers/email/providers";
import {
  SlackProvider,
  DiscordProvider,
  TelegramProvider,
  WhatsAppProvider,
} from "./providers/chat/providers";
import {
  FCMProvider,
  ExpoPushProvider,
  SNSProvider,
  ApplePushProvider,
  WebPushProvider,
} from "./providers/push/providers";
import {
  TwilioProvider,
  TermiiProvider,
  AfricasTalkingProvider,
  TelnyxProvider,
} from "./providers/sms/providers";

import { DeliveryEventsModule } from "../messaging/events/delivery-events.module";
import { BrandModule } from "../brand/brand.module";
import { AuthModule } from "../auth/auth.module";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";

function pick(config: Record<string, any>, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const value = config?.[key];
    if (typeof value === "string" && value.length > 0) {
      return value;
    }
  }
  return undefined;
}

import { RoutingRulesController } from "./routing-rules/routing-rules.controller";
import { RoutingRulesService } from "./routing-rules/routing-rules.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProviderConfig,
      ProviderUsageLog,
      DeviceRegistration,
      NotificationLog,
    ]),
    ConfigModule,
    SecurityModule,
    EventEmitterModule,
    AuthModule,
    TenantMemberModule,
    EmailModule,
    ErrorsModule,
    ChatModule,
    PushModule,
    SMSModule,
    InAppModule,
    VoiceModule,
    ApiKeyModule,
    BillingModule,
    ErrorsModule,
    BrandModule,
    DeliveryEventsModule,
  ],
  controllers: [
    RoutingRulesController,
    ProviderConfigController,
    BYOPController,
    DeviceRegistrationController,
    TelnyxWebhookController,
    WhatsAppWebhookController,
    EmailWebhookController,
  ],
  providers: [
    RoutingRulesService,
    ProviderService,
    ProviderConfigValidator,
    ProviderEncryptionService,
    ProviderFactory,
    ProviderTemplateService,
    ProviderCostTrackerService,
    ProviderOrchestratorService,
    ProviderConfigRepository,
    BrandedPushService,
    DeviceRegistrationService,
    SmartPushRouterService,
    WebhookValidatorService,
    SnsMessageVerifierService,
    {
      provide: "PROVIDER_REGISTRATIONS",
      useFactory: (
        providerFactory: ProviderFactory,
        orchestratorService: ProviderOrchestratorService,
        mailgunProvider: MailgunProvider,
        sendgridProvider: SendGridProvider,
        sesProvider: SESProvider,
        smtpProvider: SMTPProvider,
        zeptomailProvider: ZeptoMailProvider,
        slackProvider: SlackProvider,
        discordProvider: DiscordProvider,
        telegramProvider: TelegramProvider,
        whatsappProvider: WhatsAppProvider,
        fcmProvider: FCMProvider,
        expoPushProvider: ExpoPushProvider,
        snsProvider: SNSProvider,
        applePushProvider: ApplePushProvider,
        webPushProvider: WebPushProvider,
        twilioProvider: TwilioProvider,
        termiiProvider: TermiiProvider,
        africasTalkingProvider: AfricasTalkingProvider,
        telnyxProvider: TelnyxProvider,
      ) => {
        providerFactory.registerProvider("aws_ses", NotificationChannel.EMAIL, SESEmailProvider);
        providerFactory.registerProvider("aws_sns", NotificationChannel.SMS, SNSSMSProvider);
        providerFactory.registerProvider("termii", NotificationChannel.SMS, TermiiSMSProvider);
        providerFactory.registerProvider("asia_sms", NotificationChannel.SMS, AsiaSMSProvider);
        providerFactory.registerProvider(
          "aws_pinpoint",
          NotificationChannel.PUSH,
          PinpointPushProvider,
        );
        providerFactory.registerProvider(
          "whatsapp_business",
          NotificationChannel.WHATSAPP,
          MetaWhatsAppProvider,
        );

        orchestratorService.registerEmailProvider(
          "zeptomail",
          zeptomailProvider,
          (config) => new ZeptoMailProvider(config),
        );
        orchestratorService.registerEmailProvider(
          "mailgun",
          mailgunProvider,
          (config) => new MailgunProvider(config),
        );
        orchestratorService.registerEmailProvider(
          "sendgrid",
          sendgridProvider,
          (config) => new SendGridProvider(config),
        );
        // SES is BYOP only. Register it but never as the managed fallback.
        orchestratorService.registerEmailProvider(
          "ses",
          sesProvider,
          (config) => new SESProvider(config),
        );
        orchestratorService.registerEmailProvider(
          "smtp",
          smtpProvider,
          (config) => new SMTPProvider(config),
        );

        orchestratorService.registerChatProvider(
          "slack",
          slackProvider,
          (config) =>
            new SlackProvider({
              botToken: config.botToken ?? config.token,
              webhookUrl: config.webhookUrl,
              defaultChannel: config.defaultChannel,
              appId: config.appId,
              clientId: config.clientId,
              clientSecret: config.clientSecret,
            }),
        );
        orchestratorService.registerChatProvider(
          "discord",
          discordProvider,
          (config) =>
            new DiscordProvider({
              webhookUrl: config.webhookUrl,
              username: config.username,
              avatarUrl: config.avatarUrl,
            }),
        );
        orchestratorService.registerChatProvider(
          "telegram",
          telegramProvider,
          (config) =>
            new TelegramProvider({
              botToken: config.botToken,
              parseMode: config.parseMode,
              defaultChatId: config.defaultChatId,
            }),
        );
        orchestratorService.registerChatProvider(
          "whatsapp",
          whatsappProvider,
          (config) =>
            new WhatsAppProvider({
              accessToken: config.accessToken,
              phoneNumberId: config.phoneNumberId,
              businessAccountId: config.businessAccountId,
              webhookVerifyToken: config.webhookVerifyToken,
              appSecret: config.appSecret,
              apiVersion: config.apiVersion,
            }),
        );

        orchestratorService.registerPushProvider(
          "fcm",
          fcmProvider,
          (config) =>
            new FCMProvider(
              configServiceFrom({
                FCM_SERVER_KEY: pick(config, "FCM_SERVER_KEY", "serverKey"),
                FCM_PROJECT_ID: pick(config, "FCM_PROJECT_ID", "projectId"),
                FCM_SERVICE_ACCOUNT_JSON: pick(
                  config,
                  "FCM_SERVICE_ACCOUNT_JSON",
                  "serviceAccountJson",
                  "FCM_SERVICE_ACCOUNT",
                ),
              }),
            ),
        );
        orchestratorService.registerPushProvider(
          "expo-push",
          expoPushProvider,
          (config) =>
            new ExpoPushProvider(
              configServiceFrom({
                EXPO_ACCESS_TOKEN: pick(config, "EXPO_ACCESS_TOKEN", "accessToken"),
              }),
            ),
        );
        // SNS is BYOP-only: tenants bring their own AWS platform-endpoint
        // proxy credentials. FCM/APNs/Expo/WebPush are the managed path.
        orchestratorService.registerPushProvider(
          "sns",
          snsProvider,
          (config) =>
            new SNSProvider(
              configServiceFrom({
                AWS_ACCESS_KEY_ID: pick(config, "AWS_ACCESS_KEY_ID", "accessKeyId"),
                AWS_SECRET_ACCESS_KEY: pick(config, "AWS_SECRET_ACCESS_KEY", "secretAccessKey"),
                AWS_REGION: pick(config, "AWS_REGION", "region") || "us-east-1",
                SNS_PLATFORM_APPLICATION_ARN: pick(
                  config,
                  "SNS_PLATFORM_APPLICATION_ARN",
                  "platformApplicationArn",
                  "applicationArn",
                ),
              }),
            ),
        );
        orchestratorService.registerPushProvider(
          "apple-push",
          applePushProvider,
          (config) =>
            new ApplePushProvider(
              configServiceFrom({
                APNS_KEY_ID: pick(config, "APNS_KEY_ID", "keyId"),
                APNS_TEAM_ID: pick(config, "APNS_TEAM_ID", "teamId"),
                APNS_BUNDLE_ID: pick(config, "APNS_BUNDLE_ID", "bundleId"),
                APNS_PRIVATE_KEY: pick(config, "APNS_PRIVATE_KEY", "privateKey"),
                APNS_ENVIRONMENT: pick(config, "APNS_ENVIRONMENT", "environment") || "development",
              }),
            ),
        );
        // web_push is deliberately not BYOP-instantiable: it needs the
        // subscription service, not just credentials.
        orchestratorService.registerPushProvider("web_push", webPushProvider);

        orchestratorService.registerSMSProvider(
          "twilio",
          twilioProvider,
          (config) =>
            new TwilioProvider(
              configServiceFrom({
                TWILIO_ACCOUNT_SID: pick(config, "TWILIO_ACCOUNT_SID", "accountSid"),
                TWILIO_AUTH_TOKEN: pick(config, "TWILIO_AUTH_TOKEN", "authToken"),
                TWILIO_FROM_NUMBER: pick(config, "TWILIO_FROM_NUMBER", "fromNumber"),
              }),
            ),
        );
        orchestratorService.registerSMSProvider(
          "termii",
          termiiProvider,
          (config) =>
            new TermiiProvider(
              configServiceFrom({
                TERMII_API_KEY: pick(config, "TERMII_API_KEY", "apiKey"),
                TERMII_SENDER_ID: pick(config, "TERMII_SENDER_ID", "senderId"),
              }),
            ),
        );
        orchestratorService.registerSMSProvider(
          "africastalking",
          africasTalkingProvider,
          (config) =>
            new AfricasTalkingProvider(
              configServiceFrom({
                AFRICASTALKING_API_KEY: pick(config, "AFRICASTALKING_API_KEY", "apiKey"),
                AFRICASTALKING_USERNAME: pick(config, "AFRICASTALKING_USERNAME", "username"),
                AFRICASTALKING_SHORT_CODE: pick(config, "AFRICASTALKING_SHORT_CODE", "shortCode"),
              }),
            ),
        );
        orchestratorService.registerSMSProvider(
          "telnyx",
          telnyxProvider,
          (config) =>
            new TelnyxProvider(
              configServiceFrom({
                TELNYX_API_KEY: pick(config, "TELNYX_API_KEY", "apiKey"),
                TELNYX_FROM_NUMBER: pick(config, "TELNYX_FROM_NUMBER", "fromNumber"),
                TELNYX_MESSAGING_PROFILE_ID: pick(
                  config,
                  "TELNYX_MESSAGING_PROFILE_ID",
                  "messagingProfileId",
                ),
              }),
            ),
        );

        return true;
      },
      inject: [
        ProviderFactory,
        ProviderOrchestratorService,

        MailgunProvider,
        SendGridProvider,
        SESProvider,
        SMTPProvider,
        ZeptoMailProvider,
        SlackProvider,
        DiscordProvider,
        TelegramProvider,
        WhatsAppProvider,
        FCMProvider,
        ExpoPushProvider,
        SNSProvider,
        ApplePushProvider,
        WebPushProvider,
        TwilioProvider,
        TermiiProvider,
        AfricasTalkingProvider,
        TelnyxProvider,
      ],
    },
  ],
  exports: [
    ProviderService,
    ProviderConfigValidator,
    ProviderEncryptionService,
    ProviderFactory,
    ProviderTemplateService,
    ProviderCostTrackerService,
    ProviderOrchestratorService,
    ProviderConfigRepository,
    BrandedPushService,
    DeviceRegistrationService,
    SmartPushRouterService,
  ],
})
export class ProviderModule {}
