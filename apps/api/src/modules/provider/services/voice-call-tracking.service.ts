import { Injectable, Logger } from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { BillingService } from "./billing.service";
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
    private billingService: BillingService,
    @InjectRepository(VoiceCall)
    private readonly voiceCallRepo: Repository<VoiceCall>,
  ) {}

  /**
   * Start tracking a new voice call - managed only, DB persist (was Map)
   */
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

  /**
   * Update call status when answered
   */
  async markCallAnswered(callControlId: string): Promise<void> {
    try {
      await this.voiceCallRepo.update({ callControlId }, { status: "connected" as any });
      this.logger.log(`Call answered: ${callControlId}`);
    } catch (error) {
      this.logger.error(`Failed to mark call as answered: ${error.message}`, error.stack);
    }
  }

  /**
   * End call tracking and deduct from quota - managed only DB
   */
  async endCall(data: CallEndData): Promise<void> {
    try {
      const callRecord = await this.voiceCallRepo.findOne({ where: { callControlId: data.callControlId } });
      if (!callRecord) {
        this.logger.warn(`Call not found for tracking: ${data.callControlId}`);
        return;
      }
      const billableSeconds = Math.ceil(data.durationSeconds / 60) * 60;
      await this.voiceCallRepo.update(
        { callControlId: data.callControlId },
        { status: "ended", duration: data.durationSeconds, endedAt: new Date(), hangupCause: data.hangupCause } as any,
      );
      const ttsCharacterCount = callRecord.ttsMessage?.length || 0;
      await this.deductFromQuota(callRecord.tenantId, billableSeconds, ttsCharacterCount);
      this.logger.log(`Call ended: ${data.callControlId}, Duration: ${data.durationSeconds}s, Billable: ${billableSeconds}s`);
    } catch (error) {
      this.logger.error(`Failed to end call tracking: ${error.message}`, error.stack);
    }
  }

  /**
   * Mark call as failed
   */
  async markCallFailed(callControlId: string, hangupCause?: string): Promise<void> {
    try {
      await this.voiceCallRepo.update({ callControlId }, { status: "failed", endedAt: new Date(), hangupCause } as any);
      this.logger.log(`Call failed: ${callControlId}, Cause: ${hangupCause}`);
    } catch (error) {
      this.logger.error(`Failed to mark call as failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Deduct voice usage from tenant quota
   */
  private async deductFromQuota(
    tenantId: string,
    billableSeconds: number,
    ttsCharacters: number,
  ): Promise<void> {
    try {
      // Convert seconds to minutes for quota deduction
      const billableMinutes = Math.ceil(billableSeconds / 60);

      // Deduct voice minutes from quota
      await this.billingService.deductVoiceUsage(tenantId, {
        voiceMinutes: billableMinutes,
        ttsCharacters,
        provider: "telnyx",
        timestamp: new Date(),
      });

      this.logger.log(
        `Deducted from quota - Tenant: ${tenantId}, Minutes: ${billableMinutes}, TTS chars: ${ttsCharacters}`,
      );
    } catch (error) {
      this.logger.error(`Failed to deduct from quota: ${error.message}`, error.stack);
      // Don't throw - call tracking should still complete
    }
  }

  /**
   * Get call by control ID
   */
  async getCallByControlId(callControlId: string): Promise<CallRecord | null> {
    try {
      return await this.voiceCallRepo.findOne({ where: { callControlId } });
    } catch (error) {
      this.logger.error(`Failed to get call: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get call statistics for tenant - real DB (was Map stub returning 0)
   */
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
      const qb = this.voiceCallRepo.createQueryBuilder("v").where("v.tenant_id = :tenantId", { tenantId });
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

  /**
   * Get recent calls for tenant - real DB
   */
  async getRecentCalls(tenantId: string, limit: number = 50): Promise<CallRecord[]> {
    try {
      return await this.voiceCallRepo.find({ where: { tenantId }, order: { createdAt: "DESC" }, take: limit });
    } catch (error) {
      this.logger.error(`Failed to get recent calls: ${error.message}`, error.stack);
      throw error;
    }
  }
}
