import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HttpModule } from '@nestjs/axios';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { WhatsAppController } from './controllers/whatsapp.controller';
import { WhatsAppTemplateController } from './controllers/whatsapp-template.controller';
import { WhatsAppEmbeddedSignupController } from './controllers/whatsapp-embedded-signup.controller';
import { WhatsAppBusinessAPIService } from './services/whatsapp-business-api.service';
import { WhatsAppEmbeddedSignupService } from './services/whatsapp-embedded-signup.service';
import { WhatsAppMultiTenantTemplateService } from './services/whatsapp-multi-tenant-template.service';
import { WhatsAppMessageService } from './services/whatsapp-message.service';
import { WhatsAppMediaService } from './services/whatsapp-media.service';
import { WhatsAppConversationService } from './services/whatsapp-conversation.service';
import { WhatsAppAdvancedService } from './services/whatsapp-advanced.service';
import { Message } from '../messaging/message.entity';
import { MessageDelivery } from '../messaging/message-delivery.entity';
import { WABAConfig } from './entities/waba-config.entity';
import { TenantWABAConfig } from './entities/tenant-waba-config.entity';
import { TenantWABAAssignment } from './entities/tenant-waba-assignment.entity';
import { ApiKeyModule } from '../api-key/api-key.module';
// import { TokenManagementModule } from '../token-management/token-management.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WABAConfig,
      TenantWABAConfig,
      TenantWABAAssignment,
      Message,
      MessageDelivery
    ]),
    HttpModule,
    EventEmitterModule,
    ApiKeyModule,
    // TokenManagementModule,
  ],
  controllers: [
    WhatsAppController,
    WhatsAppTemplateController,
    WhatsAppEmbeddedSignupController
  ],
  providers: [
    WhatsAppBusinessAPIService,
    WhatsAppEmbeddedSignupService,
    WhatsAppMultiTenantTemplateService,
    WhatsAppMessageService,
    WhatsAppMediaService,
    WhatsAppConversationService,
    WhatsAppAdvancedService
  ],
  exports: [
    WhatsAppBusinessAPIService,
    WhatsAppEmbeddedSignupService,
    WhatsAppMultiTenantTemplateService,
    WhatsAppMessageService,
    WhatsAppMediaService,
    WhatsAppConversationService,
    WhatsAppAdvancedService
  ]
})
export class WhatsAppModule { }