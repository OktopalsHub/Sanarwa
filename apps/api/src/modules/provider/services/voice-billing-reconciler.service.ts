import { Injectable, Logger } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { VoiceCallTrackingService } from "./voice-call-tracking.service";

@Injectable()
export class VoiceBillingReconcilerService {
  private readonly logger = new Logger(VoiceBillingReconcilerService.name);

  constructor(private readonly tracking: VoiceCallTrackingService) {}

  @Cron(CronExpression.EVERY_5_MINUTES)
  async run(): Promise<void> {
    try {
      await this.tracking.reconcile();
    } catch (error) {
      this.logger.error(`Voice billing reconciliation failed: ${(error as Error).message}`);
    }
  }
}
