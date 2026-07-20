import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../../../auth/auth.module';
import { TwilioProvider } from './providers/twilio.provider';
import { TermiiProvider } from './providers/termii.provider';
import { TelnyxProvider } from './providers/telnyx.provider';
import { InfobipProvider } from './providers/infobip.provider';
import { AfricasTalkingProvider } from './providers/africastalking.provider';
import { SMSRoutingService } from './sms-routing.service';
import { Message } from '../../../messaging/message.entity';
import { MessageDelivery } from '../../../messaging/message-delivery.entity';
import { SMSWebhookController } from '../../controllers/sms-webhook.controller';
import { SMSConversationController } from '../../controllers/sms-conversation.controller';
import { SmartSMSRouterService } from '../../services/smart-sms-router.service';
import { SMSService } from '../../services/sms.service';
import { SMSConversationService } from '../../services/sms-conversation.service';

@Module({
  imports: [
    ConfigModule,
    AuthModule,
    TypeOrmModule.forFeature([Message, MessageDelivery]),
  ],
  controllers: [SMSWebhookController, SMSConversationController],
  providers: [
    TwilioProvider,
    TermiiProvider,
    TelnyxProvider,
    InfobipProvider,
    AfricasTalkingProvider,
    SMSRoutingService,
    SMSService,
    SMSConversationService,
    SmartSMSRouterService,
  ],
  exports: [
    TwilioProvider,
    TermiiProvider,
    TelnyxProvider,
    InfobipProvider,
    AfricasTalkingProvider,
    SMSRoutingService,
    SMSService,
    SMSConversationService,
    SmartSMSRouterService,
  ],
})
export class SMSModule { }