import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { NotificationLog } from './entities/notification-log.entity';
import { NotificationCenterItem } from './entities/notification-center.entity';
import { NotificationTransportService } from './transport/notification-transport.service';
import { NotificationTransportController } from './controllers/notification-transport.controller';
import { NotificationCenterService } from './services/notification-center.service';
import { NotificationCenterController } from './controllers/notification-center.controller';
import { NotificationPersistenceService } from './services/notification-persistence.service';
import { NotificationGateway } from './gateways/notification.gateway';
import { NotificationRealtimeService } from './services/notification-realtime.service';
import { NotificationEngineService } from './engine/notification-engine.service';
import { NotificationStorageService } from './storage/notification-storage.service';
import { ProviderModule } from '../provider/provider.module';
import { ApiKeyModule } from '../api-key/api-key.module';
import { MessagingEntitiesModule } from '../messaging/shared/messaging-entities.module';
import { NotificationQueueModule } from '../messaging/queue/notification-queue.module';
import { TenantSettings } from '../tenant/entities/tenant-settings.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      NotificationLog,
      NotificationCenterItem,
      TenantSettings,
    ]),
    MessagingEntitiesModule,
    NotificationQueueModule,
    JwtModule.registerAsync({
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('AUTH_SECRET'),
        signOptions: { expiresIn: '24h' },
      }),
      inject: [ConfigService],
    }),
    ScheduleModule.forRoot(),
    forwardRef(() => ProviderModule),
    ApiKeyModule,
  ],
  controllers: [NotificationTransportController, NotificationCenterController],
  providers: [
    NotificationTransportService,
    NotificationCenterService,
    NotificationPersistenceService,
    NotificationGateway,
    NotificationRealtimeService,
    NotificationStorageService,
    NotificationEngineService,
  ],
  exports: [
    NotificationTransportService,
    NotificationCenterService,
    NotificationPersistenceService,
    NotificationGateway,
    NotificationRealtimeService,
    NotificationStorageService,
    NotificationEngineService,
  ],
})
export class NotificationsModule {}
