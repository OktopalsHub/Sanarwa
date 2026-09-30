import { Get, Param, Query, Controller, UseGuards } from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { CurrentTenantId } from "src/common/decorators";
import { TenantContextGuard } from "src/common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { AuditLogService } from "./audit-log.service";
import { AuditExportDto, AuditQueryDto } from "./dto/audit-query.dto";

@ApiTags("Analytics")
@ApiBearerAuth()
@Controller("analytics")
@UseGuards(AuthGuard, TenantContextGuard)
export class AnalyticsAuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  /**
   * Get audit logs
   */
  /**
   * Get audit logs
   */
  @Get("audit-logs")
  @ApiOperation({ summary: "Get audit logs" })
  @ApiResponse({ status: 200, description: "Audit logs retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getAuditLogs(@CurrentTenantId() tenantId: string, @Query() query: AuditQueryDto) {
    const auditQuery = {
      tenantId,
      eventType: query.eventType,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      userId: query.userId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    };

    return this.auditLogService.getAuditLogs(auditQuery);
  }

  /**
   * Get audit trail for a notification
   */
  /**
   * Get audit trail for a notification
   */
  @Get("audit-logs/notification/:notificationId")
  @ApiOperation({ summary: "Get notification audit trail" })
  @ApiParam({ name: "notificationId", description: "Notification ID" })
  @ApiResponse({ status: 200, description: "Audit trail retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Notification not found" })
  async getNotificationAuditTrail(
    @Param("notificationId") notificationId: string,
    @CurrentTenantId() tenantId: string,
  ) {
    return this.auditLogService.getNotificationAuditTrail(notificationId, tenantId);
  }

  /**
   * Get audit statistics
   */
  /**
   * Get audit statistics
   */
  @Get("audit-logs/statistics")
  @ApiOperation({ summary: "Get audit statistics" })
  @ApiResponse({ status: 200, description: "Audit statistics retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getAuditStatistics(
    @CurrentTenantId() tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.auditLogService.getAuditStatistics(
      tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  /**
   * Export audit logs
   */
  /**
   * Export audit logs
   */
  @Get("audit-logs/export")
  @ApiOperation({ summary: "Export audit logs" })
  @ApiResponse({ status: 200, description: "Audit logs exported successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async exportAuditLogs(@CurrentTenantId() tenantId: string, @Query() query: AuditExportDto) {
    const auditQuery = {
      tenantId,
      eventType: query.eventType,
      resourceType: query.resourceType,
      resourceId: query.resourceId,
      userId: query.userId,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
      limit: query.limit,
      offset: query.offset,
    };

    const exportData = await this.auditLogService.exportAuditLogs(auditQuery, query.format);

    return {
      format: query.format,
      data: exportData,
      exportedAt: new Date().toISOString(),
    };
  }
}
