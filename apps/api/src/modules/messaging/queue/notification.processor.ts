import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from "@nestjs/bullmq";
import { Injectable, Logger } from "@nestjs/common";
import { Job, Queue, UnrecoverableError } from "bullmq";
import { TemplateService } from "../../template/template.service";
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery,
  DeliveryEngagementStatus,
  DeliveryTransportStatus,
  applyDeliveryState,
  resolveDeliveryStatus,
} from "../message-delivery.entity";
import { Message, MessageStatus, MessagePriority as Priority } from "../message.entity";
import {
  NOTIFICATION_ADMIN_QUEUE,
  NOTIFICATION_DELIVERY_QUEUE,
  NOTIFICATION_QUEUE,
} from "./notification-queue.constants";
import {
  AlertJobData,
  DeadLetterJobData,
  DeliveryJobData,
  NotificationJobData,
} from "./notification-queue.service";
import { isFinalAttempt } from "./job-attempts";
import { DeliveryExecutorService } from "../../notifications/engine/delivery-executor.service";
import { NotificationStorageService } from "../../notifications/storage/notification-storage.service";
import { DeliveryEventType } from "../enums/delivery-event-type.enum";
import { DeliveryEventService } from "../events/delivery-event.service";
import { ConsentService } from "../../preferences/consent.service";
import { ProjectQuotaService } from "../../quotas/project-quota.service";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ChatProvider } from "../../../common/enums/chat-provider.enum";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { resolveAddress } from "../resolve-address";

@Processor(NOTIFICATION_QUEUE)
@Injectable()
export class NotificationProcessor extends WorkerHost {
  private readonly logger = new Logger(NotificationProcessor.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private readonly deliveryRepository: Repository<MessageDelivery>,
    private readonly templateService: TemplateService,
    private readonly deliveryExecutor: DeliveryExecutorService,
    private readonly consentService: ConsentService,
    private readonly deliveryEventService: DeliveryEventService,
    private readonly projectQuota: ProjectQuotaService,
    private readonly storageService: NotificationStorageService,
    @InjectQueue(NOTIFICATION_QUEUE)
    private readonly notificationQueue: Queue<
      NotificationJobData | DeadLetterJobData | AlertJobData
    >,
    @InjectQueue(NOTIFICATION_DELIVERY_QUEUE)
    private readonly deliveryQueue: Queue<DeliveryJobData>,
    @InjectQueue(NOTIFICATION_ADMIN_QUEUE)
    private readonly adminQueue: Queue<DeadLetterJobData | AlertJobData>,
  ) {
    super();
  }

  async process(
    job: Job<NotificationJobData | DeadLetterJobData | AlertJobData>,
    token?: string,
  ): Promise<void> {
    switch (job.name) {
      case "process-notification":
        return this.processNotification(job as Job<NotificationJobData>);
      case "handle-failed-notification":
        return this.handleFailedNotification(job as Job<NotificationJobData>);
      case "retry-notification":
        return this.retryNotification(job as Job<NotificationJobData & { originalError: string }>);
      default:
        throw new Error(`No handler for job "${job.name}" on ${NOTIFICATION_QUEUE}`);
    }
  }

  @OnWorkerEvent("failed")
  async onNotificationFailed(job: Job<NotificationJobData>): Promise<void> {
    if (job.name !== "process-notification" || !isFinalAttempt(job)) {
      return;
    }

    try {
      await this.notificationQueue.add(
        "handle-failed-notification",
        { ...job.data, retryCount: job.attemptsMade },
        {
          priority: 10,
          attempts: 3,
          backoff: { type: "exponential", delay: 2000 },
        },
      );

      this.logger.error(
        `Notification ${job.data.notificationId} exhausted its attempts, queued failure handling`,
      );
    } catch (error) {
      this.logger.error(
        `Notification ${job.data.notificationId} failed terminally and could not be queued for handling: ${error.message}`,
      );
    }
  }

  async processNotification(job: Job<NotificationJobData>): Promise<void> {
    const { notificationId, tenantId, retryCount = 0 } = job.data;

    this.logger.log(`Processing notification ${notificationId} (attempt ${retryCount + 1})`);

    try {
      const message = await this.messageRepository.findOne({
        where: { id: notificationId, tenantId },
        relations: { deliveries: true },
      });

      if (!message) {
        throw new Error(`Message ${notificationId} not found`);
      }

      message.status = MessageStatus.PROCESSING;
      await this.messageRepository.save(message);

      if (!message.deliveries || message.deliveries.length === 0) {
        await this.createDeliveryRecords(message);

        const updatedMessage = await this.messageRepository.findOne({
          where: { id: notificationId },
          relations: { deliveries: true },
        });

        if (updatedMessage) {
          message.deliveries = updatedMessage.deliveries;
        }
      }

      const payload = job.data.payload;

      let renderedContent = payload?.data ?? message.data;
      let renderedSubject = payload?.subject ?? message.subject;

      if (message.templateId) {
        try {
          const rendered = await this.templateService.render({
            templateId: message.templateId,
            tenantId: message.tenantId,
            variables: message.variables,
          });
          renderedContent = rendered.data;
          renderedSubject = rendered.subject;
        } catch (error) {
          this.logger.warn(`Failed to render template ${message.templateId}: ${error.message}`);
        }
      }

      const deliveryJobs = message.deliveries.map((delivery) => ({
        notificationId: message.id,
        deliveryId: delivery.id,
        tenantId: message.tenantId,
        channel: delivery.channel,
        providerId: delivery.providerId || "auto-select",
        recipient: delivery.recipient,
        templateData: {
          variables: { ...(payload?.variables ?? message.variables) },
          subject: renderedSubject,
          data: renderedContent,
          templateId: payload?.templateId ?? message.templateId,
          brandId: payload?.brandId,
          storagePolicy: payload?.storagePolicy ?? message.metadata?.["storagePolicy"],
          metadata: message.metadata,
          chatProvider: payload?.chatProvider ?? message.metadata?.["chatProvider"],
        },
      }));

      const jobs = deliveryJobs.map((jobData, index) => ({
        name: "process-delivery",
        data: { ...jobData, retryCount: 0 },
        opts: {
          priority: this.getPriorityValue(Priority.NORMAL),
          attempts: 5,
          backoff: {
            type: "exponential",
            delay: 1000,
          },
          delay: index * 20,
        },
      }));

      if (jobs.length === 0) {
        await this.messageRepository.update(notificationId, {
          status: MessageStatus.FAILED,
          errorMessage: "No recipient address available for any channel",
        });
        this.logger.error(`Notification ${notificationId} has no deliverable recipient`);
        return;
      }

      await this.deliveryQueue.addBulk(jobs);

      this.logger.log(
        `Notification ${notificationId} handed ${jobs.length} deliveries to the queue`,
      );
    } catch (error) {
      this.logger.error(`Failed to process notification ${notificationId}: ${error.message}`);

      await this.messageRepository.update(notificationId, {
        status: MessageStatus.FAILED,
        errorMessage: error.message,
      });

      throw error;
    }
  }

  async processDelivery(job: Job<DeliveryJobData>): Promise<void> {
    const {
      notificationId,
      deliveryId,
      tenantId,
      channel,
      recipient,
      templateData,
      retryCount = 0,
    } = job.data;

    this.logger.log(
      `Processing delivery ${deliveryId} for notification ${notificationId} (${channel} to ${recipient}, attempt ${retryCount + 1})`,
    );

    let delivery: MessageDelivery | undefined;

    try {
      delivery =
        (await this.deliveryRepository.findOne({
          where: { id: deliveryId, messageId: notificationId },
        })) ?? undefined;

      if (!delivery) {
        throw new Error(`Delivery ${deliveryId} not found`);
      }

      const deliveryTransport = delivery.transportStatus ?? DeliveryTransportStatus.PENDING;
      const deliveryEngagement = delivery.engagementStatus ?? DeliveryEngagementStatus.UNKNOWN;
      if (
        delivery.status === DeliveryStatus.DELIVERED ||
        delivery.status === DeliveryStatus.SENT ||
        deliveryTransport === DeliveryTransportStatus.SENT ||
        deliveryEngagement !== DeliveryEngagementStatus.UNKNOWN
      ) {
        // At-least-once: a stalled job the queue re-runs may already be done.
        // Acknowledge it instead of sending a duplicate to the provider.
        this.logger.log(
          `Delivery ${deliveryId} is already ${delivery.status} — acknowledging duplicate job without re-sending`,
        );
        return;
      }

      const verdict = await this.consentService.checkConsent({
        tenantId,
        address: recipient,
        subscriberId: delivery.metadata?.["subscriberId"],
        channel: delivery.channel,
        priority: delivery.metadata?.["priority"],
      });

      if (!verdict.allowed && verdict.reason === "quiet_hours") {
        this.logger.log(`Deferring delivery ${deliveryId} for ${verdict.delayMs}ms (quiet hours)`);

        await this.deliveryQueue.add("process-delivery", job.data, {
          delay: verdict.delayMs,
          attempts: 5,
          backoff: { type: "exponential", delay: 1000 },
        });

        return;
      }

      if (!verdict.allowed) {
        this.logger.log(`Skipping delivery ${deliveryId}: ${verdict.reason}`);

        await this.deliveryRepository.update(deliveryId, {
          status: DeliveryStatus.SKIPPED,
          transportStatus: DeliveryTransportStatus.SKIPPED,
          engagementStatus: DeliveryEngagementStatus.UNKNOWN,
          stateUpdatedAt: new Date(),
          errorMessage: `Skipped: ${verdict.reason}`,
        });
        await this.updateNotificationStatusFromDeliveries(notificationId);

        return;
      }

      // Burst protection at delivery time (covers scheduled sends). The row
      // being delivered already counts toward the window, so exclude it.
      const projectId =
        typeof delivery.metadata?.["projectId"] === "string"
          ? (delivery.metadata["projectId"] as string)
          : typeof templateData.metadata?.["projectId"] === "string"
            ? (templateData.metadata["projectId"] as string)
            : undefined;
      const quota = await this.projectQuota.checkQuota({
        tenantId,
        projectId,
        excludeDeliveryId: deliveryId,
      });
      if (!quota.allowed) {
        this.logger.log(`Skipping delivery ${deliveryId}: project_quota`);
        await this.deliveryRepository.update(deliveryId, {
          status: DeliveryStatus.SKIPPED,
          transportStatus: DeliveryTransportStatus.SKIPPED,
          engagementStatus: DeliveryEngagementStatus.UNKNOWN,
          stateUpdatedAt: new Date(),
          errorMessage: "Skipped: project_quota",
        });
        await this.updateNotificationStatusFromDeliveries(notificationId);
        return;
      }

      const outcome = await this.deliveryExecutor.deliver({
        tenantId,
        channel: delivery.channel,
        to: recipient,
        subject: templateData.subject,
        data: templateData.data,
        variables: templateData.variables ?? templateData,
        templateId: templateData.templateId,
        templateData,
        brandId: templateData.brandId,
        messageId: notificationId,
        deliveryId,
        metadata: {
          ...templateData.metadata,
          brandId: templateData.brandId,
          chatProvider: templateData.chatProvider,
          webhookUrl:
            templateData.webhookUrl ??
            templateData.metadata?.webhookUrl ??
            templateData.variables?.webhookUrl,
        },
        webhookUrl:
          templateData.webhookUrl ??
          templateData.metadata?.webhookUrl ??
          templateData.variables?.webhookUrl,
      });

      await this.deliveryEventService.record({
        tenantId,
        channel: delivery.channel,
        provider: outcome.providerId ?? "unknown",
        type: outcome.status === "sent" ? DeliveryEventType.SENT : DeliveryEventType.DROPPED,
        messageId: notificationId,
        deliveryId,
        reasonCode: outcome.status === "failed" ? "provider_failed" : undefined,
        diagnostic:
          outcome.status === "failed" ? (outcome.error ?? "Provider reported failure") : undefined,
        providerMessageId: outcome.externalId,
        occurredAt: new Date(),
      });

      if (outcome.status === "failed") {
        const error = outcome.error ?? "Delivery failed";
        if (outcome.retryable === false) {
          throw new UnrecoverableError(error);
        }
        throw new Error(error);
      }

      delivery.providerId = outcome.providerId ?? "unknown";
      delivery.providerMessageId = outcome.externalId;
      applyDeliveryState(delivery, {
        transportStatus: DeliveryTransportStatus.SENT,
        engagementStatus: DeliveryEngagementStatus.DELIVERED,
      });
      delivery.sentAt = delivery.sentAt ?? new Date();
      delivery.deliveredAt = delivery.deliveredAt ?? new Date();

      await this.deliveryRepository.save(delivery);
      await this.finalizeLog(deliveryId, "delivered", {
        externalId: outcome.externalId,
        providerId: outcome.providerId,
      });

      await this.updateNotificationStatusFromDeliveries(notificationId);

      this.logger.log(`Successfully processed delivery ${deliveryId} via ${outcome.providerId}`);
    } catch (error) {
      this.logger.error(`Failed to process delivery ${deliveryId}: ${error.message}`);

      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.FAILED,
        transportStatus: DeliveryTransportStatus.FAILED,
        engagementStatus: DeliveryEngagementStatus.FAILED,
        stateUpdatedAt: new Date(),
        errorMessage: error.message,
        retryCount: retryCount + 1,
      });
      await this.finalizeLog(deliveryId, "failed", {
        error: error.message,
        providerId: delivery?.providerId,
      });

      await this.updateNotificationStatusFromDeliveries(notificationId);

      const terminal = isFinalAttempt(job) || error instanceof UnrecoverableError;

      if (terminal && delivery) {
        try {
          await this.enqueueChannelFallback(delivery, job.data);
        } catch (fallbackError) {
          this.logger.error(
            `Failed to enqueue channel fallback for delivery ${deliveryId}: ${(fallbackError as Error).message}`,
          );
        }
      }

      throw error;
    }
  }

  /**
   * Roll a terminally failed delivery over to the next channel in its
   * `fallbackChain` (persisted on the delivery metadata at send time). The
   * rollover delivery carries the remaining chain so each channel rolls over
   * at most once. Returns silently when there is nothing left to fall back
   * to — a delivery without a chain behaves exactly as before.
   */
  private async enqueueChannelFallback(
    delivery: MessageDelivery,
    jobData: DeliveryJobData,
  ): Promise<void> {
    const chain = Array.isArray(delivery.metadata?.["fallbackChain"])
      ? (delivery.metadata["fallbackChain"] as unknown[]).filter(
          (channel): channel is NotificationChannel =>
            typeof channel === "string" &&
            (Object.values(NotificationChannel) as string[]).includes(channel),
        )
      : [];

    if (chain.length === 0) {
      return;
    }

    const { notificationId, tenantId } = jobData;
    const message = await this.messageRepository.findOne({ where: { id: notificationId } });
    const subscriberId =
      typeof delivery.metadata?.["subscriberId"] === "string"
        ? delivery.metadata["subscriberId"]
        : undefined;

    const recipients = message?.recipients ?? [];
    const recipient =
      recipients.find((candidate) =>
        subscriberId ? (candidate.userId ?? candidate.id) === subscriberId : false,
      ) ?? (recipients.length === 1 ? recipients[0] : undefined);

    if (!message || !recipient) {
      this.logger.warn(
        `Delivery ${delivery.id} failed terminally but its fallback recipient could not be resolved — no fallback enqueued`,
      );
      return;
    }

    const chatProvider = message.metadata?.["chatProvider"] as ChatProvider | undefined;

    for (const [index, channel] of chain.entries()) {
      const address = resolveAddress(recipient, channel, chatProvider);

      if (!address) {
        continue;
      }

      const remaining = chain.slice(index + 1);
      const created = await this.deliveryRepository.save(
        this.deliveryRepository.create({
          messageId: notificationId,
          tenantId,
          channel,
          providerId: "pending",
          recipient: address,
          status: DeliveryStatus.PENDING,
          transportStatus: DeliveryTransportStatus.PENDING,
          engagementStatus: DeliveryEngagementStatus.UNKNOWN,
          stateUpdatedAt: new Date(),
          metadata: {
            ...delivery.metadata,
            fallbackChain: remaining.length > 0 ? remaining : undefined,
          },
        }),
      );

      await this.deliveryQueue.add(
        "process-delivery",
        {
          notificationId,
          deliveryId: created.id,
          tenantId,
          channel,
          providerId: "auto-select",
          recipient: address,
          templateData: jobData.templateData,
          retryCount: 0,
        },
        { attempts: 5, backoff: { type: "exponential", delay: 1000 } },
      );

      this.logger.log(
        `Delivery ${delivery.id} (${delivery.channel}) failed terminally — rolled over to ${channel} (delivery ${created.id})`,
      );
      await this.updateNotificationStatusFromDeliveries(notificationId);
      return;
    }

    this.logger.warn(
      `Delivery ${delivery.id} exhausted its fallback chain (${chain.join(", ")}) — no reachable fallback channel`,
    );
  }

  async handleFailedNotification(job: Job<NotificationJobData>): Promise<void> {
    const { notificationId, tenantId, retryCount = 0 } = job.data;

    this.logger.error(
      `Notification ${notificationId} failed after all retry attempts (${retryCount} retries)`,
    );

    try {
      const message = await this.messageRepository.findOne({
        where: { id: notificationId, tenantId },
        relations: { deliveries: true },
      });

      if (!message) {
        this.logger.error(`Message ${notificationId} not found for failure handling`);
        return;
      }

      await this.messageRepository.update(notificationId, {
        status: MessageStatus.FAILED,
        errorMessage: "Failed after all retry attempts",
      });

      await this.addToDeadLetterQueue({
        type: "notification",
        id: notificationId,
        tenantId,
        originalJobData: job.data,
        failureReason: "Exceeded maximum retry attempts",
        failedAt: new Date(),
        retryCount,
        messageData: {
          subject: message.subject,
          data: message.data,
          channels: message.channels,
          recipients: message.recipients,
          templateId: message.templateId,
          priority: message.priority,
        },
      });

      await this.sendFailureAlert({
        type: "notification_failure",
        notificationId,
        tenantId,
        retryCount,
        message: `Notification ${notificationId} failed after ${retryCount} retry attempts`,
        severity: "high",
        metadata: {
          channels: message.channels,
          recipientCount: message.recipients.length,
          templateId: message.templateId,
          priority: message.priority,
        },
      });

      this.logger.log(`Added failed notification ${notificationId} to dead letter queue`);
    } catch (error) {
      this.logger.error(`Error handling failed notification ${notificationId}: ${error.message}`);
    }
  }

  async handleFailedDelivery(job: Job<DeliveryJobData>): Promise<void> {
    const { deliveryId, notificationId, tenantId, channel, recipient, retryCount = 0 } = job.data;

    this.logger.error(
      `Delivery ${deliveryId} failed after all retry attempts (${retryCount} retries)`,
    );

    try {
      const delivery = await this.deliveryRepository.findOne({
        where: { id: deliveryId, messageId: notificationId },
      });

      if (!delivery) {
        this.logger.error(`Delivery ${deliveryId} not found for failure handling`);
        return;
      }

      await this.deliveryRepository.update(deliveryId, {
        status: DeliveryStatus.FAILED,
        transportStatus: DeliveryTransportStatus.FAILED,
        engagementStatus: DeliveryEngagementStatus.FAILED,
        stateUpdatedAt: new Date(),
        errorMessage: "Failed after all retry attempts",
        retryCount: retryCount + 1,
      });

      await this.updateNotificationStatusFromDeliveries(notificationId);

      await this.addToDeadLetterQueue({
        type: "delivery",
        id: deliveryId,
        tenantId,
        originalJobData: job.data,
        failureReason: "Exceeded maximum retry attempts",
        failedAt: new Date(),
        retryCount,
        deliveryData: {
          notificationId,
          channel,
          recipient,
          providerId: delivery.providerId,
          errorMessage: delivery.errorMessage,
        },
      });

      const shouldAlert = await this.shouldSendDeliveryAlert(notificationId, channel, retryCount);
      if (shouldAlert) {
        await this.sendFailureAlert({
          type: "delivery_failure",
          deliveryId,
          notificationId,
          tenantId,
          channel,
          recipient,
          retryCount,
          message: `Delivery ${deliveryId} (${channel} to ${recipient}) failed after ${retryCount} retry attempts`,
          severity: "medium",
          metadata: {
            channel,
            providerId: delivery.providerId,
            errorMessage: delivery.errorMessage,
          },
        });
      }

      this.logger.log(`Added failed delivery ${deliveryId} to dead letter queue`);
    } catch (error) {
      this.logger.error(`Error handling failed delivery ${deliveryId}: ${error.message}`);
    }
  }

  private async createDeliveryRecords(message: Message): Promise<void> {
    const deliveries: Partial<MessageDelivery>[] = [];
    const fallbackAddress =
      message.recipients.length === 1 && typeof message.metadata?.["to"] === "string"
        ? message.metadata["to"]
        : undefined;

    for (const channel of message.channels) {
      for (const recipient of message.recipients) {
        const recipientAddress =
          resolveAddress(
            recipient,
            channel,
            message.metadata?.["chatProvider"] as ChatProvider | undefined,
          ) ?? fallbackAddress;

        if (recipientAddress) {
          deliveries.push({
            messageId: message.id,
            tenantId: message.tenantId,
            channel,
            providerId: "pending",
            recipient: recipientAddress,
            status: DeliveryStatus.PENDING,
            transportStatus: DeliveryTransportStatus.PENDING,
            engagementStatus: DeliveryEngagementStatus.UNKNOWN,
            stateUpdatedAt: new Date(),
            metadata: {
              subscriberId: recipient.userId ?? recipient.id,
              priority: message.priority,
            },
          });
        }
      }
    }

    if (deliveries.length > 0) {
      await this.deliveryRepository.save(deliveries);
    }
  }

  private async finalizeLog(
    deliveryId: string,
    status: "sent" | "delivered" | "failed",
    outcome: { externalId?: string; error?: string; providerId?: string },
  ): Promise<void> {
    try {
      await this.storageService.updateDeliveryOutcome(deliveryId, undefined, {
        status,
        externalId: outcome.externalId,
        error: outcome.error,
        providerId: outcome.providerId,
      });
    } catch (logError) {
      this.logger.warn(
        `Failed to finalize delivery log ${deliveryId}: ${(logError as Error).message}`,
      );
    }
  }

  private async updateNotificationStatusFromDeliveries(notificationId: string): Promise<void> {
    const deliveries = await this.deliveryRepository.find({
      where: { messageId: notificationId },
    });

    if (deliveries.length === 0) {
      return;
    }

    const deliveryStatuses = deliveries.map((d) => resolveDeliveryStatus(d));
    let notificationStatus: MessageStatus;

    if (deliveryStatuses.every((status) => status === DeliveryStatus.DELIVERED)) {
      notificationStatus = MessageStatus.DELIVERED;
    } else if (
      deliveryStatuses.some(
        (status) => status === DeliveryStatus.DELIVERED || status === DeliveryStatus.SENT,
      )
    ) {
      notificationStatus = MessageStatus.SENT;
    } else if (
      deliveryStatuses.every(
        (status) =>
          status === DeliveryStatus.FAILED ||
          status === DeliveryStatus.BOUNCED ||
          status === DeliveryStatus.SKIPPED ||
          status === DeliveryStatus.UNSUBSCRIBED,
      )
    ) {
      notificationStatus = MessageStatus.FAILED;
    } else {
      notificationStatus = MessageStatus.PROCESSING;
    }

    await this.messageRepository.update(notificationId, {
      status: notificationStatus,
    });
  }

  private async addToDeadLetterQueue(data: {
    type: "notification" | "delivery";
    id: string;
    tenantId: string;
    originalJobData: any;
    failureReason: string;
    failedAt: Date;
    retryCount: number;
    messageData?: any;
    deliveryData?: any;
  }): Promise<void> {
    try {
      const jobData = {
        type: "dead_letter",
        originalType: data.type,
        originalId: data.id,
        tenantId: data.tenantId,
        failureReason: data.failureReason,
        failedAt: data.failedAt,
        retryCount: data.retryCount,
        originalJobData: data.originalJobData,
        messageData: data.messageData,
        deliveryData: data.deliveryData,
      };

      await this.adminQueue.add("handle-dead-letter", jobData, {
        priority: data.type === "notification" ? 10 : 5,
        attempts: 1,
        removeOnComplete: false,
        removeOnFail: false,
      });

      this.logger.log(`Added ${data.type} ${data.id} to dead letter queue`);
    } catch (error) {
      this.logger.error(
        `Failed to add ${data.type} ${data.id} to dead letter queue: ${error.message}`,
      );
    }
  }

  private async sendFailureAlert(alert: {
    type: string;
    notificationId?: string;
    deliveryId?: string;
    tenantId: string;
    channel?: string;
    recipient?: string;
    retryCount: number;
    message: string;
    severity: "low" | "medium" | "high" | "critical";
    metadata?: any;
  }): Promise<void> {
    try {
      const alertJobData = {
        type: "system_alert",
        alert: {
          type: alert.type,
          severity: alert.severity,
          title: `Notification System Alert: ${alert.type}`,
          message: alert.message,
          tenantId: alert.tenantId,
          metadata: {
            ...alert.metadata,
            notificationId: alert.notificationId,
            deliveryId: alert.deliveryId,
            channel: alert.channel,
            recipient: alert.recipient,
            retryCount: alert.retryCount,
            timestamp: new Date().toISOString(),
          },
          recipients: await this.getAlertRecipients(alert.tenantId, alert.severity),
        },
        createdAt: new Date(),
      };

      const priority = this.getAlertPriority(alert.severity);

      await this.adminQueue.add("process-alert", alertJobData, {
        priority,
        attempts: 3,
        backoff: {
          type: "exponential",
          delay: 5000,
        },
        removeOnComplete: 10,
        removeOnFail: 10,
      });

      this.logger.log(`Sent ${alert.severity} alert for ${alert.type}`);
    } catch (error) {
      this.logger.error(`Failed to send failure alert: ${error.message}`);
    }
  }

  private async shouldSendDeliveryAlert(
    notificationId: string,
    channel: string,
    retryCount: number,
  ): Promise<boolean> {
    try {
      const message = await this.messageRepository.findOne({
        where: { id: notificationId },
        select: { priority: true, channels: true },
      });

      if (!message) {
        return false;
      }

      if (message.priority === "high" || message.priority === "urgent") {
        return true;
      }

      const criticalChannels = ["email", "sms"];
      if (criticalChannels.includes(channel) && retryCount >= 3) {
        return true;
      }

      if (message.channels.length === 1 && retryCount >= 2) {
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error determining alert necessity: ${error.message}`);
      return false;
    }
  }

  private async getAlertRecipients(tenantId: string, severity: string): Promise<string[]> {
    try {
      const systemAdmins = process.env.SYSTEM_ADMIN_EMAILS?.split(",") || [];

      if (severity === "critical" || severity === "high") {
        const tenantAdmins = process.env.TENANT_ADMIN_EMAILS?.split(",") || [];
        return [...systemAdmins, ...tenantAdmins];
      }

      return systemAdmins;
    } catch (error) {
      this.logger.error(`Error getting alert recipients: ${error.message}`);
      return [];
    }
  }

  async retryNotification(
    job: Job<NotificationJobData & { originalError: string }>,
  ): Promise<void> {
    const { notificationId, tenantId, retryCount = 0, originalError } = job.data;
    const maxRetries = 5;
    const baseDelay = 1000;

    this.logger.log(
      `Retrying notification ${notificationId} (attempt ${retryCount + 1}/${maxRetries})`,
    );

    if (retryCount >= maxRetries) {
      await this.handleFailedNotification(job);
      return;
    }

    try {
      const delay = baseDelay * Math.pow(2, retryCount);

      const jitter = Math.random() * 1000;
      const totalDelay = delay + jitter;

      const jobData: NotificationJobData = {
        notificationId,
        tenantId,
        priority: Priority.NORMAL,
        retryCount: retryCount + 1,
      };

      await this.notificationQueue.add("process-notification", jobData, {
        delay: totalDelay,
        attempts: 1,
        removeOnComplete: 10,
        removeOnFail: 10,
      });

      this.logger.log(`Scheduled retry for notification ${notificationId} in ${totalDelay}ms`);
    } catch (error) {
      this.logger.error(
        `Failed to schedule retry for notification ${notificationId}: ${error.message}`,
      );
      await this.handleFailedNotification(job);
    }
  }

  async retryDelivery(job: Job<DeliveryJobData & { originalError: string }>): Promise<void> {
    const { deliveryId, notificationId, tenantId, retryCount = 0, originalError } = job.data;
    const maxRetries = 3;
    const baseDelay = 2000;

    this.logger.log(`Retrying delivery ${deliveryId} (attempt ${retryCount + 1}/${maxRetries})`);

    if (retryCount >= maxRetries) {
      await this.handleFailedDelivery(job);
      return;
    }

    try {
      const delay = baseDelay * Math.pow(2, retryCount);

      const jitter = Math.random() * 500;
      const totalDelay = delay + jitter;

      const jobData: DeliveryJobData = {
        ...job.data,
        retryCount: retryCount + 1,
      };

      await this.deliveryQueue.add("process-delivery", jobData, {
        delay: totalDelay,
        attempts: 1,
        removeOnComplete: 10,
        removeOnFail: 10,
      });

      this.logger.log(`Scheduled retry for delivery ${deliveryId} in ${totalDelay}ms`);
    } catch (error) {
      this.logger.error(`Failed to schedule retry for delivery ${deliveryId}: ${error.message}`);
      await this.handleFailedDelivery(job);
    }
  }

  private getPriorityValue(priority: Priority): number {
    switch (priority) {
      case Priority.URGENT:
        return 1;
      case Priority.HIGH:
        return 2;
      case Priority.NORMAL:
        return 3;
      case Priority.LOW:
        return 4;
      default:
        return 3;
    }
  }

  private getAlertPriority(severity: string): number {
    switch (severity) {
      case "critical":
        return 1;
      case "high":
        return 2;
      case "medium":
        return 3;
      case "low":
        return 4;
      default:
        return 3;
    }
  }
}
