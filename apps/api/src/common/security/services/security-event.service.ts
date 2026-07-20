import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SecurityEventEntity,
  SecurityEventSeverity,
  SecurityEventType,
} from '../entities/security-event.entity';

export interface CreateSecurityEventDto {
  tenantId?: string;
  userId?: string;
  eventType: SecurityEventType;
  severity?: SecurityEventSeverity;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  resourceType?: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  requestDetails?: {
    method?: string;
    url?: string;
    headers?: Record<string, string>;
    body?: any;
  };
}

export interface SecurityEventQuery {
  tenantId?: string;
  userId?: string;
  eventType?: SecurityEventType;
  severity?: SecurityEventSeverity;
  startDate?: Date;
  endDate?: Date;
  resolved?: boolean;
  limit?: number;
  offset?: number;
}

export interface SecurityEventStats {
  totalEvents: number;
  eventsBySeverity: Record<SecurityEventSeverity, number>;
  eventsByType: Record<SecurityEventType, number>;
  recentEvents: SecurityEventEntity[];
  unresolvedEvents: number;
  eventsOverTime: Array<{
    date: string;
    count: number;
    severity: SecurityEventSeverity;
  }>;
}

@Injectable()
export class SecurityEventService {
  private readonly logger = new Logger(SecurityEventService.name);

  constructor(
    @InjectRepository(SecurityEventEntity)
    private readonly securityEventRepository: Repository<SecurityEventEntity>,
  ) {}

  /**
   * Log a security event
   */
  async logEvent(
    eventData: CreateSecurityEventDto,
  ): Promise<SecurityEventEntity> {
    try {
      const securityEvent = this.securityEventRepository.create({
        ...eventData,
        severity:
          eventData.severity || this.determineSeverity(eventData.eventType),
      });

      const savedEvent = await this.securityEventRepository.save(securityEvent);

      // Log high severity events immediately
      if (
        savedEvent.severity === SecurityEventSeverity.HIGH ||
        savedEvent.severity === SecurityEventSeverity.CRITICAL
      ) {
        this.logger.warn(
          `${savedEvent.severity.toUpperCase()} security event: ${savedEvent.eventType} - ${savedEvent.description}`,
          {
            eventId: savedEvent.id,
            tenantId: savedEvent.tenantId,
            userId: savedEvent.userId,
            ipAddress: savedEvent.ipAddress,
          },
        );
      }

      return savedEvent;
    } catch (error) {
      this.logger.error(
        `Failed to log security event: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  /**
   * Log login success
   */
  async logLoginSuccess(
    userId: string,
    tenantId: string,
    ipAddress?: string,
    userAgent?: string,
    sessionId?: string,
  ): Promise<void> {
    await this.logEvent({
      userId,
      tenantId,
      eventType: SecurityEventType.LOGIN_SUCCESS,
      severity: SecurityEventSeverity.LOW,
      description: 'User logged in successfully',
      ipAddress,
      userAgent,
      sessionId,
    });
  }

  /**
   * Log login failure
   */
  async logLoginFailure(
    email: string,
    tenantId?: string,
    reason?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logEvent({
      tenantId,
      eventType: SecurityEventType.LOGIN_FAILURE,
      severity: SecurityEventSeverity.MEDIUM,
      description: `Login failed for ${email}${reason ? `: ${reason}` : ''}`,
      ipAddress,
      userAgent,
      metadata: { email, reason },
    });
  }

  /**
   * Log unauthorized access attempt
   */
  async logUnauthorizedAccess(
    resourceType: string,
    resourceId: string,
    userId?: string,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string,
    requestDetails?: any,
  ): Promise<void> {
    await this.logEvent({
      userId,
      tenantId,
      eventType: SecurityEventType.UNAUTHORIZED_ACCESS,
      severity: SecurityEventSeverity.HIGH,
      description: `Unauthorized access attempt to ${resourceType}:${resourceId}`,
      ipAddress,
      userAgent,
      resourceType,
      resourceId,
      requestDetails,
    });
  }

  /**
   * Log permission denied
   */
  async logPermissionDenied(
    userId: string,
    tenantId: string,
    action: string,
    resourceType: string,
    resourceId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logEvent({
      userId,
      tenantId,
      eventType: SecurityEventType.PERMISSION_DENIED,
      severity: SecurityEventSeverity.MEDIUM,
      description: `Permission denied for action '${action}' on ${resourceType}:${resourceId}`,
      ipAddress,
      userAgent,
      resourceType,
      resourceId,
      metadata: { action },
    });
  }

  /**
   * Log suspicious activity
   */
  async logSuspiciousActivity(
    description: string,
    userId?: string,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string,
    metadata?: Record<string, any>,
  ): Promise<void> {
    await this.logEvent({
      userId,
      tenantId,
      eventType: SecurityEventType.SUSPICIOUS_ACTIVITY,
      severity: SecurityEventSeverity.HIGH,
      description,
      ipAddress,
      userAgent,
      metadata,
    });
  }

  /**
   * Log rate limit exceeded
   */
  async logRateLimitExceeded(
    identifier: string,
    limit: number,
    window: number,
    ipAddress?: string,
    userAgent?: string,
    tenantId?: string,
  ): Promise<void> {
    await this.logEvent({
      tenantId,
      eventType: SecurityEventType.RATE_LIMIT_EXCEEDED,
      severity: SecurityEventSeverity.MEDIUM,
      description: `Rate limit exceeded: ${limit} requests in ${window}s for ${identifier}`,
      ipAddress,
      userAgent,
      metadata: { identifier, limit, window },
    });
  }

  /**
   * Log account locked
   */
  async logAccountLocked(
    userId: string,
    tenantId: string,
    reason: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    await this.logEvent({
      userId,
      tenantId,
      eventType: SecurityEventType.ACCOUNT_LOCKED,
      severity: SecurityEventSeverity.HIGH,
      description: `Account locked: ${reason}`,
      ipAddress,
      userAgent,
      metadata: { reason },
    });
  }

  /**
   * Log encryption/decryption events
   */
  async logEncryptionEvent(
    action: 'encrypt' | 'decrypt',
    resourceType: string,
    resourceId: string,
    userId?: string,
    tenantId?: string,
    success: boolean = true,
    error?: string,
  ): Promise<void> {
    const eventType =
      action === 'encrypt'
        ? SecurityEventType.DATA_ENCRYPTION
        : SecurityEventType.DATA_DECRYPTION;

    await this.logEvent({
      userId,
      tenantId,
      eventType,
      severity: success
        ? SecurityEventSeverity.LOW
        : SecurityEventSeverity.MEDIUM,
      description: `Data ${action}ion ${success ? 'successful' : 'failed'} for ${resourceType}:${resourceId}`,
      resourceType,
      resourceId,
      metadata: { action, success, error },
    });
  }

  /**
   * Log API key events
   */
  async logApiKeyEvent(
    action: 'created' | 'used' | 'revoked',
    apiKeyId: string,
    userId?: string,
    tenantId?: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<void> {
    const eventTypeMap = {
      created: SecurityEventType.API_KEY_CREATED,
      used: SecurityEventType.API_KEY_USED,
      revoked: SecurityEventType.API_KEY_REVOKED,
    };

    const severityMap = {
      created: SecurityEventSeverity.LOW,
      used: SecurityEventSeverity.LOW,
      revoked: SecurityEventSeverity.MEDIUM,
    };

    await this.logEvent({
      userId,
      tenantId,
      eventType: eventTypeMap[action],
      severity: severityMap[action],
      description: `API key ${action}: ${apiKeyId}`,
      ipAddress,
      userAgent,
      resourceType: 'api_key',
      resourceId: apiKeyId,
    });
  }

  /**
   * Get security events with filtering
   */
  async getSecurityEvents(query: SecurityEventQuery): Promise<{
    events: SecurityEventEntity[];
    total: number;
    page: number;
    limit: number;
  }> {
    const queryBuilder =
      this.securityEventRepository.createQueryBuilder('event');

    // Apply filters
    if (query.tenantId) {
      queryBuilder.andWhere('event.tenantId = :tenantId', {
        tenantId: query.tenantId,
      });
    }

    if (query.userId) {
      queryBuilder.andWhere('event.userId = :userId', { userId: query.userId });
    }

    if (query.eventType) {
      queryBuilder.andWhere('event.eventType = :eventType', {
        eventType: query.eventType,
      });
    }

    if (query.severity) {
      queryBuilder.andWhere('event.severity = :severity', {
        severity: query.severity,
      });
    }

    if (query.startDate) {
      queryBuilder.andWhere('event.createdAt >= :startDate', {
        startDate: query.startDate,
      });
    }

    if (query.endDate) {
      queryBuilder.andWhere('event.createdAt <= :endDate', {
        endDate: query.endDate,
      });
    }

    if (query.resolved !== undefined) {
      queryBuilder.andWhere('event.resolved = :resolved', {
        resolved: query.resolved,
      });
    }

    // Count total
    const total = await queryBuilder.getCount();

    // Apply pagination and ordering
    const limit = query.limit || 50;
    const offset = query.offset || 0;
    const page = Math.floor(offset / limit) + 1;

    queryBuilder.orderBy('event.createdAt', 'DESC').skip(offset).take(limit);

    const events = await queryBuilder.getMany();

    return {
      events,
      total,
      page,
      limit,
    };
  }

  /**
   * Get security event statistics
   */
  async getSecurityEventStats(
    tenantId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<SecurityEventStats> {
    const queryBuilder =
      this.securityEventRepository.createQueryBuilder('event');

    if (tenantId) {
      queryBuilder.andWhere('event.tenantId = :tenantId', { tenantId });
    }

    if (startDate) {
      queryBuilder.andWhere('event.createdAt >= :startDate', { startDate });
    }

    if (endDate) {
      queryBuilder.andWhere('event.createdAt <= :endDate', { endDate });
    }

    const events = await queryBuilder.getMany();

    // Calculate statistics
    const totalEvents = events.length;

    const eventsBySeverity = events.reduce(
      (acc, event) => {
        acc[event.severity] = (acc[event.severity] || 0) + 1;
        return acc;
      },
      {} as Record<SecurityEventSeverity, number>,
    );

    const eventsByType = events.reduce(
      (acc, event) => {
        acc[event.eventType] = (acc[event.eventType] || 0) + 1;
        return acc;
      },
      {} as Record<SecurityEventType, number>,
    );

    // Get recent events (last 10)
    const recentEvents = events
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 10);

    // Count unresolved events
    const unresolvedEvents = events.filter((event) => !event.resolved).length;

    // Events over time (daily)
    const eventsOverTime = events.reduce(
      (acc, event) => {
        const date = event.createdAt.toISOString().split('T')[0];
        const existing = acc.find(
          (item) => item.date === date && item.severity === event.severity,
        );

        if (existing) {
          existing.count++;
        } else {
          acc.push({ date, count: 1, severity: event.severity });
        }

        return acc;
      },
      [] as Array<{
        date: string;
        count: number;
        severity: SecurityEventSeverity;
      }>,
    );

    eventsOverTime.sort((a, b) => a.date.localeCompare(b.date));

    return {
      totalEvents,
      eventsBySeverity,
      eventsByType,
      recentEvents,
      unresolvedEvents,
      eventsOverTime,
    };
  }

  /**
   * Resolve security event
   */
  async resolveEvent(
    eventId: string,
    resolvedBy: string,
    resolution: string,
  ): Promise<SecurityEventEntity> {
    const event = await this.securityEventRepository.findOne({
      where: { id: eventId },
    });

    if (!event) {
      throw new Error(`Security event with ID ${eventId} not found`);
    }

    event.resolved = true;
    event.resolvedBy = resolvedBy;
    event.resolvedAt = new Date();
    event.resolution = resolution;

    return this.securityEventRepository.save(event);
  }

  /**
   * Get unresolved high-severity events
   */
  async getUnresolvedHighSeverityEvents(
    tenantId?: string,
  ): Promise<SecurityEventEntity[]> {
    const queryBuilder =
      this.securityEventRepository.createQueryBuilder('event');

    queryBuilder
      .where('event.resolved = :resolved', { resolved: false })
      .andWhere('event.severity IN (:...severities)', {
        severities: [
          SecurityEventSeverity.HIGH,
          SecurityEventSeverity.CRITICAL,
        ],
      });

    if (tenantId) {
      queryBuilder.andWhere('event.tenantId = :tenantId', { tenantId });
    }

    queryBuilder.orderBy('event.createdAt', 'DESC');

    return queryBuilder.getMany();
  }

  /**
   * Clean up old security events
   */
  async cleanupOldEvents(retentionDays: number = 90): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.securityEventRepository
      .createQueryBuilder()
      .delete()
      .where('createdAt < :cutoffDate', { cutoffDate })
      .andWhere('resolved = :resolved', { resolved: true })
      .execute();

    this.logger.log(`Cleaned up ${result.affected} old security events`);
    return result.affected || 0;
  }

  /**
   * Private helper methods
   */

  private determineSeverity(
    eventType: SecurityEventType,
  ): SecurityEventSeverity {
    const severityMap: Record<SecurityEventType, SecurityEventSeverity> = {
      [SecurityEventType.LOGIN_SUCCESS]: SecurityEventSeverity.LOW,
      [SecurityEventType.LOGIN_FAILURE]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.LOGOUT]: SecurityEventSeverity.LOW,
      [SecurityEventType.PASSWORD_CHANGE]: SecurityEventSeverity.LOW,
      [SecurityEventType.PASSWORD_RESET_REQUEST]: SecurityEventSeverity.LOW,
      [SecurityEventType.PASSWORD_RESET_SUCCESS]: SecurityEventSeverity.LOW,
      [SecurityEventType.API_KEY_CREATED]: SecurityEventSeverity.LOW,
      [SecurityEventType.API_KEY_REVOKED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.API_KEY_USED]: SecurityEventSeverity.LOW,
      [SecurityEventType.UNAUTHORIZED_ACCESS]: SecurityEventSeverity.HIGH,
      [SecurityEventType.PERMISSION_DENIED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.ACCOUNT_LOCKED]: SecurityEventSeverity.HIGH,
      [SecurityEventType.ACCOUNT_UNLOCKED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.SUSPICIOUS_ACTIVITY]: SecurityEventSeverity.HIGH,
      [SecurityEventType.DATA_ENCRYPTION]: SecurityEventSeverity.LOW,
      [SecurityEventType.DATA_DECRYPTION]: SecurityEventSeverity.LOW,
      [SecurityEventType.ENCRYPTION_KEY_ROTATION]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.SESSION_CREATED]: SecurityEventSeverity.LOW,
      [SecurityEventType.SESSION_EXPIRED]: SecurityEventSeverity.LOW,
      [SecurityEventType.SESSION_INVALIDATED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.RATE_LIMIT_EXCEEDED]: SecurityEventSeverity.MEDIUM,
      [SecurityEventType.IP_BLOCKED]: SecurityEventSeverity.HIGH,
      [SecurityEventType.SECURITY_SCAN_DETECTED]:
        SecurityEventSeverity.CRITICAL,
    };

    return severityMap[eventType] || SecurityEventSeverity.MEDIUM;
  }
}
