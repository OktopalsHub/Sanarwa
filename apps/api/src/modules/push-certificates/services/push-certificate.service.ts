import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PushCertificate, CertificateType, CertificateStatus } from '../entities/push-certificate.entity';
import { EventEmitter2 } from '@nestjs/event-emitter';

@Injectable()
export class PushCertificateService {
  private readonly logger = new Logger(PushCertificateService.name);

  constructor(
    @InjectRepository(PushCertificate)
    private readonly certificateRepository: Repository<PushCertificate>,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  /**
   * Validate a certificate
   */
  async validateCertificate(
    certificateId: string,
    tenantId: string,
  ): Promise<{ isValid: boolean; errors: string[]; warnings: string[] }> {
    const certificate = await this.certificateRepository.findOne({
      where: { id: certificateId, tenantId },
    });

    if (!certificate) {
      throw new Error('Certificate not found');
    }

    const validation = certificate.validateCertificate();

    // Update validation result
    certificate.validationResult = {
      ...validation,
      lastChecked: new Date(),
    };

    certificate.lastValidatedAt = new Date();

    if (validation.isValid && certificate.status === CertificateStatus.PENDING_VALIDATION) {
      certificate.status = CertificateStatus.ACTIVE;
    } else if (!validation.isValid) {
      certificate.status = CertificateStatus.INACTIVE;
    }

    await this.certificateRepository.save(certificate);

    this.eventEmitter.emit('certificate.validated', {
      certificateId,
      isValid: validation.isValid,
      errors: validation.errors,
      warnings: validation.warnings,
    });

    return validation;
  }

  /**
   * Test a certificate by sending a test push notification
   */
  async testCertificate(
    certificateId: string,
    tenantId: string,
    testDeviceToken: string,
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    const certificate = await this.certificateRepository.findOne({
      where: { id: certificateId, tenantId },
    });

    if (!certificate) {
      throw new Error('Certificate not found');
    }

    if (!certificate.isActive()) {
      throw new Error('Certificate is not active');
    }

    try {
      // This would integrate with the actual push provider (APNs for iOS, FCM for Android)
      // For now, we'll simulate the test

      const testResult = {
        success: true,
        messageId: `test_${Date.now()}`,
      };

      // Update test result
      certificate.testResult = {
        ...testResult,
        responseTime: 100, // simulated
        lastTested: new Date(),
      };

      certificate.lastTestedAt = new Date();
      certificate.totalNotificationsSent += 1;
      certificate.lastUsedAt = new Date();

      await this.certificateRepository.save(certificate);

      this.eventEmitter.emit('certificate.tested', {
        certificateId,
        success: testResult.success,
        messageId: testResult.messageId,
      });

      return testResult;

    } catch (error) {
      const testResult = {
        success: false,
        error: error.message,
      };

      certificate.testResult = {
        ...testResult,
        lastTested: new Date(),
      };

      await this.certificateRepository.save(certificate);

      this.eventEmitter.emit('certificate.test_failed', {
        certificateId,
        error: error.message,
      });

      return testResult;
    }
  }

  /**
   * Check for certificates that need rotation
   */
  async checkCertificatesForRotation(): Promise<PushCertificate[]> {
    const certificates = await this.certificateRepository.find({
      where: { status: CertificateStatus.ACTIVE },
    });

    const expiringCertificates: PushCertificate[] = [];

    for (const certificate of certificates) {
      if (certificate.needsRotation()) {
        expiringCertificates.push(certificate);

        // Update next rotation date if not set
        if (!certificate.nextRotationAt) {
          const rotationDays = certificate.rotationConfig?.rotationDaysBeforeExpiry || 30;
          const nextRotation = new Date(certificate.expiresAt!);
          nextRotation.setDate(nextRotation.getDate() - rotationDays);
          certificate.nextRotationAt = nextRotation;
          await this.certificateRepository.save(certificate);
        }

        this.eventEmitter.emit('certificate.needs_rotation', {
          certificateId: certificate.id,
          expiresAt: certificate.expiresAt,
          daysUntilExpiry: Math.ceil((certificate.expiresAt!.getTime() - Date.now()) / (1000 * 60 * 60 * 24)),
        });
      }
    }

    return expiringCertificates;
  }

  /**
   * Rotate a certificate (create new one and deactivate old)
   */
  async rotateCertificate(
    certificateId: string,
    tenantId: string,
    newCertificateData: any,
  ): Promise<PushCertificate> {
    const oldCertificate = await this.certificateRepository.findOne({
      where: { id: certificateId, tenantId },
    });

    if (!oldCertificate) {
      throw new Error('Certificate not found');
    }

    // Deactivate old certificate
    oldCertificate.status = CertificateStatus.INACTIVE;
    await this.certificateRepository.save(oldCertificate);

    // Create new certificate with same metadata
    const newCertificate = this.certificateRepository.create({
      name: `${oldCertificate.name} (Rotated)`,
      description: oldCertificate.description,
      type: oldCertificate.type,
      environment: oldCertificate.environment,
      certificateData: newCertificateData,
      tenantId: oldCertificate.tenantId,
      tenant: oldCertificate.tenant,
      projectId: oldCertificate.projectId,
      project: oldCertificate.project,
      allowedProjects: oldCertificate.allowedProjects,
      tags: [...(oldCertificate.tags || []), 'rotated'],
      status: CertificateStatus.PENDING_VALIDATION,
    });

    const savedCertificate = await this.certificateRepository.save(newCertificate);

    this.eventEmitter.emit('certificate.rotated', {
      oldCertificateId: certificateId,
      newCertificateId: savedCertificate.id,
    });

    return savedCertificate;
  }

  /**
   * Get certificate usage statistics
   */
  async getCertificateUsageStats(certificateId: string, tenantId: string): Promise<any> {
    const certificate = await this.certificateRepository.findOne({
      where: { id: certificateId, tenantId },
    });

    if (!certificate) {
      throw new Error('Certificate not found');
    }

    // In a real implementation, this would query notification logs
    // to get detailed usage statistics
    return {
      certificateId,
      totalNotificationsSent: certificate.totalNotificationsSent,
      lastUsedAt: certificate.lastUsedAt,
      status: certificate.status,
      environment: certificate.environment,
      type: certificate.type,
    };
  }

  /**
   * Update certificate metadata
   */
  async updateCertificateUsage(certificateId: string): Promise<void> {
    await this.certificateRepository.update(certificateId, {
      totalNotificationsSent: () => 'total_notifications_sent + 1',
      lastUsedAt: new Date(),
    });
  }

  /**
   * Get certificates expiring soon
   */
  async getExpiringCertificates(days: number = 30): Promise<PushCertificate[]> {
    const expiryDate = new Date();
    expiryDate.setDate(expiryDate.getDate() + days);

    return this.certificateRepository
      .createQueryBuilder('certificate')
      .where('certificate.expires_at <= :expiryDate', { expiryDate })
      .andWhere('certificate.status = :status', { status: CertificateStatus.ACTIVE })
      .getMany();
  }

  /**
   * Bulk validate certificates
   */
  async validateAllCertificates(): Promise<{ validated: number; errors: number }> {
    const certificates = await this.certificateRepository.find({
      where: { status: CertificateStatus.ACTIVE },
    });

    let validated = 0;
    let errors = 0;

    for (const certificate of certificates) {
      try {
        await this.validateCertificate(certificate.id);
        validated++;
      } catch (error) {
        this.logger.error(`Failed to validate certificate ${certificate.id}:`, error);
        errors++;
      }
    }

    return { validated, errors };
  }
}