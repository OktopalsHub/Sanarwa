import { Injectable, Logger } from '@nestjs/common';
import { BillingService } from './billing.service';

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

interface CallRecord {
  callControlId: string;
  tenantId: string;
  phoneNumber: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'initiated' | 'connected' | 'ended' | 'failed';
  ttsMessage?: string;
  hangupCause?: string;
  metadata?: Record<string, any>;
}

@Injectable()
export class VoiceCallTrackingService {
  private readonly logger = new Logger(VoiceCallTrackingService.name);
  private readonly activeCalls = new Map<string, CallRecord>();

  constructor(
    private billingService: BillingService,
  ) {}

  /**
   * Start tracking a new voice call
   */
  async startCall(data: CallStartData): Promise<CallRecord> {
    try {
      const callRecord: CallRecord = {
        callControlId: data.callControlId,
        tenantId: data.tenantId,
        phoneNumber: data.phoneNumber,
        startTime: new Date(),
        status: 'initiated',
        ttsMessage: data.ttsMessage,
        metadata: data.metadata,
      };

      this.activeCalls.set(data.callControlId, callRecord);
      
      this.logger.log(`Started tracking call: ${data.callControlId} for tenant: ${data.tenantId}`);
      
      return callRecord;
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
      const callRecord = this.activeCalls.get(callControlId);
      if (callRecord) {
        callRecord.status = 'connected';
        this.logger.log(`Call answered: ${callControlId}`);
      }
    } catch (error) {
      this.logger.error(`Failed to mark call as answered: ${error.message}`, error.stack);
    }
  }

  /**
   * End call tracking and deduct from quota
   */
  async endCall(data: CallEndData): Promise<void> {
    try {
      const callRecord = this.activeCalls.get(data.callControlId);

      if (!callRecord) {
        this.logger.warn(`Call not found for tracking: ${data.callControlId}`);
        return;
      }

      // Calculate billable seconds (usually rounded up to next minute)
      const billableSeconds = Math.ceil(data.durationSeconds / 60) * 60;

      // Update call record
      callRecord.status = 'ended';
      callRecord.duration = data.durationSeconds;
      callRecord.endTime = new Date();
      callRecord.hangupCause = data.hangupCause;

      // Deduct from tenant's voice quota
      const ttsCharacterCount = callRecord.ttsMessage?.length || 0;
      await this.deductFromQuota(callRecord.tenantId, billableSeconds, ttsCharacterCount);

      // Remove from active calls after processing
      this.activeCalls.delete(data.callControlId);

      this.logger.log(
        `Call ended: ${data.callControlId}, Duration: ${data.durationSeconds}s, Billable: ${billableSeconds}s`
      );
    } catch (error) {
      this.logger.error(`Failed to end call tracking: ${error.message}`, error.stack);
    }
  }

  /**
   * Mark call as failed
   */
  async markCallFailed(callControlId: string, hangupCause?: string): Promise<void> {
    try {
      const callRecord = this.activeCalls.get(callControlId);
      if (callRecord) {
        callRecord.status = 'failed';
        callRecord.endTime = new Date();
        callRecord.hangupCause = hangupCause;
        
        // Remove from active calls
        this.activeCalls.delete(callControlId);
      }

      this.logger.log(`Call failed: ${callControlId}, Cause: ${hangupCause}`);
    } catch (error) {
      this.logger.error(`Failed to mark call as failed: ${error.message}`, error.stack);
    }
  }

  /**
   * Deduct voice usage from tenant quota
   */
  private async deductFromQuota(tenantId: string, billableSeconds: number, ttsCharacters: number): Promise<void> {
    try {
      // Convert seconds to minutes for quota deduction
      const billableMinutes = Math.ceil(billableSeconds / 60);

      // Deduct voice minutes from quota
      await this.billingService.deductVoiceUsage(tenantId, {
        voiceMinutes: billableMinutes,
        ttsCharacters,
        provider: 'telnyx',
        timestamp: new Date(),
      });

      this.logger.log(
        `Deducted from quota - Tenant: ${tenantId}, Minutes: ${billableMinutes}, TTS chars: ${ttsCharacters}`
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
      return this.activeCalls.get(callControlId) || null;
    } catch (error) {
      this.logger.error(`Failed to get call: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * Get call statistics for tenant (simplified version)
   */
  async getCallStats(tenantId: string, startDate?: Date): Promise<{
    totalCalls: number;
    totalMinutes: number;
    successfulCalls: number;
    failedCalls: number;
    averageDuration: number;
  }> {
    try {
      // This is a simplified implementation since we don't have persistent storage
      // In a real implementation, you'd want to store call records in a database
      this.logger.log(`Getting call stats for tenant: ${tenantId} (simplified implementation)`);
      
      return {
        totalCalls: 0,
        totalMinutes: 0,
        successfulCalls: 0,
        failedCalls: 0,
        averageDuration: 0,
      };
    } catch (error) {
      this.logger.error(`Failed to get call stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get recent calls for tenant (simplified version)
   */
  async getRecentCalls(tenantId: string, limit: number = 50): Promise<CallRecord[]> {
    try {
      // Return active calls for this tenant
      const tenantCalls = Array.from(this.activeCalls.values())
        .filter(call => call.tenantId === tenantId)
        .slice(0, limit);
      
      return tenantCalls;
    } catch (error) {
      this.logger.error(`Failed to get recent calls: ${error.message}`, error.stack);
      throw error;
    }
  }
}