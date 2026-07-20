import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { TelnyxVoiceProvider } from './providers/telnyx-voice.provider';
import { VoiceOrchestratorService } from './voice-orchestrator.service';
import { VoiceService } from '../../services/voice.service';
import { VoiceController } from '../../controllers/voice.controller';
import { TelnyxWebhookController } from '../../controllers/telnyx-webhook.controller';
import { VoiceCallTrackingService } from '../../services/voice-call-tracking.service';

import { BillingService } from '../../services/billing.service';

@Module({
  imports: [
    ConfigModule,
  ],
  providers: [
    TelnyxVoiceProvider,
    VoiceOrchestratorService,
    VoiceService,
    VoiceCallTrackingService,
    BillingService,
  ],
  controllers: [
    VoiceController,
    TelnyxWebhookController,
  ],
  exports: [
    TelnyxVoiceProvider,
    VoiceOrchestratorService,
    VoiceService,
    VoiceCallTrackingService,
  ],
})
export class VoiceModule { }