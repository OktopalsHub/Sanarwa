import { randomUUID } from "node:crypto";
import { Injectable, Logger } from "@nestjs/common";
import { BusinessLogicException } from "../../common/errors/exceptions/base.exception";
import { ErrorCode } from "../../common/errors/types/error.types";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import {
  SendUnifiedDto,
  UnifiedDeliverySummary,
  UnifiedSendResponse,
} from "./dto/unified-send.dto";
import { Message, MessagePriority, MessageStatus } from "./message.entity";
import {
  MessageDelivery,
  MessageDeliveryStatus,
  DeliveryEngagementStatus,
  DeliveryTransportStatus,
} from "./message-delivery.entity";
import { NotificationQueueService } from "./queue/notification-queue.service";
import { NotificationStorageService } from "../notifications/storage/notification-storage.service";
import { NotificationLog } from "../notifications/entities/notification-log.entity";
import { NotificationStoragePolicy } from "../notifications/enums/notification-storage-policy.enum";
import { IdempotencyService } from "./idempotency/idempotency.service";
import { resolveAddress } from "./resolve-address";

@Injectable()
export class UnifiedSendService {
  private readonly logger = new Logger(UnifiedSendService.name);

  constructor(
    @InjectRepository(Message)
    private readonly messageRepository: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private readonly deliveryRepository: Repository<MessageDelivery>,
    private readonly queueService: NotificationQueueService,
    private readonly storageService: NotificationStorageService,
    @InjectRepository(NotificationLog)
    private readonly logRepository: Repository<NotificationLog>,
    private readonly idempotency: IdempotencyService,
  ) {}

  async send(
    dto: SendUnifiedDto,
    tenantId: string,
    projectId?: string,
    idempotencyKey?: string,
  ): Promise<UnifiedSendResponse> {
    if (idempotencyKey) {
      const claim = await this.idempotency.claim(tenantId, idempotencyKey);

      if (claim.kind === "done") {
        return claim.row.response as unknown as UnifiedSendResponse;
      }

      if (claim.kind === "inflight") {
        throw new BusinessLogicException(
          ErrorCode.DUPLICATE_RESOURCE,
          "Idempotency key is already being processed",
          {
            correlationId: randomUUID(),
            tenantId,
            timestamp: new Date(),
            metadata: { key: idempotencyKey },
          },
          "Another request with this idempotency key is still in flight",
          false,
        );
      }

      try {
        const response = await this.sendClaimed(dto, tenantId, projectId);
        await this.idempotency.complete(
          tenantId,
          idempotencyKey,
          response.messageId ?? "",
          response,
        );
        return response;
      } catch (error) {
        await this.idempotency.abandon(tenantId, idempotencyKey);
        throw error;
      }
    }

    return this.sendClaimed(dto, tenantId, projectId);
  }

  private async sendClaimed(
    dto: SendUnifiedDto,
    tenantId: string,
    projectId?: string,
  ): Promise<UnifiedSendResponse> {
    const requestedChannels = [...new Set(dto.channels ?? [dto.channel!])];
    const fallbackList = Array.isArray(dto.fallback) ? dto.fallback : [];
    const fallbackEnabled = dto.fallback === true || fallbackList.length > 0;
    const sendOrder = fallbackEnabled
      ? [...new Set([...requestedChannels, ...fallbackList])]
      : requestedChannels;
    const scheduledAt = dto.scheduledAt ? new Date(dto.scheduledAt) : undefined;
    const policy = await this.storageService.getStoragePolicy(tenantId);
    const persistBody = this.storageService.shouldPersistBody(policy);
    const persistMetadata = this.storageService.shouldPersistMetadata(policy);

    const recipients = dto.recipients ?? (dto.to !== undefined ? [{ id: dto.to }] : []);

    const deliveries: Array<{
      channel: NotificationChannel;
      recipient: string;
      subscriberId: string;
      fallbackChain?: NotificationChannel[];
    }> = [];
    const failedEntries: UnifiedDeliverySummary[] = [];

    if (fallbackEnabled) {
      // With fallback, channels are attempted sequentially per recipient: the
      // first channel with an address goes out now, the rest ride along on
      // the delivery's `fallbackChain` and are tried only if it fails
      // terminally. Fan-out (all channels in parallel) only happens when
      // `fallback` is not set.
      for (const recipient of recipients) {
        const resolved = sendOrder
          .map((channel) => ({
            channel,
            address:
              dto.to !== undefined ? dto.to : resolveAddress(recipient, channel, dto.chatProvider),
          }))
          .filter(
            (entry): entry is { channel: NotificationChannel; address: string } =>
              entry.address !== null,
          );

        if (resolved.length === 0) {
          failedEntries.push({
            channel: sendOrder[0]!,
            status: "failed",
            error: "No recipient address available on any fallback channel",
          });
          continue;
        }

        const [primary, ...rest] = resolved;

        deliveries.push({
          channel: primary.channel,
          recipient: primary.address,
          subscriberId: recipient.userId ?? recipient.id,
          ...(rest.length > 0 ? { fallbackChain: rest.map((entry) => entry.channel) } : {}),
        });
      }
    } else {
      for (const channel of sendOrder) {
        const addressed = recipients.flatMap((recipient) => {
          const address =
            dto.to !== undefined ? dto.to : resolveAddress(recipient, channel, dto.chatProvider);
          return address === null
            ? []
            : [{ recipient, address, subscriberId: recipient.userId ?? recipient.id }];
        });

        if (addressed.length === 0) {
          failedEntries.push({
            channel,
            status: "failed",
            error: "No recipient address available for this channel",
          });
          continue;
        }

        for (const entry of addressed) {
          deliveries.push({ channel, recipient: entry.address, subscriberId: entry.subscriberId });
        }
      }
    }

    if (deliveries.length === 0) {
      return {
        status: "failed",
        deliveries:
          failedEntries.length > 0
            ? failedEntries
            : sendOrder.map((channel) => ({
                channel,
                status: "failed",
                error: "No recipient address available for this channel",
              })),
      };
    }

    const isFutureSchedule = scheduledAt !== undefined && scheduledAt.getTime() > Date.now();

    const message = await this.messageRepository.save(
      this.messageRepository.create({
        tenantId,
        channels: sendOrder,
        recipients,
        templateId: dto.templateId,
        variables: dto.variables ?? {},
        subject: persistBody ? dto.subject : undefined,
        data: persistBody ? dto.data : undefined,
        scheduledAt,
        priority: dto.priority ?? MessagePriority.NORMAL,
        status: isFutureSchedule ? MessageStatus.PENDING : MessageStatus.PROCESSING,
        metadata: persistMetadata
          ? {
              ...dto.metadata,
              projectId,
              storagePolicy: policy,
              brandId: dto.brandId,
              chatProvider: dto.chatProvider,
            }
          : {
              storagePolicy: policy,
              chatProvider: dto.chatProvider,
            },
      }),
    );

    const createdDeliveries = await this.deliveryRepository.save(
      this.deliveryRepository.create(
        deliveries.map((delivery) => ({
          messageId: message.id,
          tenantId,
          channel: delivery.channel,
          providerId: "pending",
          recipient: delivery.recipient,
          status: MessageDeliveryStatus.PENDING,
          transportStatus: DeliveryTransportStatus.PENDING,
          engagementStatus: DeliveryEngagementStatus.UNKNOWN,
          stateUpdatedAt: new Date(),
          metadata: {
            projectId,
            templateId: dto.templateId,
            templateData: dto.variables ?? {},
            chatProvider: dto.chatProvider,
            subscriberId: delivery.subscriberId,
            priority: dto.priority,
            ...(delivery.fallbackChain?.length ? { fallbackChain: delivery.fallbackChain } : {}),
          },
        })),
      ),
    );

    const trackingId =
      typeof (dto.metadata as Record<string, unknown> | undefined)?.trackingId === "string"
        ? ((dto.metadata as Record<string, unknown>).trackingId as string)
        : randomUUID();

    message.metadata = {
      ...(message.metadata ?? {}),
      trackingId,
    };
    await this.messageRepository.save(message);

    if (policy !== NotificationStoragePolicy.EPHEMERAL) {
      await this.logRepository.save(
        createdDeliveries.map((delivery) =>
          this.logRepository.create({
            trackingId,
            channel: delivery.channel,
            to: delivery.recipient,
            tenantId,
            projectId,
            status: "queued",
            scheduledAt,
            metadata: {
              templateId: dto.templateId,
              priority: dto.priority,
              messageId: message.id,
              deliveryId: delivery.id,
              projectId,
              storagePolicy: policy,
              brandId: dto.brandId,
            },
          }),
        ),
      );
    }

    await this.queueService.addNotificationJob(
      message.id,
      tenantId,
      dto.priority ?? MessagePriority.NORMAL,
      isFutureSchedule ? scheduledAt : undefined,
      0,
      {
        subject: dto.subject,
        data: dto.data,
        templateId: dto.templateId,
        variables: dto.variables,
        brandId: dto.brandId,
        storagePolicy: policy,
        chatProvider: dto.chatProvider,
      },
    );

    const queuedEntries: UnifiedDeliverySummary[] = [
      ...[...new Set(deliveries.map((delivery) => delivery.channel))].map((channel) => ({
        channel,
        status: "queued" as const,
      })),
      ...failedEntries,
    ];

    this.logger.log(
      `Enqueued ${createdDeliveries.length} deliveries for message ${message.id} (${sendOrder.join(", ")})`,
    );

    return {
      messageId: message.id,
      trackingId,
      status: "queued",
      deliveries: queuedEntries,
    };
  }
}
