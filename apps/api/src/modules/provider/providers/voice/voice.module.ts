import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";
import { TypeOrmModule } from "@nestjs/typeorm";
import { TelnyxVoiceProvider } from "./providers/telnyx-voice.provider";
import { VoiceOrchestratorService } from "./voice-orchestrator.service";
import { VoiceService } from "../../services/voice.service";
import { VoiceController } from "../../controllers/voice.controller";
import { TelnyxWebhookController } from "../../controllers/telnyx-webhook.controller";
import { VoiceCallTrackingService } from "../../services/voice-call-tracking.service";
import { VoiceBillingReconcilerService } from "../../services/voice-billing-reconciler.service";
import { VoiceCall } from "../../entities/voice-call.entity";

import { WebhookValidatorService } from "../../services/webhook-validator.service";
import { ApiKeyModule } from "../../../api-key/api-key.module";
import { BillingModule } from "../../../billing/billing.module";

@Module({
  imports: [ConfigModule, ApiKeyModule, BillingModule, TypeOrmModule.forFeature([VoiceCall])],
  providers: [
    TelnyxVoiceProvider,
    VoiceOrchestratorService,
    VoiceService,
    VoiceCallTrackingService,
    VoiceBillingReconcilerService,
    WebhookValidatorService,
  ],
  controllers: [VoiceController, TelnyxWebhookController],
  exports: [TelnyxVoiceProvider, VoiceOrchestratorService, VoiceService, VoiceCallTrackingService],
})
export class VoiceModule {}
