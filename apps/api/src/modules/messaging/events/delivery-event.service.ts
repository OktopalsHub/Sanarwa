import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { QueryDeepPartialEntity } from "typeorm/query-builder/QueryPartialEntity";
import {
  MessageDeliveryStatus as DeliveryStatus,
  MessageDelivery,
} from "../message-delivery.entity";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { DeliveryEvent } from "../entities/delivery-event.entity";
import { BounceType, DeliveryEventType } from "../enums/delivery-event-type.enum";
import { ConsentService } from "../../preferences/consent.service";

export interface RecordDeliveryEventInput {
  tenantId: string;
  channel: NotificationChannel;
  provider: string;
  type: DeliveryEventType;
  messageId?: string;
  deliveryId?: string;
  bounceType?: BounceType;
  reasonCode?: string;
  diagnostic?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  providerEventId?: string;
  providerMessageId?: string;
  raw?: Record<string, any>;
  occurredAt?: Date;
}

export interface ProviderFeedbackInput {
  provider: string;
  providerMessageId?: string;
  providerEventId?: string;
  type: DeliveryEventType;
  bounceType?: BounceType;
  reasonCode?: string;
  diagnostic?: string;
  url?: string;
  userAgent?: string;
  ip?: string;
  recipient?: string;
  channel?: NotificationChannel;
  raw?: Record<string, any>;
  occurredAt?: Date;
}

export type FeedbackOutcome =
  | { recorded: true; deliveryId: string }
  | { recorded: false; reason: "orphan" | "duplicate" };

@Injectable()
export class DeliveryEventService {
  private readonly logger = new Logger(DeliveryEventService.name);

  constructor(
    @InjectRepository(DeliveryEvent)
    private readonly events: Repository<DeliveryEvent>,
    @InjectRepository(MessageDelivery)
    private readonly deliveries: Repository<MessageDelivery>,
    private readonly consentService: ConsentService,
  ) {}

  async record(input: RecordDeliveryEventInput): Promise<{ id: string; created: boolean }> {
    const event: Partial<DeliveryEvent> = {
      tenantId: input.tenantId,
      channel: input.channel,
      provider: input.provider,
      type: input.type,
      messageId: input.messageId,
      deliveryId: input.deliveryId,
      bounceType: input.bounceType,
      reasonCode: input.reasonCode,
      diagnostic: input.diagnostic,
      url: input.url,
      userAgent: input.userAgent,
      ip: input.ip,
      providerEventId: input.providerEventId,
      providerMessageId: input.providerMessageId,
      raw: input.raw ?? {},
      occurredAt: input.occurredAt ?? new Date(),
    };

    try {
      const saved = await this.events.save(this.events.create(event));
      return { id: saved.id, created: true };
    } catch (error) {
      if (input.providerEventId && (error as any)?.driverError?.code === "23505") {
        this.logger.log(
          `Duplicate provider event ${input.providerEventId} for provider ${input.provider}; ignored`,
        );
        return { id: "duplicate", created: false };
      }
      throw error;
    }
  }

  async ingestProviderFeedback(input: ProviderFeedbackInput): Promise<FeedbackOutcome> {
    const delivery = input.providerMessageId
      ? await this.deliveries.findOne({
          where: { providerMessageId: input.providerMessageId },
        })
      : null;

    if (!delivery) {
      this.logger.warn(
        `No delivery for provider_message_id ${input.providerMessageId ?? "?"}; ignoring ${input.provider} ${input.type}`,
      );
      return { recorded: false, reason: "orphan" };
    }

    const occurredAt = input.occurredAt ?? new Date();
    const outcome = await this.record({
      tenantId: delivery.tenantId,
      channel: delivery.channel,
      provider: input.provider,
      type: input.type,
      messageId: delivery.messageId,
      deliveryId: delivery.id,
      bounceType: input.bounceType,
      reasonCode: input.reasonCode,
      diagnostic: input.diagnostic,
      url: input.url,
      userAgent: input.userAgent,
      ip: input.ip,
      providerEventId: input.providerEventId,
      providerMessageId: input.providerMessageId,
      raw: input.raw,
      occurredAt,
    });

    if (!outcome.created) {
      return { recorded: false, reason: "duplicate" };
    }

    const address =
      (delivery.recipient ?? "").trim().toLowerCase() ||
      (input.recipient ?? "").trim().toLowerCase();

    const suppressionReason =
      input.type === DeliveryEventType.BOUNCED && input.bounceType === "hard"
        ? "bounce"
        : input.type === DeliveryEventType.COMPLAINED
          ? "complaint"
          : input.type === DeliveryEventType.UNSUBSCRIBED
            ? "unsubscribe"
            : null;

    if (suppressionReason && address) {
      await this.consentService.suppress(delivery.tenantId, address, suppressionReason);
    }

    await this.applyProjection(delivery, input.type, occurredAt, input);

    return { recorded: true, deliveryId: delivery.id };
  }

  async findByDelivery(
    tenantId: string,
    deliveryId: string,
    limit = 100,
  ): Promise<DeliveryEvent[]> {
    return this.events.find({
      where: { tenantId, deliveryId },
      order: { occurredAt: "ASC" },
      take: limit,
    });
  }

  async findByMessage(tenantId: string, messageId: string, limit = 100): Promise<DeliveryEvent[]> {
    return this.events.find({
      where: { tenantId, messageId },
      order: { occurredAt: "ASC" },
      take: limit,
    });
  }

  /**
   * MessageDelivery is the latest-state projection of the event log. A hard
   * bounce or unsubscribe is terminal for the projection: later
   * delivered/opened/clicked events still append to `delivery_events` but
   * must not overwrite the bounce/unsubscribe status.
   */
  private async applyProjection(
    delivery: MessageDelivery,
    type: DeliveryEventType,
    occurredAt: Date,
    input: ProviderFeedbackInput,
  ): Promise<void> {
    const terminalStatuses = new Set<string>([DeliveryStatus.BOUNCED, DeliveryStatus.UNSUBSCRIBED]);
    const progressionTypes = new Set<string>([
      DeliveryEventType.DELIVERED,
      DeliveryEventType.OPENED,
      DeliveryEventType.CLICKED,
    ]);

    if (terminalStatuses.has(delivery.status) && progressionTypes.has(type)) {
      this.logger.debug(
        `Ignoring ${type} projection for ${delivery.id} — status ${delivery.status} is terminal`,
      );
      return;
    }

    const projection: QueryDeepPartialEntity<MessageDelivery> = {};

    switch (type) {
      case DeliveryEventType.DELIVERED:
        projection.status = DeliveryStatus.DELIVERED;
        projection.deliveredAt = occurredAt;
        break;
      case DeliveryEventType.OPENED:
        projection.status = DeliveryStatus.OPENED;
        projection.openedAt = occurredAt;
        break;
      case DeliveryEventType.CLICKED:
        projection.status = DeliveryStatus.CLICKED;
        projection.openedAt = delivery.openedAt ?? occurredAt;
        projection.clickedAt = occurredAt;
        break;
      case DeliveryEventType.BOUNCED:
        projection.status = DeliveryStatus.BOUNCED;
        projection.errorMessage = input.reasonCode ?? input.diagnostic?.slice(0, 500) ?? "Bounced";
        break;
      case DeliveryEventType.UNSUBSCRIBED:
        projection.status = DeliveryStatus.UNSUBSCRIBED;
        break;
      case DeliveryEventType.DROPPED:
        projection.status = DeliveryStatus.FAILED;
        projection.errorMessage =
          input.reasonCode ?? input.diagnostic?.slice(0, 500) ?? "Dropped by provider";
        break;
      default:
        return;
    }

    await this.deliveries.update({ id: delivery.id }, projection);
  }
}
