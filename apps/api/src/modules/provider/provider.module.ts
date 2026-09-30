import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ProviderFactory } from "../../providers/factory/provider-factory";
import { ProviderHealthMonitor } from "../../providers/health/provider-health-monitor";
import { ProviderConfigValidator } from "./provider-config-validator";
import { ProviderConfig } from "./provider-config.entity";
import { ProviderEncryptionService } from "./provider-encryption.service";
import { ProviderPerformanceTracker } from "./provider-performance-tracker";
import { ProviderService } from "./provider.service";

// Import BYOP services and new orchestrator
import { ProviderOrchestratorService } from "./provider-orchestrator.service";
import { QuotaAwareOrchestratorService } from "./services/quota-aware-orchestrator.service";
import { BillingModule } from "../billing/billing.module";
import { ApiKeyModule } from "../api-key/api-key.module";
import { TokenManagementModule } from "../token-management/token-management.module";
import { ProviderConfigRepository } from "./provider-config.repository";
import { BrandedPushService } from "./services/branded-push.service";
import { DeviceRegistrationService } from "./services/device-registration.service";
import { SmartPushRouterService } from "./services/smart-push-router.service";
import { DeviceRegistration } from "./entities/device-registration.entity";
import { DeviceRegistrationController } from "./controllers/device-registration.controller";
import { TelnyxWebhookController } from "./controllers/telnyx-webhook.controller";
import { WhatsAppWebhookController } from "./controllers/whatsapp-webhook.controller";
import { RoutingOptimizerController } from "./controllers/routing-optimizer.controller";

// Import new organized provider modules
import { EmailModule } from "./providers/email/email.module";
import { ChatModule } from "./providers/chat/chat.module";
import { PushModule } from "./providers/push/push.module";
import { SMSModule } from "./providers/sms/sms.module";
import { InAppModule } from "./providers/in-app/in-app.module";
import { VoiceModule } from "./providers/voice/voice.module";
import { SMSRoutingService } from "./providers/sms/sms-routing.service";

// Import existing provider implementations
import { SecurityModule } from "src/common/security/security.module";
import { SESEmailProvider } from "../../providers/email/ses-email-provider";
import { PinpointPushProvider } from "../../providers/push/pinpoint-push-provider";
import { AsiaSMSProvider } from "../../providers/sms/asia-sms-provider";
import { SNSSMSProvider } from "../../providers/sms/sns-sms-provider";
import { TermiiSMSProvider } from "../../providers/sms/termii-sms-provider";
import { Channel } from "../../providers/types";
import { MetaWhatsAppProvider } from "../../providers/whatsapp/meta-whatsapp-provider";
import { ProviderConfigController } from "./provider-config.controller";
import { EventEmitterModule } from "@nestjs/event-emitter";
import { BYOPController } from "./controllers/byop.controller";
import { ProviderUsageLog } from "./entities/provider-usage-log.entity";
import { ProviderCostTrackerService } from "./services/provider-cost-tracker.service";
import { ProviderTemplateService } from "./services/provider-template.service";
import { ProviderWebhookService } from "./services/provider-webhook.service";
import { RoutingOptimizerService } from "./services/routing-optimizer.service";
import { NotificationLog } from "../notifications/entities/notification-log.entity";

// Import new organized providers
import { MailgunProvider, SendGridProvider, SESProvider } from "./providers/email/providers";
import { SlackProvider, DiscordProvider, WhatsAppProvider } from "./providers/chat/providers";
import { FCMProvider, ExpoPushProvider, SNSProvider } from "./providers/push/providers";
import { TwilioProvider, TermiiProvider, AfricasTalkingProvider } from "./providers/sms/providers";

import { BrandModule } from "../brand/brand.module";
import { AuthModule } from "../auth/auth.module";
import { TenantMemberModule } from "../tenant-member/tenant-member.module";

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
    // New organized provider modules
    EmailModule,
    ChatModule,
    PushModule,
    SMSModule,
    InAppModule,
    VoiceModule,
    ApiKeyModule,
    BillingModule,
    BrandModule,
  ],
  controllers: [
    ProviderConfigController,
    BYOPController,
    DeviceRegistrationController,
    TelnyxWebhookController,
    WhatsAppWebhookController,
    RoutingOptimizerController,
  ],
  providers: [
    ProviderService,
    ProviderPerformanceTracker,
    ProviderConfigValidator,
    ProviderEncryptionService,
    ProviderFactory,
    ProviderHealthMonitor,
    // BYOP Services
    ProviderTemplateService,
    ProviderCostTrackerService,
    ProviderWebhookService,
    RoutingOptimizerService,
    // Orchestrator services
    ProviderOrchestratorService,
    // QuotaAwareOrchestratorService,
    ProviderConfigRepository,
    BrandedPushService,
    DeviceRegistrationService,
    SmartPushRouterService,
    // VoiceService is now provided by VoiceModule
    {
      provide: "PROVIDER_REGISTRATIONS",
      useFactory: (
        providerFactory: ProviderFactory,
        orchestratorService: ProviderOrchestratorService,
        // New organized providers
        mailgunProvider: MailgunProvider,
        sendgridProvider: SendGridProvider,
        sesProvider: SESProvider,
        slackProvider: SlackProvider,
        discordProvider: DiscordProvider,
        whatsappProvider: WhatsAppProvider,
        fcmProvider: FCMProvider,
        expoPushProvider: ExpoPushProvider,
        snsProvider: SNSProvider,
        twilioProvider: TwilioProvider,
        termiiProvider: TermiiProvider,
        africasTalkingProvider: AfricasTalkingProvider,
      ) => {
        // Register core providers
        providerFactory.registerProvider("aws_ses", Channel.EMAIL, SESEmailProvider);
        providerFactory.registerProvider("aws_sns", Channel.SMS, SNSSMSProvider);
        providerFactory.registerProvider("termii", Channel.SMS, TermiiSMSProvider);
        providerFactory.registerProvider("asia_sms", Channel.SMS, AsiaSMSProvider);
        providerFactory.registerProvider("aws_pinpoint", Channel.PUSH, PinpointPushProvider);
        providerFactory.registerProvider(
          "whatsapp_business",
          Channel.WHATSAPP,
          MetaWhatsAppProvider,
        );

        // Register providers with orchestrator
        orchestratorService.registerEmailProvider("mailgun", mailgunProvider);
        orchestratorService.registerEmailProvider("sendgrid", sendgridProvider);
        orchestratorService.registerEmailProvider("ses", sesProvider);

        orchestratorService.registerChatProvider("slack", slackProvider);
        orchestratorService.registerChatProvider("discord", discordProvider);
        orchestratorService.registerChatProvider("whatsapp", whatsappProvider);

        orchestratorService.registerPushProvider("fcm", fcmProvider);
        orchestratorService.registerPushProvider("expo-push", expoPushProvider);
        orchestratorService.registerPushProvider("sns", snsProvider);

        orchestratorService.registerSMSProvider("twilio", twilioProvider);
        orchestratorService.registerSMSProvider("termii", termiiProvider);
        orchestratorService.registerSMSProvider("africastalking", africasTalkingProvider);

        return true;
      },
      inject: [
        ProviderFactory,
        ProviderOrchestratorService,

        MailgunProvider,
        SendGridProvider,
        SESProvider,
        SlackProvider,
        DiscordProvider,
        WhatsAppProvider,
        FCMProvider,
        ExpoPushProvider,
        SNSProvider,
        TwilioProvider,
        TermiiProvider,
        AfricasTalkingProvider,
      ],
    },
  ],
  exports: [
    ProviderService,
    ProviderPerformanceTracker,
    ProviderConfigValidator,
    ProviderEncryptionService,
    ProviderFactory,
    ProviderHealthMonitor,
    ProviderTemplateService,
    ProviderCostTrackerService,
    ProviderWebhookService,
    RoutingOptimizerService,
    // Export orchestrators
    ProviderOrchestratorService,
    // QuotaAwareOrchestratorService,
    BrandedPushService,
    DeviceRegistrationService,
    SmartPushRouterService,
  ],
})
export class ProviderModule {}
