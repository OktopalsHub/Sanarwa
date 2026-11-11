import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
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
  durationSeconds: number;
  hangupCause?: string;
}

type CallRecord = VoiceCall;

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
      await this.voiceCallRepo.update({ callControlId }, { status: "connected" as any });
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
      // A call that never connected (or hung up in zero seconds) costs nothing.
      const billableMinutes = Math.max(1, Math.ceil(Math.max(0, data.durationSeconds) / 60));
      const shouldBill = data.durationSeconds > 0;
      await this.voiceCallRepo.update({ callControlId: data.callControlId }, {
        status: "ended",
        duration: data.durationSeconds,
        endedAt: new Date(),
        hangupCause: data.hangupCause,
      } as any);
      if (shouldBill) {
        try {
          await this.billingIntegrationService.processNotificationTokenUsage(
            callRecord.tenantId,
            "voice",
            `voice:${data.callControlId}`,
            "managed",
            { durationMinutes: billableMinutes, callControlId: data.callControlId },
            billableMinutes,
          );
          this.logger.log(
            `Billed ${billableMinutes} minute(s) for voice call ${data.callControlId} (tenant ${callRecord.tenantId})`,
          );
        } catch (billingError) {
          this.logger.error(
            `Failed to bill voice usage for ${data.callControlId} (tenant ${callRecord.tenantId}): ${(billingError as Error).message}`,
          );
        }
      } else {
        this.logger.log(
          `Voice call ${data.callControlId} (tenant ${callRecord.tenantId}) never connected — not billed`,
        );
      }
      this.logger.log(
        `Call ended: ${data.callControlId}, Duration: ${data.durationSeconds}s, Billable: ${billableMinutes}min`,
      );
    } catch (error) {
      this.logger.error(`Failed to end call tracking: ${error.message}`, error.stack);
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
