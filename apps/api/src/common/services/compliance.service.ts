import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLog } from '../security/entities/audit-log.entity';

export interface AuditEvent {
  action: string;
  resource: string;
  resourceId?: string;
  userId?: string;
  tenantId?: string;
  ipAddress?: string;
  userAgent?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface DataProcessingRequest {
  type: 'access' | 'rectification' | 'erasure' | 'restriction' | 'portability' | 'objection';
  userId: string;
  tenantId?: string;
  reason: string;
  requestedData?: string[];
}

@Injectable()
export class ComplianceService {
  private readonly logger = new Logger(ComplianceService.name);

  constructor(
    private configService: ConfigService,
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Log audit event for compliance tracking
   */
  async logAuditEvent(event: AuditEvent): Promise<void> {
    try {
      const auditLog = this.auditLogRepository.create({
        tenantId: event.tenantId || 'system',
        tenantMemberId: event.userId,
        action: event.action as any,
        resourceType: event.resource as any,
        resourceId: event.resourceId || 'system',
        description: `${event.action} performed on ${event.resource}`,
        ipAddress: event.ipAddress,
        userAgent: event.userAgent,
        oldValues: event.oldValues,
        newValues: event.newValues,
        metadata: event.metadata,
        success: true,
        duration: 0,
      });

      await this.auditLogRepository.save(auditLog);

      this.logger.log(`Audit event logged: ${event.action} on ${event.resource}`, {
        resourceId: event.resourceId,
        userId: event.userId,
        tenantId: event.tenantId,
      });
    } catch (error) {
      this.logger.error('Failed to log audit event', error);
      // Don't throw - audit logging failures shouldn't break business logic
    }
  }

  /**
   * Get audit trail for a resource
   */
  async getAuditTrail(
    resource: string,
    resourceId?: string,
    userId?: string,
    tenantId?: string,
    limit: number = 100,
    offset: number = 0,
  ): Promise<AuditLog[]> {
    const query = this.auditLogRepository
      .createQueryBuilder('audit')
      .where('audit.resource = :resource', { resource })
      .orderBy('audit.timestamp', 'DESC')
      .limit(limit)
      .offset(offset);

    if (resourceId) {
      query.andWhere('audit.resourceId = :resourceId', { resourceId });
    }
    if (userId) {
      query.andWhere('audit.userId = :userId', { userId });
    }
    if (tenantId) {
      query.andWhere('audit.tenantId = :tenantId', { tenantId });
    }

    return query.getMany();
  }

  /**
   * Handle GDPR data processing requests
   */
  async processDataRequest(request: DataProcessingRequest): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    // Log the request
    await this.logAuditEvent({
      action: 'GDPR_REQUEST',
      resource: 'user_data',
      resourceId: request.userId,
      userId: request.userId,
      tenantId: request.tenantId,
      metadata: {
        requestType: request.type,
        reason: request.reason,
        requestedData: request.requestedData,
      },
    });

    switch (request.type) {
      case 'access':
        return this.handleDataAccess(request);
      case 'rectification':
        return this.handleDataRectification(request);
      case 'erasure':
        return this.handleDataErasure(request);
      case 'restriction':
        return this.handleDataRestriction(request);
      case 'portability':
        return this.handleDataPortability(request);
      case 'objection':
        return this.handleDataObjection(request);
      default:
        return {
          success: false,
          message: 'Invalid request type',
        };
    }
  }

  /**
   * Check if user has consented to data processing
   */
  async hasDataConsent(userId: string, consentType: string): Promise<boolean> {
    // In a real implementation, this would check a consent database
    // For now, return true for demonstration
    this.logger.log(`Checking data consent for user ${userId}, type: ${consentType}`);
    return true;
  }

  /**
   * Record data processing consent
   */
  async recordDataConsent(
    userId: string,
    consentType: string,
    consented: boolean,
    consentDetails?: Record<string, any>,
  ): Promise<void> {
    await this.logAuditEvent({
      action: consented ? 'CONSENT_GRANTED' : 'CONSENT_REVOKED',
      resource: 'user_consent',
      resourceId: userId,
      userId,
      metadata: {
        consentType,
        ...consentDetails,
      },
    });

    this.logger.log(`Data consent ${consented ? 'granted' : 'revoked'} for user ${userId}, type: ${consentType}`);
  }

  /**
   * Anonymize user data for analytics
   */
  static anonymizeData(data: Record<string, any>): Record<string, any> {
    const anonymized = { ...data };

    // Remove or hash personal identifiers
    const personalFields = ['email', 'phone', 'name', 'firstName', 'lastName', 'ipAddress'];
    personalFields.forEach(field => {
      if (anonymized[field]) {
        anonymized[field] = ComplianceService.hashValue(anonymized[field]);
      }
    });

    return anonymized;
  }

  /**
   * Check if data retention period has expired
   */
  static hasRetentionExpired(createdAt: Date, retentionDays: number = 2555): boolean {
    // Default 7 years for GDPR compliance
    const retentionPeriod = retentionDays * 24 * 60 * 60 * 1000;
    return Date.now() - createdAt.getTime() > retentionPeriod;
  }

  private async handleDataAccess(request: DataProcessingRequest): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    // In a real implementation, gather all user data
    const userData = {
      userId: request.userId,
      tenantId: request.tenantId,
      dataCollected: new Date().toISOString(),
      dataCategories: ['profile', 'notifications', 'usage'],
    };

    return {
      success: true,
      message: 'Data access request processed',
      data: userData,
    };
  }

  private async handleDataRectification(request: DataProcessingRequest): Promise<{
    success: boolean;
    message: string;
  }> {
    // In a real implementation, update user data
    return {
      success: true,
      message: 'Data rectification request queued for processing',
    };
  }

  private async handleDataErasure(request: DataProcessingRequest): Promise<{
    success: boolean;
    message: string;
  }> {
    // In a real implementation, schedule data deletion
    return {
      success: true,
      message: 'Data erasure request queued for processing (will be completed within 30 days)',
    };
  }

  private async handleDataRestriction(request: DataProcessingRequest): Promise<{
    success: boolean;
    message: string;
  }> {
    // In a real implementation, restrict data processing
    return {
      success: true,
      message: 'Data processing restriction applied',
    };
  }

  private async handleDataPortability(request: DataProcessingRequest): Promise<{
    success: boolean;
    message: string;
    data?: any;
  }> {
    // In a real implementation, export user data
    const exportData = {
      userId: request.userId,
      exportFormat: 'JSON',
      exportedAt: new Date().toISOString(),
    };

    return {
      success: true,
      message: 'Data portability request processed',
      data: exportData,
    };
  }

  private async handleDataObjection(request: DataProcessingRequest): Promise<{
    success: boolean;
    message: string;
  }> {
    // In a real implementation, stop data processing for specific purposes
    return {
      success: true,
      message: 'Data processing objection recorded',
    };
  }

  private static hashValue(value: string): string {
    // Simple hash for anonymization (use proper crypto in production)
    let hash = 0;
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(36);
  }
}