import {
  Controller,
  Get,
  Param,
  Query,
  Res,
  UseGuards,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { Response } from "express";
import { CurrentUser } from "../../../modules/auth/decorators/current-user.decorator";
import { RequireRoles } from "../../../modules/auth/decorators/roles.decorator";
import { AuthGuard } from "../../../modules/auth/guards/jwt-auth.guard";
// import { RolesGuard } from '../../../modules/auth/guards/roles.guard';
import { AuditLog } from "../decorators/audit-log.decorator";
import { AuditLogService } from "../services/audit-log.service";
import { AuditAction, AuditResourceType } from "../entities/audit-log.entity";

export class AuditLogQueryDto {
  page: number = 1;
  limit: number = 50;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  tenantMemberId?: string;
  startDate?: string;
  endDate?: string;
  success?: boolean;
}

@ApiTags("Audit")
@Controller("audit")
@UseGuards(AuthGuard)
export class AuditController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get("logs")
  @RequireRoles("admin", "audit_viewer")
  @ApiOperation({ summary: "Get audit logs" })
  @ApiResponse({
    status: 200,
    description: "Audit logs retrieved successfully",
  })
  @AuditLog({
    action: "READ" as AuditAction,
    resourceType: "ANALYTICS" as AuditResourceType,
    description: "Retrieved audit logs",
  })
  async getAuditLogs(@Query() query: AuditLogQueryDto, @CurrentUser() user: any) {
    return this.auditLogService.queryAuditLogs({
      ...query,
      tenantId: user.tenantId,
      offset: (query.page - 1) * query.limit,
      startDate: query.startDate ? new Date(query.startDate) : undefined,
      endDate: query.endDate ? new Date(query.endDate) : undefined,
    });
  }

  @Get("logs/export")
  @RequireRoles("admin", "audit_viewer")
  @ApiOperation({ summary: "Export audit logs" })
  @ApiResponse({ status: 200, description: "Audit logs exported successfully" })
  @AuditLog({
    action: "EXPORT" as AuditAction,
    resourceType: "ANALYTICS" as AuditResourceType,
    description: "Exported audit logs",
  })
  async exportAuditLogs(
    @Query() query: AuditLogQueryDto,
    @Query("format") format: "json" | "csv" = "json",
    @CurrentUser() user: any,
    @Res() res: Response,
  ) {
    const exportData = await this.auditLogService.exportAuditLogs(
      {
        ...query,
        tenantId: user.tenantId,
        startDate: query.startDate ? new Date(query.startDate) : undefined,
        endDate: query.endDate ? new Date(query.endDate) : undefined,
      },
      format,
    );

    const filename = `audit-logs-${new Date().toISOString().split("T")[0]}.${format}`;

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    } else {
      res.setHeader("Content-Type", "application/json");
      res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    }

    res.send(exportData);
  }

  @Get("logs/stats")
  @RequireRoles("admin", "audit_viewer")
  @ApiOperation({ summary: "Get audit log statistics" })
  @ApiResponse({
    status: 200,
    description: "Audit log statistics retrieved successfully",
  })
  async getAuditLogStats(
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @CurrentUser() user?: any,
  ) {
    return this.auditLogService.getAuditLogStats(
      user.tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }

  @Get("trail/:resourceType/:resourceId")
  @RequireRoles("admin", "audit_viewer")
  @ApiOperation({ summary: "Get audit trail for resource" })
  @ApiResponse({
    status: 200,
    description: "Audit trail retrieved successfully",
  })
  @AuditLog({
    action: "READ" as AuditAction,
    resourceType: "ANALYTICS" as AuditResourceType,
    description: "Retrieved audit trail for resource",
  })
  async getResourceAuditTrail(
    @Param("resourceType") resourceType: AuditResourceType,
    @Param("resourceId") resourceId: string,
    @CurrentUser() user: any,
  ) {
    return this.auditLogService.getResourceAuditLogs(user.tenantId, resourceType, resourceId);
  }

  @Get("users/:userId/activity")
  @RequireRoles("admin", "audit_viewer")
  @ApiOperation({ summary: "Get user activity summary" })
  @ApiResponse({
    status: 200,
    description: "User activity summary retrieved successfully",
  })
  async getUserActivitySummary(
    @Param("userId") userId: string,
    @Query("days", new DefaultValuePipe(30), ParseIntPipe) days: number,
    @CurrentUser() user: any,
  ) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.auditLogService.getUserActivitySummary(userId, startDate, endDate);
  }
}
