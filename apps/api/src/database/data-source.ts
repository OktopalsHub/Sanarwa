import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

import {
  ApiKey,
  AutoTopupConfig,
  Brand,
  Configuration,
  ConfigurationVersion,
  DeviceRegistration,
  Invite,
  Message,
  MessageDelivery,
  NotificationLog,
  Project,
  ProviderConfig,
  ProviderUsageLog,
  SecurityEventEntity,
  Subscription,
  Template,
  Tenant,
  TenantMember,
  TokenBalance,
  TokenPurchase,
  TokenTransaction,
  User,
} from './entities';

import { TenantBillingInfo } from '../modules/tenant/entities/tenant-billing-info.entity';
import { TenantSettings } from '../modules/tenant/entities/tenant-settings.entity';
import { Webhook } from '../modules/webhook/entities/webhook.entity';
import { Account } from '../modules/auth/entities/account.entity';
import { Session } from '../modules/auth/entities/session.entity';
import { Verification } from '../modules/auth/entities/verification.entity';
import { DeadLetter } from '../modules/messaging/entities/dead-letter.entity';
import { InAppNotification } from '../modules/messaging/entities/in-app-notification.entity';
import { SystemAlert } from '../modules/messaging/entities/system-alert.entity';
import { PushCertificate } from '../modules/push-certificates/entities/push-certificate.entity';
import { NotificationCenterItem } from '../modules/notifications/entities/notification-center.entity';
import { WABAConfig } from '../modules/whatsapp/entities/waba-config.entity';
import { TenantWABAConfig } from '../modules/whatsapp/entities/tenant-waba-config.entity';
import { TenantWABAAssignment } from '../modules/whatsapp/entities/tenant-waba-assignment.entity';

import {
  ApiKeys1759217839563,
  BillingSystem1761078058761,
  Brands1759217789190,
  Configurations1759324085144,
  ConfigurationVersions1759447215818,
  CreateAuditLog1764821072158,
  CreateTenantBillingInfo1765925330483,
  CreateTenantSettings1765925332227,
  CreateWebhook1766923292947,
  CreateWhatsappEsuEntities1762015087961,
  DeadLetters1784543893390,
  DeviceRegistrations1760919969818,
  Invites1759217829717,
  MessageDeliveries1759324012794,
  Messages1759324004793,
  NotificationCenter1784545192155,
  NotificationLogs1784543879942,
  Projects1759217782791,
  ProviderConfigs1759324039332,
  ProviderUsageLogs1760188950050,
  PushCertificates1784543886414,
  SecurityEvents1759447260931,
  SystemAlerts1784543899517,
  Templates1759217818543,
  TenantMembers1759217768135,
  Tenants1759217759658,
  User1759217753253,
} from './migrations';

config();

const isDev = process.env.NODE_ENV === 'development';

const AppDataSource: DataSourceOptions = {
  type: 'postgres',
  url: process.env.DATABASE_URL,
  synchronize: false,
  entities: [
    User,
    Tenant,
    TenantMember,
    TenantSettings,
    TenantBillingInfo,
    Account,
    Session,
    Verification,
    ApiKey,
    Brand,
    Invite,
    Project,
    Message,
    MessageDelivery,
    NotificationLog,
    NotificationCenterItem,
    ProviderConfig,
    ProviderUsageLog,
    Subscription,
    TokenBalance,
    TokenPurchase,
    TokenTransaction,
    AutoTopupConfig,
    Template,
    SecurityEventEntity,
    Configuration,
    ConfigurationVersion,
    InAppNotification,
    SystemAlert,
    DeadLetter,
    PushCertificate,
    Webhook,
    DeviceRegistration,
    WABAConfig,
    TenantWABAConfig,
    TenantWABAAssignment,
  ],
  migrations: [
    User1759217753253,
    Tenants1759217759658,
    TenantMembers1759217768135,
    Projects1759217782791,
    Brands1759217789190,
    Templates1759217818543,
    Invites1759217829717,
    ApiKeys1759217839563,
    Messages1759324004793,
    MessageDeliveries1759324012794,
    ProviderConfigs1759324039332,
    Configurations1759324085144,
    ConfigurationVersions1759447215818,
    SecurityEvents1759447260931,
    ProviderUsageLogs1760188950050,
    DeviceRegistrations1760919969818,
    BillingSystem1761078058761,
    CreateWhatsappEsuEntities1762015087961,
    CreateAuditLog1764821072158,
    CreateTenantBillingInfo1765925330483,
    CreateTenantSettings1765925332227,
    CreateWebhook1766923292947,
    NotificationLogs1784543879942,
    PushCertificates1784543886414,
    DeadLetters1784543893390,
    SystemAlerts1784543899517,
    NotificationCenter1784545192155,
  ],
  logging: isDev,
  migrationsRun: true,
  migrationsTransactionMode: 'all',
  namingStrategy: new SnakeNamingStrategy(),
};

export const dataSourceOptions = AppDataSource;
export const dataSource = new DataSource(AppDataSource);
