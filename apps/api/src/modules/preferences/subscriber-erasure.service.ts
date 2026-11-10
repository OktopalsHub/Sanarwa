import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { In, Repository } from "typeorm";
import { TopicSubscription } from "../topics/entities/topic.entity";
import { DeviceRegistration } from "../provider/entities/device-registration.entity";
import { Message, MessageRecipient } from "../messaging/message.entity";
import { MessageDelivery } from "../messaging/message-delivery.entity";
import { DeliveryEvent } from "../messaging/entities/delivery-event.entity";
import { NotificationLog } from "../notifications/entities/notification-log.entity";
import { DeadLetter } from "../messaging/entities/dead-letter.entity";
import { NotificationPreference } from "./entities/notification-preference.entity";
import { NotificationSuppression } from "./entities/notification-suppression.entity";
import { SubscriberQuietHours } from "./entities/subscriber-quiet-hours.entity";
import {
  isPiiKey,
  objectLooksLikeRecipient,
  redactPiiInValue,
  redactRecipient,
  recipientMatches,
} from "./services/pii-redaction";

export interface SubscriberEraseResult {
  preferences: number;
  quietHours: number;
  suppressions: number;
  topicSubscriptions: number;
  deviceRegistrations: number;
  messageDeliveries: number;
  deliveryEvents: number;
  /** Messages are multi-recipient; matching recipient entries are redacted in place. */
  messagesRedacted: number;
  notificationLogsRedacted: number;
  deadLettersRedacted: number;
}

interface EraseContext {
  tenantId: string;
  subscriberId: string;
  address: string;
}

/**
 * Deep module: tenant-scoped Subscriber erasure/redaction across stores (GDPR/right-to-erasure).
 * Interface: erase(tenantId, subscriberId) -> receipt. Store-specific behavior is localized in
 * internal participants (per-store/concern adapters behind this module's seam) so callers/tests
 * cross one interface and new PII stores extend in one place.
 */
@Injectable()
export class SubscriberErasureService {
  private readonly logger = new Logger(SubscriberErasureService.name);

  constructor(
    @InjectRepository(NotificationPreference)
    private readonly preferences: Repository<NotificationPreference>,
    @InjectRepository(NotificationSuppression)
    private readonly suppressions: Repository<NotificationSuppression>,
    @InjectRepository(SubscriberQuietHours)
    private readonly quietHours: Repository<SubscriberQuietHours>,
    @InjectRepository(TopicSubscription)
    private readonly topicSubscriptions: Repository<TopicSubscription>,
    @InjectRepository(DeviceRegistration)
    private readonly deviceRegistrations: Repository<DeviceRegistration>,
    @InjectRepository(Message)
    private readonly messages: Repository<Message>,
    @InjectRepository(MessageDelivery)
    private readonly messageDeliveries: Repository<MessageDelivery>,
    @InjectRepository(DeliveryEvent)
    private readonly deliveryEvents: Repository<DeliveryEvent>,
    @InjectRepository(NotificationLog)
    private readonly notificationLogs: Repository<NotificationLog>,
    @InjectRepository(DeadLetter)
    private readonly deadLetters: Repository<DeadLetter>,
  ) {}

  async erase(tenantId: string, subscriberId: string): Promise<SubscriberEraseResult> {
    const ctx: EraseContext = {
      tenantId,
      subscriberId: subscriberId.trim(),
      address: subscriberId.trim().toLowerCase(),
    };

    // Participant seam (internal): each concern owns its delete/redact behavior.
    const [preferences, suppressions, devices, messaging] = await Promise.all([
      this.erasePreferencesParticipant(ctx),
      this.eraseSuppressionsParticipant(ctx),
      this.eraseDevicesParticipant(ctx),
      this.eraseMessagingParticipant(ctx),
    ]);
    const logs = await this.eraseLogsParticipant(ctx);

    const counts: SubscriberEraseResult = {
      ...preferences,
      ...suppressions,
      ...devices,
      ...messaging,
      ...logs,
    };

    this.logger.log(
      `Erased subscriber ${ctx.subscriberId} data: prefs=${counts.preferences} quietHours=${counts.quietHours} suppressions=${counts.suppressions} topicSubs=${counts.topicSubscriptions} devices=${counts.deviceRegistrations} deliveries=${counts.messageDeliveries} deliveryEvents=${counts.deliveryEvents} messagesRedacted=${counts.messagesRedacted} logsRedacted=${counts.notificationLogsRedacted} deadLettersRedacted=${counts.deadLettersRedacted}`,
    );
    return counts;
  }

  private async erasePreferencesParticipant(
    ctx: EraseContext,
  ): Promise<Pick<SubscriberEraseResult, "preferences" | "quietHours" | "topicSubscriptions">> {
    const [prefs, hours] = await Promise.all([
      this.preferences.delete({ tenantId: ctx.tenantId, subscriberId: ctx.subscriberId }),
      this.quietHours.delete({ tenantId: ctx.tenantId, subscriberId: ctx.subscriberId }),
    ]);
    // TopicSubscription has no tenantId; scope via topics owned by the tenant.
    const topicSubResult = await this.topicSubscriptions
      .createQueryBuilder()
      .delete()
      .where("subscriber_id = :subscriberId", { subscriberId: ctx.subscriberId })
      .andWhere("topic_id IN (SELECT id FROM topics WHERE tenant_id = :tenantId)", {
        tenantId: ctx.tenantId,
      })
      .execute();
    return {
      preferences: prefs.affected ?? 0,
      quietHours: hours.affected ?? 0,
      topicSubscriptions: topicSubResult.affected ?? 0,
    };
  }

  private async eraseSuppressionsParticipant(
    ctx: EraseContext,
  ): Promise<Pick<SubscriberEraseResult, "suppressions">> {
    const suppressed = await this.suppressions.delete({
      tenantId: ctx.tenantId,
      address: ctx.address,
    });
    return { suppressions: suppressed.affected ?? 0 };
  }

  private async eraseDevicesParticipant(
    ctx: EraseContext,
  ): Promise<Pick<SubscriberEraseResult, "deviceRegistrations">> {
    const devices = await this.deviceRegistrations.delete({
      tenantId: ctx.tenantId,
      subscriberId: ctx.subscriberId,
    });
    return { deviceRegistrations: devices.affected ?? 0 };
  }

  private async eraseMessagingParticipant(
    ctx: EraseContext,
  ): Promise<
    Pick<SubscriberEraseResult, "messageDeliveries" | "deliveryEvents" | "messagesRedacted">
  > {
    // Message deliveries carry a recipient address (no subscriberId column).
    // Match the identifier as a recipient; erase linked delivery events first.
    const matchingDeliveries = await this.messageDeliveries.find({
      where: { tenantId: ctx.tenantId, recipient: ctx.address },
      select: { id: true },
    });
    const deliveryIds = matchingDeliveries.map((d) => d.id);
    let deliveryEvents = 0;
    if (deliveryIds.length > 0) {
      const ev = await this.deliveryEvents.delete({ deliveryId: In(deliveryIds) });
      deliveryEvents = ev.affected ?? 0;
    }
    const del = await this.messageDeliveries.delete({
      tenantId: ctx.tenantId,
      recipient: ctx.address,
    });
    const messagesRedacted = await this.redactSubscriberInMessages(
      ctx.tenantId,
      ctx.subscriberId,
      ctx.address,
    );
    return {
      messageDeliveries: del.affected ?? 0,
      deliveryEvents,
      messagesRedacted,
    };
  }

  private async eraseLogsParticipant(
    ctx: EraseContext,
  ): Promise<Pick<SubscriberEraseResult, "notificationLogsRedacted" | "deadLettersRedacted">> {
    const logRedact = await this.notificationLogs
      .createQueryBuilder()
      .update()
      .set({ to: "[redacted]" })
      .where("tenant_id = :tenantId", { tenantId: ctx.tenantId })
      .andWhere('LOWER("to") = :address', { address: ctx.address })
      .execute();
    const deadLettersRedacted = await this.redactSubscriberInDeadLetters(
      ctx.tenantId,
      ctx.subscriberId,
      ctx.address,
    );
    return {
      notificationLogsRedacted: logRedact.affected ?? 0,
      deadLettersRedacted,
    };
  }

  private async redactSubscriberInMessages(
    tenantId: string,
    subscriberId: string,
    address: string,
  ): Promise<number> {
    const like = `%${subscriberId.replace(/[%_\\]/g, "\\$&")}%`;
    const candidates = await this.messages
      .createQueryBuilder("m")
      .where("m.tenant_id = :tenantId", { tenantId })
      .andWhere("m.recipients::text ILIKE :like", { like })
      .getMany();

    let changed = 0;
    for (const message of candidates) {
      const recipients = Array.isArray(message.recipients) ? message.recipients : [];
      let touched = false;
      const next = recipients.map((r) => {
        if (!recipientMatches(r, subscriberId, address)) {
          return r;
        }
        touched = true;
        return redactRecipient(r);
      });
      if (touched) {
        message.recipients = next;
        await this.messages.save(message);
        changed++;
      }
    }
    return changed;
  }

  private async redactSubscriberInDeadLetters(
    tenantId: string,
    subscriberId: string,
    address: string,
  ): Promise<number> {
    const like = `%${subscriberId.replace(/[%_\\]/g, "\\$&")}%`;
    const candidates = await this.deadLetters
      .createQueryBuilder("d")
      .where("d.tenant_id = :tenantId", { tenantId })
      .andWhere(
        "(d.original_job_data::text ILIKE :like OR d.message_data::text ILIKE :like OR d.delivery_data::text ILIKE :like OR d.metadata::text ILIKE :like)",
        { like },
      )
      .getMany();

    let changed = 0;
    for (const dl of candidates) {
      let touched = false;
      const nextJob = redactPiiInValue(dl.originalJobData, subscriberId, address);
      const nextMsg = redactPiiInValue(dl.messageData, subscriberId, address);
      const nextDel = redactPiiInValue(dl.deliveryData, subscriberId, address);
      const nextMeta = redactPiiInValue(dl.metadata, subscriberId, address);
      if (nextJob.changed) {
        dl.originalJobData = nextJob.value;
        touched = true;
      }
      if (nextMsg.changed) {
        dl.messageData = nextMsg.value;
        touched = true;
      }
      if (nextDel.changed) {
        dl.deliveryData = nextDel.value;
        touched = true;
      }
      if (nextMeta.changed) {
        dl.metadata = nextMeta.value as any;
        touched = true;
      }
      if (touched) {
        await this.deadLetters.save(dl);
        changed++;
      }
    }
    return changed;
  }
}
