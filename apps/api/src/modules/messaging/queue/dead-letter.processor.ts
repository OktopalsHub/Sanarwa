import { Process, Processor } from "@nestjs/bull";
import { Injectable, Logger } from "@nestjs/common";
import { Job } from "bull";
import { NOTIFICATION_QUEUE } from "./notification-queue.constants";
import { DeadLetter, DeadLetterStatus, DeadLetterType } from "../entities/dead-letter.entity";
import { AlertSeverity, AlertType } from "../entities/system-alert.entity";
import { DeadLetterRepository } from "../repositories/dead-letter.repository";
import { DeadLetterAlertService } from "./dead-letter-alert.service";
import type { AlertJobData, DeadLetterJobData } from "./dead-letter.types";

export type { AlertJobData, DeadLetterJobData } from "./dead-letter.types";

@Processor(NOTIFICATION_QUEUE)
@Injectable()
export class DeadLetterProcessor {
  private readonly logger = new Logger(DeadLetterProcessor.name);

  constructor(
    private readonly deadLetterRepository: DeadLetterRepository,
    private readonly alertService: DeadLetterAlertService,
  ) {}

  @Process("handle-dead-letter")
  async handleDeadLetter(job: Job<DeadLetterJobData>): Promise<void> {
    const { originalType, originalId } = job.data;
    this.logger.log(`Processing dead letter item: ${originalType} ${originalId}`);

    await this.storeDeadLetterItem(job.data);
    await this.notifyAdministrators(job.data);
  }

  @Process("process-alert")
  async processAlert(job: Job<AlertJobData>): Promise<void> {
    const { alert } = job.data;
    this.logger.log(`Processing system alert: ${alert.type} (${alert.severity})`);
    await this.alertService.sendAlert(alert);
    await this.alertService.storeAlert(alert);
  }

  private async storeDeadLetterItem(data: DeadLetterJobData): Promise<void> {
    const savedRecord = await this.deadLetterRepository.create({
      originalType: data.originalType as DeadLetterType,
      originalId: data.originalId,
      tenantId: data.tenantId,
      failureReason: data.failureReason,
      failedAt: data.failedAt,
      retryCount: data.retryCount,
      originalJobData: data.originalJobData,
      messageData: data.messageData,
      deliveryData: data.deliveryData,
      status: DeadLetterStatus.PENDING_REVIEW,
      metadata: {
        processedAt: new Date(),
        processor: "dead-letter-processor",
      },
    });

    if (data.retryCount >= 3) {
      await this.createCriticalFailureAlert(savedRecord);
    }
  }

  private async notifyAdministrators(data: DeadLetterJobData): Promise<void> {
    const adminEmails = this.alertService.getAdminEmails(data.tenantId);
    if (adminEmails.length === 0) {
      this.logger.warn("No admin emails configured for dead letter notifications");
      return;
    }
    await this.alertService.sendDeadLetterNotification(adminEmails, data);
  }

  private async createCriticalFailureAlert(deadLetter: DeadLetter): Promise<void> {
    await this.alertService.sendAlert({
      type: AlertType.DEAD_LETTER,
      severity: AlertSeverity.CRITICAL,
      title: `Critical Failure: ${deadLetter.originalType} ${deadLetter.originalId}`,
      message: `A ${deadLetter.originalType} has failed ${deadLetter.retryCount} times and requires manual intervention.`,
      tenantId: deadLetter.tenantId,
      metadata: {
        deadLetterId: deadLetter.id,
        originalType: deadLetter.originalType,
        originalId: deadLetter.originalId,
        failureReason: deadLetter.failureReason,
        retryCount: deadLetter.retryCount,
      },
      recipients: this.alertService.getAdminEmails(deadLetter.tenantId),
    });
  }
}
