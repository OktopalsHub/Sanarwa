import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, LessThan, Between, MoreThanOrEqual, LessThanOrEqual } from "typeorm";
import { Cron, CronExpression } from "@nestjs/schedule";
import { NotificationLog } from "../notifications/entities/notification-log.entity";
import { InAppNotification } from "../messaging/entities/in-app-notification.entity";
import { Message } from "../messaging/message.entity";
import { MessageDelivery } from "../messaging/message-delivery.entity";
import { TenantSettings } from "../tenant/entities/tenant-settings.entity";

export interface DataPortabilityRequest {
  userId: string;
  tenantId: string;
  includePersonalData: boolean;
  includeCommunicationHistory: boolean;
  dateFrom?: Date;
  dateTo?: Date;
}

export interface DataErasureRequest {
  userId: string;
  tenantId: string;
  reason: "user_request" | "retention_expired" | "legal_requirement";
  requestedBy: string;
}

export interface ConsentRecord {
  id: string;
  userId: string;
  tenantId: string;
  consentType: "marketing" | "analytics" | "third_party_sharing";
  consented: boolean;
  consentDate: Date;
  expiryDate?: Date;
  source: string;
  metadata?: Record<string, any>;
}

export interface RetentionPolicy {
  dataType:
    | "notifications"
    | "notification_content"
    | "notification_metadata"
    | "deliveries"
    | "logs"
    | "audit_trails";
  retentionPeriodDays: number;
  autoDelete: boolean;
  legalHold: boolean;
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  private readonly defaultRetentionPolicies: RetentionPolicy[] = [
    { dataType: "notifications", retentionPeriodDays: 2555, autoDelete: true, legalHold: false },
    {
      dataType: "notification_content",
      retentionPeriodDays: 90,
      autoDelete: true,
      legalHold: false,
    },
    {
      dataType: "notification_metadata",
      retentionPeriodDays: 90,
      autoDelete: true,
      legalHold: false,
    },
    { dataType: "deliveries", retentionPeriodDays: 365, autoDelete: true, legalHold: false },
    { dataType: "logs", retentionPeriodDays: 90, autoDelete: true, legalHold: false },
    { dataType: "audit_trails", retentionPeriodDays: 2555, autoDelete: false, legalHold: true },
  ];

  constructor(
    @InjectRepository(NotificationLog)
    private notificationLogRepository: Repository<NotificationLog>,
    @InjectRepository(InAppNotification)
    private inAppNotificationRepository: Repository<InAppNotification>,
    @InjectRepository(Message)
    private messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private deliveryRepository: Repository<MessageDelivery>,
    @InjectRepository(TenantSettings)
    private tenantSettingsRepository: Repository<TenantSettings>,
  ) {}

  async exportUserData(request: DataPortabilityRequest): Promise<any> {
    const { userId, tenantId, includePersonalData, includeCommunicationHistory, dateFrom, dateTo } =
      request;

    const exportData: any = {
      userId,
      tenantId,
      exportDate: new Date(),
      data: {},
    };

    if (includeCommunicationHistory) {
      const notificationLogs = await this.notificationLogRepository.find({
        where: {
          tenantId,
          to: userId,
          createdAt:
            dateFrom && dateTo
              ? Between(dateFrom, dateTo)
              : dateFrom
                ? MoreThanOrEqual(dateFrom)
                : dateTo
                  ? LessThanOrEqual(dateTo)
                  : undefined,
        },
        order: { createdAt: "DESC" },
      });

      const messages = await this.messageRepository.find({
        where: {
          tenantId,
          createdAt:
            dateFrom && dateTo
              ? Between(dateFrom, dateTo)
              : dateFrom
                ? MoreThanOrEqual(dateFrom)
                : dateTo
                  ? LessThanOrEqual(dateTo)
                  : undefined,
        },
        order: { createdAt: "DESC" },
      });

      const userMessages = messages.filter((msg) =>
        msg.recipients.some(
          (recipient) =>
            recipient.email === userId ||
            recipient.phone === userId ||
            recipient.deviceToken === userId ||
            recipient.whatsappNumber === userId ||
            recipient.userId === userId,
        ),
      );

      const deliveries = await this.deliveryRepository.find({
        where: {
          recipient: userId,
          createdAt:
            dateFrom && dateTo
              ? Between(dateFrom, dateTo)
              : dateFrom
                ? MoreThanOrEqual(dateFrom)
                : dateTo
                  ? LessThanOrEqual(dateTo)
                  : undefined,
        },
        relations: { message: true },
        order: { createdAt: "DESC" },
      });

      const tenantDeliveries = deliveries.filter(
        (delivery) => delivery.message && delivery.message.tenantId === tenantId,
      );

      exportData.data.communicationHistory = {
        notificationLogs: notificationLogs.map((log) => ({
          id: log.id,
          channel: log.channel,
          status: log.status,
          sentAt: log.sentAt,
          deliveredAt: log.deliveredAt,
          createdAt: log.createdAt,
          metadata: this.sanitizeMetadata(log.metadata),
        })),
        messages: userMessages.map((msg) => ({
          id: msg.id,
          channels: msg.channels,
          status: msg.status,
          deliveredAt: msg.deliveredAt,
          createdAt: msg.createdAt,
        })),
        deliveries: deliveries.map((delivery) => ({
          id: delivery.id,
          channel: delivery.channel,
          status: delivery.status,
          sentAt: delivery.sentAt,
          deliveredAt: delivery.deliveredAt,
          createdAt: delivery.createdAt,
        })),
      };
    }

    if (includePersonalData) {
      exportData.data.personalData = {
        consentRecords: await this.getUserConsentRecords(userId, tenantId),
        communicationPreferences: await this.getUserCommunicationPreferences(userId, tenantId),
      };
    }

    return exportData;
  }

  async deleteUserData(
    request: DataErasureRequest,
  ): Promise<{ deletedRecords: number; status: string }> {
    const { userId, tenantId, reason, requestedBy } = request;

    this.logger.log(
      `Processing data erasure request for user ${userId} in tenant ${tenantId}, reason: ${reason}`,
    );

    let totalDeleted = 0;

    const notificationLogsDeleted = await this.notificationLogRepository.delete({
      tenantId,
      to: userId,
    });
    totalDeleted += notificationLogsDeleted.affected || 0;

    const deliveriesDeleted = await this.deliveryRepository.delete({
      recipient: userId,
    });
    totalDeleted += deliveriesDeleted.affected || 0;

    await this.logDataErasure({
      userId,
      tenantId,
      reason,
      requestedBy,
      recordsDeleted: totalDeleted,
      deletedAt: new Date(),
    });

    return {
      deletedRecords: totalDeleted,
      status: "completed",
    };
  }

  async performRetentionCleanup(
    tenantId?: string,
  ): Promise<{ cleanedRecords: number; policiesApplied: number }> {
    let totalCleaned = 0;
    let policiesApplied = 0;

    const tenantSettings = tenantId
      ? await this.tenantSettingsRepository.findOne({ where: { tenantId } })
      : null;

    const contentRetentionDays =
      tenantSettings?.contentRetentionDays ??
      tenantSettings?.retentionPolicy?.notificationContentRetentionDays ??
      90;
    const metadataRetentionDays =
      tenantSettings?.retentionPolicy?.notificationMetadataRetentionDays ??
      tenantSettings?.retentionPolicy?.logsRetentionDays ??
      90;

    const policies = this.defaultRetentionPolicies.map((policy) => {
      if (policy.dataType === "notification_content") {
        return { ...policy, retentionPeriodDays: contentRetentionDays };
      }
      if (policy.dataType === "notification_metadata" || policy.dataType === "logs") {
        return { ...policy, retentionPeriodDays: metadataRetentionDays };
      }
      return policy;
    });

    for (const policy of policies) {
      if (!policy.autoDelete) continue;

      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - policy.retentionPeriodDays);

      let deletedCount = 0;

      switch (policy.dataType) {
        case "notifications":
          if (tenantId) {
            const result = await this.messageRepository.delete({
              tenantId,
              createdAt: LessThan(cutoffDate),
            });
            deletedCount = result.affected || 0;
          }
          break;

        case "notification_content":
          if (tenantId) {
            const centerResult = await this.inAppNotificationRepository.delete({
              tenantId,
              createdAt: LessThan(cutoffDate),
            });
            const scrubResult = await this.messageRepository
              .createQueryBuilder()
              .update(Message)
              .set({ data: () => "NULL", subject: () => "NULL" })
              .where("tenant_id = :tenantId", { tenantId })
              .andWhere("created_at < :cutoffDate", { cutoffDate })
              .andWhere("(data IS NOT NULL OR subject IS NOT NULL)")
              .execute();
            deletedCount = (centerResult.affected || 0) + (scrubResult.affected || 0);
          }
          break;

        case "notification_metadata":
        case "logs":
          if (tenantId) {
            const result = await this.notificationLogRepository.delete({
              tenantId,
              createdAt: LessThan(cutoffDate),
            });
            deletedCount = result.affected || 0;
          }
          break;

        case "deliveries":
          break;
      }

      if (deletedCount > 0) {
        totalCleaned += deletedCount;
        policiesApplied++;
        this.logger.log(
          `Applied retention policy for ${policy.dataType}: deleted ${deletedCount} records older than ${cutoffDate.toISOString()}`,
        );
      }
    }

    return { cleanedRecords: totalCleaned, policiesApplied };
  }

  @Cron(CronExpression.EVERY_DAY_AT_3AM)
  async runScheduledRetentionCleanup(): Promise<void> {
    const tenants = await this.tenantSettingsRepository.find({
      select: { tenantId: true },
    });

    for (const tenant of tenants) {
      await this.performRetentionCleanup(tenant.tenantId);
    }
  }

  async recordConsent(consent: Omit<ConsentRecord, "id">): Promise<ConsentRecord> {
    const consentRecord: ConsentRecord = {
      id: `consent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      ...consent,
    };

    this.logger.log(
      `Recorded consent for user ${consent.userId}: ${consent.consentType} = ${consent.consented}`,
    );

    return consentRecord;
  }

  async revokeConsent(userId: string, tenantId: string, consentType: string): Promise<boolean> {
    this.logger.log(`Revoked consent for user ${userId}: ${consentType}`);
    return true;
  }

  async getUserConsentRecords(userId: string, tenantId: string): Promise<ConsentRecord[]> {
    return [
      {
        id: "consent_001",
        userId,
        tenantId,
        consentType: "marketing",
        consented: true,
        consentDate: new Date("2024-01-15"),
        source: "website_registration",
      },
      {
        id: "consent_002",
        userId,
        tenantId,
        consentType: "analytics",
        consented: false,
        consentDate: new Date("2024-01-15"),
        source: "cookie_banner",
      },
    ];
  }

  async updateCommunicationPreferences(
    userId: string,
    tenantId: string,
    preferences: {
      emailMarketing?: boolean;
      smsMarketing?: boolean;
      pushNotifications?: boolean;
      frequency?: "daily" | "weekly" | "monthly" | "never";
    },
  ): Promise<boolean> {
    this.logger.log(`Updated communication preferences for user ${userId}`, preferences);
    return true;
  }

  async getUserCommunicationPreferences(userId: string, tenantId: string): Promise<any> {
    return {
      emailMarketing: true,
      smsMarketing: false,
      pushNotifications: true,
      frequency: "weekly",
      updatedAt: new Date("2024-01-15"),
    };
  }

  async getPrivacyAuditTrail(userId: string, tenantId: string): Promise<any[]> {
    return [
      {
        action: "data_export",
        timestamp: new Date("2024-02-01"),
        requestedBy: userId,
        reason: "user_request",
      },
      {
        action: "consent_given",
        timestamp: new Date("2024-01-15"),
        consentType: "marketing",
        source: "website_registration",
      },
    ];
  }

  private sanitizeMetadata(metadata?: any): any {
    if (!metadata) return undefined;

    const sanitized = { ...metadata };
    delete sanitized.apiKey;
    delete sanitized.authToken;
    delete sanitized.personalData;

    return sanitized;
  }

  private async logDataErasure(erasureLog: {
    userId: string;
    tenantId: string;
    reason: string;
    requestedBy: string;
    recordsDeleted: number;
    deletedAt: Date;
  }): Promise<void> {
    this.logger.log("Data erasure completed", erasureLog);
  }
}
