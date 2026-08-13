import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { ProviderModule } from '../provider/provider.module';
import { TemplateModule } from '../template/template.module';
import { TenantModule } from '../tenant/tenant.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { NotificationLog } from '../notifications/entities/notification-log.entity';
import { AuthEmailService } from '../auth/services/auth-email.service';

import { DeadLetterProcessor } from './queue/dead-letter.processor';
import { NotificationQueueModule } from './queue/notification-queue.module';
import { MessagingEntitiesModule } from './shared/messaging-entities.module';
import { MessagingServicesModule } from './services/messaging-services.module';
import { MessagingController } from './messaging.controller';
import { MessagesController } from './messages.controller';
import { NotificationController } from './notification.controller';
import { MessagingService } from './messaging.service';
import { NotificationService } from './notification.service';
import { MessageRepository, MessageDeliveryRepository, DeadLetterRepository } from './repositories';


@Module({
  imports: [
    MessagingEntitiesModule,
    TypeOrmModule.forFeature([NotificationLog]),
    NotificationQueueModule,
    MessagingServicesModule,
    TemplateModule,
    TenantModule,
    ProviderModule,
    NotificationsModule,
    AuthModule,
    ApiKeyModule,
  ],
  controllers: [
    MessagingController,
    MessagesController,
    NotificationController,
  ],
  providers: [
    MessagingService,
    NotificationService,
    MessageRepository,
    MessageDeliveryRepository,
    DeadLetterRepository,
    DeadLetterProcessor,
    AuthEmailService,
  ],
  exports: [
    MessagingService,
    MessageRepository,
    MessageDeliveryRepository,
    DeadLetterRepository,
    MessagingServicesModule,
  ],
})
export class MessagingModule {}
