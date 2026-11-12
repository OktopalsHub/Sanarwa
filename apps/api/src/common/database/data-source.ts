import { config } from "dotenv";
import { DataSource, DataSourceOptions } from "typeorm";
import { SnakeNamingStrategy } from "typeorm-naming-strategies";

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
} from "./entities";

import { TenantSettings } from "../../modules/tenant/entities/tenant-settings.entity";
import { Webhook } from "../../modules/webhook/entities/webhook.entity";
import { Account } from "../../modules/auth/entities/account.entity";
import { Session } from "../../modules/auth/entities/session.entity";
import { Verification } from "../../modules/auth/entities/verification.entity";
import { Organization } from "../../modules/organization/entities/organization.entity";
import { Member } from "../../modules/organization/entities/member.entity";
import { Invitation } from "../../modules/organization/entities/invitation.entity";
import { BetterAuthApiKey } from "../../modules/api-key/entities/better-auth-apikey.entity";
import { DeadLetter } from "../../modules/messaging/entities/dead-letter.entity";
import { InAppNotification } from "../../modules/messaging/entities/in-app-notification.entity";
import { SystemAlert } from "../../modules/messaging/entities/system-alert.entity";
import { PushCertificate } from "../../modules/push-certificates/entities/push-certificate.entity";
import { WABAConfig } from "../../modules/whatsapp/entities/waba-config.entity";
import { TenantWABAConfig } from "../../modules/whatsapp/entities/tenant-waba-config.entity";

import { WebhookEvent } from "../../modules/billing/entities/webhook-event.entity";
import { TenantPaymentMethod } from "../../modules/billing/entities/tenant-payment-method.entity";
import { ProjectSendQuota } from "../../modules/quotas/entities/project-send-quota.entity";
import { Workflow } from "../../modules/workflow/entities/workflow.entity";
import { WorkflowRun } from "../../modules/workflow/entities/workflow-run.entity";

import { AuditLog } from "../../common/security/entities/audit-log.entity";
import { Campaign } from "../../modules/campaign/entities/campaign.entity";
import { VoiceCall } from "../../modules/provider/entities/voice-call.entity";
import { DeliveryEvent } from "../../modules/messaging/entities/delivery-event.entity";
import { IdempotencyKey } from "../../modules/messaging/idempotency/idempotency-key.entity";
import { Topic, TopicSubscription } from "../../modules/topics/entities/topic.entity";
import { NotificationPreference } from "../../modules/preferences/entities/notification-preference.entity";
import { NotificationSuppression } from "../../modules/preferences/entities/notification-suppression.entity";
import { SubscriberQuietHours } from "../../modules/preferences/entities/subscriber-quiet-hours.entity";
import { TemplateVersion } from "../../modules/template/entities/template-version.entity";

import {
  InitialSchema1794349055401,
  ExplicitExecutionState1794349055402,
  DeliveryStateSplit1794349055403,
  WorkflowScheduleCursor1794349055404,
  NotificationLogTrackingIdIndex1794349055405,
  VoiceCallBillingState1794349055406,
} from "./migrations";

config();

const isDev = process.env.NODE_ENV === "development";

const AppDataSource: DataSourceOptions = {
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: false,
  entities: [
    User,
    Tenant,
    TenantMember,
    TenantSettings,
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

    WebhookEvent,
    TenantPaymentMethod,
    Organization,
    Member,
    Invitation,
    BetterAuthApiKey,
    ProjectSendQuota,
    Workflow,
    WorkflowRun,
    AuditLog,
    Campaign,
    VoiceCall,
    DeliveryEvent,
    IdempotencyKey,
    Topic,
    TopicSubscription,
    NotificationPreference,
    NotificationSuppression,
    SubscriberQuietHours,
    TemplateVersion,
  ],
  migrations: [
    InitialSchema1794349055401,
    ExplicitExecutionState1794349055402,
    DeliveryStateSplit1794349055403,
    WorkflowScheduleCursor1794349055404,
    NotificationLogTrackingIdIndex1794349055405,
    VoiceCallBillingState1794349055406,
  ],
  logging: isDev,
  migrationsRun: true,
  migrationsTransactionMode: "all",
  namingStrategy: new SnakeNamingStrategy(),
};

export const dataSourceOptions = AppDataSource;
export const dataSource = new DataSource(AppDataSource);
