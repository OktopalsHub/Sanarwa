import { SetMetadata } from "@nestjs/common";
import { AuditAction, AuditResourceType } from "../entities/audit-log.entity";

export interface AuditLogOptions {
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceIdParam?: string; // Parameter name to extract resource ID from
  description?: string;
  includeRequestBody?: boolean;
  includeResponseBody?: boolean;
}

export const AUDIT_LOG_KEY = "audit_log";

export const AuditLog = (options: AuditLogOptions) => SetMetadata(AUDIT_LOG_KEY, options);
