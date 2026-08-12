import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from '../auth/auth.module';
import { NotificationLog } from '../notifications/entities/notification-log.entity';
import { NotificationCenterItem } from '../notifications/entities/notification-center.entity';
import { Message } from '../messaging/message.entity';
import { MessageDelivery } from '../messaging/message-delivery.entity';
import { TenantSettings } from '../tenant/entities/tenant-settings.entity';
import { ComplianceService } from './compliance.service';
import { ComplianceController } from './compliance.controller';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forFeature([
      NotificationLog,
      NotificationCenterItem,
      Message,
      MessageDelivery,
      TenantSettings,
    ]),
    AuthModule,
  ],
  controllers: [ComplianceController],
  providers: [ComplianceService],
  exports: [ComplianceService],
})
export class ComplianceModule {}