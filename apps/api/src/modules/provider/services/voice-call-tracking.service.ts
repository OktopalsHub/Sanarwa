import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { IsNull, LessThan, Repository } from "typeorm";
import { BillingIntegrationService } from "../../billing/services/billing-integration.service";
import { VoiceCall } from "../entities/voice-call.entity";

export interface CallStartData {
  tenantId: string;
  callControlId: string;
  phoneNumber: string;
  ttsMessage?: string;
  metadata?: Record<string, any>;
}

export interface CallEndData {
  callControlId: string;
  hangupCause?: string;
}

type CallRecord = VoiceCall;

const SECONDS_PER_MINUTE = 60;
const MINUTE_MS = SECONDS_PER_MINUTE * 1000;
const NO_HANGUP_RECEIVED = "no_hangup_received";
const RECONCILE_BATCH_SIZE = 100;
const UNBILLED_RETRY_DELAY_MS = 2 * MINUTE_MS;
const STALE_RINGING_MS = 60 * MINUTE_MS;
const STALE_CONNECTED_MS = 120 * MINUTE_MS;

@Injectable()
export class VoiceCallTrackingService {
  private readonly logger = new Logger(VoiceCallTrackingService.name);

  constructor(
    @InjectRepository(VoiceCall)
    private readonly voiceCallRepo: Repository<VoiceCall>,
    private readonly billingIntegrationService: BillingIntegrationService,
  ) {}

  async startCall(data: CallStartData): Promise<CallRecord> {
    try {
      const rec = this.voiceCallRepo.create({
        callControlId: data.callControlId,
        tenantId: data.tenantId,
        phoneNumber: data.phoneNumber,
        status: "initiated",
        ttsMessage: data.ttsMessage,
        metadata: data.metadata,
        startedAt: new Date(),
      });
      const saved = await this.voiceCallRepo.save(rec);
      this.logger.log(`Started tracking call: ${data.callControlId} for tenant: ${data.tenantId}`);
      return saved;
    } catch (error) {
      this.logger.error(`Failed to start call tracking: ${error.message}`, error.stack);
      throw error;
    }
  }

  async markCallAnswered(callControlId: string): Promise<void> {
    try {
      await this.voiceCallRepo.update(
        { callControlId, answeredAt: IsNull() },
        { status: "connected", answeredAt: new Date() },
      );
      this.logger.log(`Call answered: ${callControlId}`);
    } catch (error) {
      this.logger.error(`Failed to mark call as answered: ${error.message}`, error.stack);
    }
  }

  async endCall(data: CallEndData): Promise<void> {
    try {
      const callRecord = await this.voiceCallRepo.findOne({
        where: { callControlId: data.callControlId },
      });
      if (!callRecord) {
        this.logger.warn(`Call not found for tracking: ${data.callControlId}`);
        return;
      }
      if (String(callRecord.status) === "ended") {
        this.logger.log(`Call ${data.callControlId} already ended; ignoring duplicate hangup`);
        return;
      }

      const endedAt = new Date();
      const durationSeconds = callRecord.answeredAt
        ? Math.max(0, Math.round((endedAt.getTime() - callRecord.answeredAt.getTime()) / 1000))
        : 0;

      await this.voiceCallRepo.update({ callControlId: data.callControlId }, {
        status: "ended",
        duration: durationSeconds,
        endedAt,
        hangupCause: data.hangupCause,
      } as any);

      if (durationSeconds > 0) {
        await this.billCall({ ...callRecord, duration: durationSeconds });
      } else {
        this.logger.log(
          `Voice call ${data.callControlId} (tenant ${callRecord.tenantId}) never connected — not billed`,
        );
      }
    } catch (error) {
      this.logger.error(`Failed to end call tracking: ${error.message}`, error.stack);
    }
  }

  /**
   * Retries billing for ended calls whose charge failed, then closes calls that
   * never received a hangup webhook. Safe to run on several instances: the
   * ledger charges each call at most once.
   */
  async reconcile(now: Date = new Date()): Promise<void> {
    await this.retryUnbilledCalls(now);
    await this.closeStaleCalls(now);
  }

  private async retryUnbilledCalls(now: Date): Promise<void> {
    const cutoff = new Date(now.getTime() - UNBILLED_RETRY_DELAY_MS);
    const calls = await this.voiceCallRepo.find({
      where: { status: "ended", billedAt: IsNull(), endedAt: LessThan(cutoff) },
      take: RECONCILE_BATCH_SIZE,
    });

    for (const call of calls) {
      if ((call.duration ?? 0) > 0) {
        await this.billCall(call);
      }
    }
  }

  private async closeStaleCalls(now: Date): Promise<void> {
    const staleRinging = await this.voiceCallRepo.update(
      {
        status: "initiated",
        startedAt: LessThan(new Date(now.getTime() - STALE_RINGING_MS)),
      },
      { status: "failed", endedAt: now, hangupCause: NO_HANGUP_RECEIVED },
    );
    if (staleRinging.affected) {
      this.logger.warn(`Closed ${staleRinging.affected} voice call(s) that never connected`);
    }

    const staleConnected = await this.voiceCallRepo.find({
      where: {
        status: "connected",
        answeredAt: LessThan(new Date(now.getTime() - STALE_CONNECTED_MS)),
      },
      take: RECONCILE_BATCH_SIZE,
    });

    for (const call of staleConnected) {
      const claimed = await this.voiceCallRepo.update(
        { id: call.id, status: "connected" },
        {
          status: "ended",
          duration: SECONDS_PER_MINUTE,
          endedAt: now,
          hangupCause: NO_HANGUP_RECEIVED,
        },
      );
      if (!claimed.affected) {
        continue;
      }
      this.logger.error(
        `Voice call ${call.callControlId} (tenant ${call.tenantId}) never sent a hangup; billing the 1-minute minimum`,
      );
      await this.billCall({ ...call, duration: SECONDS_PER_MINUTE });
    }
  }

  private async billCall(call: CallRecord): Promise<void> {
    const billableMinutes = Math.max(1, Math.ceil((call.duration ?? 0) / SECONDS_PER_MINUTE));

    try {
      await this.billingIntegrationService.processNotificationTokenUsage(
        call.tenantId,
        "voice",
        `voice:${call.callControlId}`,
        "managed",
        { durationMinutes: billableMinutes, callControlId: call.callControlId },
        billableMinutes,
        { dedupeByReference: true },
      );
      await this.voiceCallRepo.update({ id: call.id }, { billedAt: new Date() });
      this.logger.log(
        `Billed ${billableMinutes} minute(s) for voice call ${call.callControlId} (tenant ${call.tenantId})`,
      );
    } catch (error) {
      this.logger.error(
        `Failed to bill voice usage for ${call.callControlId} (tenant ${call.tenantId}); will retry: ${(error as Error).message}`,
      );
    }
  }

  async markCallFailed(callControlId: string, hangupCause?: string): Promise<void> {
    try {
      await this.voiceCallRepo.update({ callControlId }, {
        status: "failed",
        endedAt: new Date(),
        hangupCause,
      } as any);
      this.logger.log(`Call failed: ${callControlId}, Cause: ${hangupCause}`);
    } catch (error) {
      this.logger.error(`Failed to mark call as failed: ${error.message}`, error.stack);
    }
  }

  async getCallByControlId(callControlId: string): Promise<CallRecord | null> {
    try {
      return await this.voiceCallRepo.findOne({ where: { callControlId } });
    } catch (error) {
      this.logger.error(`Failed to get call: ${error.message}`, error.stack);
      return null;
    }
  }

  async getCallStats(
    tenantId: string,
    startDate?: Date,
  ): Promise<{
    totalCalls: number;
    totalMinutes: number;
    successfulCalls: number;
    failedCalls: number;
    averageDuration: number;
  }> {
    try {
      const qb = this.voiceCallRepo
        .createQueryBuilder("v")
        .where("v.tenant_id = :tenantId", { tenantId });
      if (startDate) qb.andWhere("v.created_at >= :startDate", { startDate });
      const calls = await qb.getMany();
      const totalCalls = calls.length;
      const successfulCalls = calls.filter((c) => c.status === "ended").length;
      const failedCalls = calls.filter((c) => c.status === "failed").length;
      const totalSeconds = calls.reduce((s, c) => s + (c.duration || 0), 0);
      const totalMinutes = Math.ceil(totalSeconds / 60);
      const averageDuration = totalCalls ? totalSeconds / totalCalls : 0;
      return { totalCalls, totalMinutes, successfulCalls, failedCalls, averageDuration };
    } catch (error) {
      this.logger.error(`Failed to get call stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  async getRecentCalls(tenantId: string, limit: number = 50): Promise<CallRecord[]> {
    try {
      return await this.voiceCallRepo.find({
        where: { tenantId },
        order: { createdAt: "DESC" },
        take: limit,
      });
    } catch (error) {
      this.logger.error(`Failed to get recent calls: ${error.message}`, error.stack);
      throw error;
    }
  }
}
