import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, In, LessThan } from 'typeorm';
import { AuditLog, AuditAction, AuditResourceType } from '../entities/audit-log.entity';

export interface CreateAuditLogDto {
  tenantId: string;
  tenantMemberId?: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string;
  description: string;
  ipAddress?: string;
  userAgent?: string;
  sessionId?: string;
  oldValues?: Record<string, any>;
  newValues?: Record<string, any>;
  metadata?: Record<string, any>;
  success?: boolean;
  errorMessage?: string;
  duration?: number;
  correlationId?: string;
  requestId?: string;
  requestHeaders?: Record<string, string>;
  responseData?: Record<string, any>;
  apiVersion?: string;
  clientVersion?: string;
  tags?: string[];
  severity?: 'low' | 'medium' | 'high' | 'critical';
  complianceFlags?: string[];
}

export interface AuditLogQuery {
  tenantId?: string;
  tenantMemberId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  success?: boolean;
  startDate?: Date;
  endDate?: Date;
  ipAddress?: string;
  sessionId?: string;
  correlationId?: string;
  tags?: string[];
  severity?: string;
  limit?: number;
  offset?: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private auditLogRepository: Repository<AuditLog>,
  ) {}

  /**
   * Create a new audit log entry
   */
  async createAuditLog(data: CreateAuditLogDto): Promise<AuditLog> {
    try {
      const auditLog = this.auditLogRepository.create({
        tenantId: data.tenantId,
        tenantMemberId: data.tenantMemberId,
        action: data.action,
        resourceType: data.resourceType,
        resourceId: data.resourceId,
        description: data.description,
        ipAddress: data.ipAddress,
        userAgent: data.userAgent,
        sessionId: data.sessionId,
        oldValues: data.oldValues,
        newValues: data.newValues,
        metadata: data.metadata,
        success: data.success ?? true,
        errorMessage: data.errorMessage,
        duration: data.duration ?? 0,
        correlationId: data.correlationId,
        requestId: data.requestId,
        requestHeaders: data.requestHeaders,
        responseData: data.responseData,
        apiVersion: data.apiVersion,
        clientVersion: data.clientVersion,
        tags: data.tags,
        severity: data.severity || 'low',
        complianceFlags: data.complianceFlags,
      });

      return await this.auditLogRepository.save(auditLog);
    } catch (error) {
      this.logger.error('Failed to create audit log', error);
      throw error;
    }
  }

  /**
   * Bulk create audit log entries for better performance
   */
  async createBulkAuditLogs(data: CreateAuditLogDto[]): Promise<void> {
    try {
      const auditLogs = data.map(item =>
        this.auditLogRepository.create({
          tenantId: item.tenantId,
          tenantMemberId: item.tenantMemberId,
          action: item.action,
          resourceType: item.resourceType,
          resourceId: item.resourceId,
          description: item.description,
          ipAddress: item.ipAddress,
          userAgent: item.userAgent,
          sessionId: item.sessionId,
          oldValues: item.oldValues,
          newValues: item.newValues,
          metadata: item.metadata,
          success: item.success ?? true,
          errorMessage: item.errorMessage,
          duration: item.duration ?? 0,
          correlationId: item.correlationId,
          requestId: item.requestId,
          requestHeaders: item.requestHeaders,
          responseData: item.responseData,
          apiVersion: item.apiVersion,
          clientVersion: item.clientVersion,
          tags: item.tags,
          severity: item.severity || 'low',
          complianceFlags: item.complianceFlags,
        }),
      );

      await this.auditLogRepository.save(auditLogs);
    } catch (error) {
      this.logger.error('Failed to create bulk audit logs', error);
      throw error;
    }
  }

  /**
   * Query audit logs with filtering and pagination
   */
  async queryAuditLogs(query: AuditLogQuery): Promise<{
    data: AuditLog[];
    total: number;
    page: number;
    limit: number;
  }> {
    try {
      const limit = query.limit || 50;
      const offset = query.offset || 0;
      const page = Math.floor(offset / limit) + 1;

      const qb = this.auditLogRepository.createQueryBuilder('audit');

      if (query.tenantId) qb.andWhere('audit.tenantId = :tenantId', { tenantId: query.tenantId });
      if (query.tenantMemberId) qb.andWhere('audit.tenantMemberId = :tenantMemberId', { tenantMemberId: query.tenantMemberId });
      if (query.action) qb.andWhere('audit.action = :action', { action: query.action });
      if (query.resourceType) qb.andWhere('audit.resourceType = :resourceType', { resourceType: query.resourceType });
      if (query.resourceId) qb.andWhere('audit.resourceId = :resourceId', { resourceId: query.resourceId });
      if (query.success !== undefined) qb.andWhere('audit.success = :success', { success: query.success });
      if (query.ipAddress) qb.andWhere('audit.ipAddress = :ipAddress', { ipAddress: query.ipAddress });
      if (query.sessionId) qb.andWhere('audit.sessionId = :sessionId', { sessionId: query.sessionId });
      if (query.correlationId) qb.andWhere('audit.correlationId = :correlationId', { correlationId: query.correlationId });
      if (query.severity) qb.andWhere('audit.severity = :severity', { severity: query.severity });

      if (query.tags && query.tags.length > 0) {
        qb.andWhere('audit.tags && :tags', { tags: query.tags });
      }

      if (query.startDate || query.endDate) {
        if (query.startDate && query.endDate) {
          qb.andWhere('audit.createdAt BETWEEN :startDate AND :endDate', {
            startDate: query.startDate,
            endDate: query.endDate,
          });
        } else if (query.startDate) {
          qb.andWhere('audit.createdAt >= :startDate', { startDate: query.startDate });
        } else if (query.endDate) {
          qb.andWhere('audit.createdAt <= :endDate', { endDate: query.endDate });
        }
      }

      const sortField = query.sortBy || 'createdAt';
      const sortOrder = query.sortOrder || 'DESC';
      qb.orderBy(`audit.${sortField}`, sortOrder);

      qb.skip(offset).take(limit);

      const [data, total] = await qb.getManyAndCount();

      return {
        data,
        total,
        page,
        limit,
      };
    } catch (error) {
      this.logger.error('Failed to query audit logs', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific resource
   */
  async getResourceAuditLogs(
    tenantId: string,
    resourceType: AuditResourceType,
    resourceId: string,
    limit = 100,
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository.find({
        where: {
          tenantId,
          resourceType,
          resourceId,
        },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to get resource audit logs', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific tenant member
   */
  async getTenantMemberAuditLogs(
    tenantId: string,
    tenantMemberId: string,
    limit = 100,
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository.find({
        where: {
          tenantId,
          tenantMemberId,
        },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to get tenant member audit logs', error);
      throw error;
    }
  }

  /**
   * Get audit log statistics
   */
  async getAuditLogStats(tenantId: string, startDate?: Date, endDate?: Date): Promise<{
    totalLogs: number;
    successfulActions: number;
    failedActions: number;
    actionBreakdown: Record<string, number>;
    resourceBreakdown: Record<string, number>;
    userBreakdown: Record<string, number>;
  }> {
    try {
      const qb = this.auditLogRepository.createQueryBuilder('audit')
        .where('audit.tenantId = :tenantId', { tenantId });

      if (startDate && endDate) {
        qb.andWhere('audit.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
      }

      const logs = await qb.getMany();

      const totalLogs = logs.length;
      const successfulActions = logs.filter(l => l.success).length;
      const failedActions = logs.filter(l => !l.success).length;

      const actionBreakdown = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const resourceBreakdown = logs.reduce((acc, log) => {
        acc[log.resourceType] = (acc[log.resourceType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const tenantMemberBreakdown = logs
        .filter(l => l.tenantMemberId)
        .reduce((acc, log) => {
          acc[log.tenantMemberId] = (acc[log.tenantMemberId] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

      return {
        totalLogs,
        successfulActions,
        failedActions,
        actionBreakdown,
        resourceBreakdown,
        userBreakdown: tenantMemberBreakdown,
      };
    } catch (error) {
      this.logger.error('Failed to get audit log stats', error);
      throw error;
    }
  }

  /**
   * Delete old audit logs (for compliance/retention)
   */
  async deleteOldAuditLogs(olderThanDate: Date): Promise<number> {
    try {
      const result = await this.auditLogRepository.delete({
        createdAt: LessThan(olderThanDate),
      });

      this.logger.log(`Deleted ${result.affected} old audit logs`);
      return result.affected || 0;
    } catch (error) {
      this.logger.error('Failed to delete old audit logs', error);
      throw error;
    }
  }

  /**
   * Export audit logs in specified format
   */
  async exportAuditLogs(
    query: AuditLogQuery,
    format: 'json' | 'csv' = 'json',
  ): Promise<string> {
    try {
      const result = await this.queryAuditLogs({
        ...query,
        limit: query.limit || 10000,
      });

      if (format === 'csv') {
        const headers = [
          'Timestamp',
          'User ID',
          'Action',
          'Resource Type',
          'Resource ID',
          'Description',
          'Success',
          'IP Address',
          'User Agent',
        ];

        const csvRows = [
          headers.join(','),
          ...result.data.map(log => [
            log.createdAt?.toISOString() || '',
            log.tenantMemberId || '',
            log.action || '',
            log.resourceType || '',
            log.resourceId || '',
            `"${log.description?.replace(/"/g, '""') || ''}"`,
            log.success?.toString() || 'true',
            log.ipAddress || '',
            `"${log.userAgent?.replace(/"/g, '""') || ''}"`,
          ].join(',')),
        ];

        return csvRows.join('\n');
      }

      return JSON.stringify(result, null, 2);
    } catch (error) {
      this.logger.error('Failed to export audit logs', error);
      throw error;
    }
  }

  /**
   * Get tenant member activity summary
   */
  async getTenantMemberActivitySummary(
    tenantId: string,
    tenantMemberId: string,
    days: number = 30,
  ): Promise<{
    totalActions: number;
    successfulActions: number;
    failedActions: number;
    actionBreakdown: Record<string, number>;
    resourceBreakdown: Record<string, number>;
    dailyActivity: Array<{ date: string; count: number }>;
    lastActivity?: Date;
  }> {
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const logs = await this.auditLogRepository.find({
        where: {
          tenantId,
          tenantMemberId,
          createdAt: MoreThanOrEqual(startDate),
        },
        order: { createdAt: 'DESC' },
      });

      const totalActions = logs.length;
      const successfulActions = logs.filter(l => l.success).length;
      const failedActions = logs.filter(l => !l.success).length;

      const actionBreakdown = logs.reduce((acc, log) => {
        acc[log.action] = (acc[log.action] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const resourceBreakdown = logs.reduce((acc, log) => {
        acc[log.resourceType] = (acc[log.resourceType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const dailyActivityMap = logs.reduce((acc, log) => {
        const date = log.createdAt.toISOString().split('T')[0];
        acc[date] = (acc[date] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const dailyActivity = Object.entries(dailyActivityMap)
        .map(([date, count]) => ({ date, count }))
        .toSorted((a, b) => a.date.localeCompare(b.date));

      return {
        totalActions,
        successfulActions,
        failedActions,
        actionBreakdown,
        resourceBreakdown,
        dailyActivity,
        lastActivity: logs[0]?.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to get user activity summary', error);
      throw error;
    }
  }

  /**
   * Get audit logs for a specific user
   */
  async getUserAuditLogs(
    tenantId: string,
    userId: string,
    limit = 100,
  ): Promise<AuditLog[]> {
    try {
      return await this.auditLogRepository.find({
        where: {
          tenantId,
          tenantMemberId: userId,
        },
        order: { createdAt: 'DESC' },
        take: limit,
      });
    } catch (error) {
      this.logger.error('Failed to get user audit logs', error);
      throw error;
    }
  }

  /**
   * Get user activity summary
   */
  async getUserActivitySummary(
    userId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<any> {
    try {
      const qb = this.auditLogRepository.createQueryBuilder('audit')
        .where('audit.tenantMemberId = :userId', { userId });

      if (startDate && endDate) {
        qb.andWhere('audit.createdAt BETWEEN :startDate AND :endDate', { startDate, endDate });
      }

      const logs = await qb.orderBy('audit.createdAt', 'DESC').getMany();

      return {
        totalActions: logs.length,
        successfulActions: logs.filter(l => l.success).length,
        failedActions: logs.filter(l => !l.success).length,
        lastActivity: logs[0]?.createdAt,
      };
    } catch (error) {
      this.logger.error('Failed to get user activity summary', error);
      throw error;
    }
  }
}

import { MoreThanOrEqual } from 'typeorm';
