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
import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from "class-validator";
import { RequireRoles } from "../../../modules/auth/decorators/roles.decorator";
import { AuthGuard } from "../../../modules/auth/guards/jwt-auth.guard";
import { AuditLog } from "../decorators/audit-log.decorator";
import { requireTenantId } from "../require-tenant-id";
import { AuditLogService } from "../services/audit-log.service";
import { AuditAction, AuditResourceType } from "../entities/audit-log.entity";

export class AuditLogQueryDto {
  @IsUUID()
  tenantId!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10000)
  limit: number = 50;

  @IsOptional()
  @IsString()
  action?: AuditAction;

  @IsOptional()
  @IsString()
  resourceType?: AuditResourceType;

  @IsOptional()
  @IsString()
  resourceId?: string;

  @IsOptional()
  @IsString()
  tenantMemberId?: string;

  @IsOptional()
  @IsDateString()
  startDate?: string;

  @IsOptional()
  @IsDateString()
  endDate?: string;

  @IsOptional()
  @Transform(({ value }) => value === true || value === "true")
  @IsBoolean()
  success?: boolean;

  @IsOptional()
  @IsIn(["json", "csv"])
  format?: "json" | "csv";
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
  async getAuditLogs(@Query() query: AuditLogQueryDto) {
    return this.auditLogService.queryAuditLogs({
      ...query,
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
  async exportAuditLogs(@Query() query: AuditLogQueryDto, @Res() res: Response) {
    const format = query.format ?? "json";
    const exportData = await this.auditLogService.exportAuditLogs(
      {
        ...query,
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
    @Query("tenantId") tenantId: string,
    @Query("startDate") startDate?: string,
    @Query("endDate") endDate?: string,
  ) {
    return this.auditLogService.getAuditLogStats(
      requireTenantId(tenantId),
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
    @Query("tenantId") tenantId: string,
  ) {
    return this.auditLogService.getResourceAuditLogs(
      requireTenantId(tenantId),
      resourceType,
      resourceId,
    );
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
    @Query("tenantId") tenantId: string,
  ) {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    return this.auditLogService.getUserActivitySummary(
      requireTenantId(tenantId),
      userId,
      startDate,
      endDate,
    );
  }
}
