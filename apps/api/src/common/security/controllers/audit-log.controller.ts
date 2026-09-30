import {
  Controller,
  Get,
  Query,
  Param,
  UseGuards,
  Request,
  ParseIntPipe,
  DefaultValuePipe,
} from "@nestjs/common";
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from "@nestjs/swagger";
import { AuthGuard } from "../../../modules/auth/guards/jwt-auth.guard";

import { AuditLogService, AuditLogQuery } from "../services/audit-log.service";
import { AuditAction, AuditResourceType } from "../entities/audit-log.entity";
import { Roles } from "src/modules/auth/decorators/roles.decorator";

@ApiTags("Audit Logs")
@Controller("audit-logs")
@UseGuards(AuthGuard)
export class AuditLogController {
  constructor(private readonly auditLogService: AuditLogService) {}

  @Get()
  @Roles("admin", "audit_viewer")
  @ApiOperation({ summary: "Get audit logs with filtering and pagination" })
  @ApiQuery({ name: "page", required: false, type: Number })
  @ApiQuery({ name: "limit", required: false, type: Number })
  @ApiQuery({ name: "action", required: false, type: String })
  @ApiQuery({ name: "resourceType", required: false, type: String })
  @ApiQuery({ name: "resourceId", required: false, type: String })
  @ApiQuery({ name: "userId", required: false, type: String })
  @ApiQuery({ name: "success", required: false, type: Boolean })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiQuery({ name: "sortBy", required: false, type: String })
  @ApiQuery({ name: "sortOrder", required: false, enum: ["ASC", "DESC"] })
  @ApiResponse({ status: 200, description: "Audit logs retrieved successfully" })
  async getAuditLogs(
    @Request() req: any,
    @Query("page", new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query("limit", new DefaultValuePipe(50), ParseIntPipe) limit: number,
    @Query("action") action?: string,
    @Query("resourceType") resourceType?: string,
    @Query("resourceId") resourceId?: string,
    @Query("userId") userId?: string,
    @Query("success") success?: boolean,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
    @Query("sortBy") sortBy?: string,
    @Query("sortOrder") sortOrder?: "ASC" | "DESC",
  ) {
    const query: AuditLogQuery = {
      tenantId: req.user.tenantId,
      action: action as AuditAction,
      resourceType: resourceType as AuditResourceType,
      resourceId,
      tenantMemberId: userId,
      success,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      limit,
      offset: (page - 1) * limit,
      sortBy,
      sortOrder,
    };

    return await this.auditLogService.queryAuditLogs(query);
  }

  @Get("resource/:resourceType/:resourceId")
  @Roles("admin", "audit_viewer")
  @ApiOperation({ summary: "Get audit logs for a specific resource" })
  @ApiResponse({ status: 200, description: "Resource audit logs retrieved successfully" })
  async getResourceAuditLogs(
    @Request() req: any,
    @Param("resourceType") resourceType: AuditResourceType,
    @Param("resourceId") resourceId: string,
    @Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    return await this.auditLogService.getResourceAuditLogs(
      req.user.tenantId,
      resourceType,
      resourceId,
      limit,
    );
  }

  @Get("user/:userId")
  @Roles("admin", "audit_viewer")
  @ApiOperation({ summary: "Get audit logs for a specific user" })
  @ApiResponse({ status: 200, description: "User audit logs retrieved successfully" })
  async getUserAuditLogs(
    @Request() req: any,
    @Param("userId") userId: string,
    @Query("limit", new DefaultValuePipe(100), ParseIntPipe) limit: number,
  ) {
    return await this.auditLogService.getUserAuditLogs(req.user.tenantId, userId, limit);
  }

  @Get("stats")
  @Roles("admin", "audit_viewer")
  @ApiOperation({ summary: "Get audit log statistics" })
  @ApiQuery({ name: "startDate", required: false, type: String })
  @ApiQuery({ name: "endDate", required: false, type: String })
  @ApiResponse({ status: 200, description: "Audit log statistics retrieved successfully" })
  async getAuditLogStats(
    @Request() req: any,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return await this.auditLogService.getAuditLogStats(
      req.user.tenantId,
      startDate ? new Date(startDate) : undefined,
      endDate ? new Date(endDate) : undefined,
    );
  }
}
