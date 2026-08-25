export type Permission =
  | "read"
  | "write"
  | "delete"
  | "admin"
  | "invite"
  | "billing"
  | "campaigns:read"
  | "campaigns:write"
  | "campaigns:delete"
  | "workflows:read"
  | "workflows:write"
  | "workflows:delete"
  | "templates:read"
  | "templates:write"
  | "templates:delete"
  | "analytics:read"
  | "settings:read"
  | "settings:write"
  | "members:read"
  | "members:write"
  | "members:invite"
  | "members:remove";

export type TenantRole = "owner" | "admin" | "manager" | "member" | "viewer";

export interface RolePermissions {
  role: TenantRole;
  permissions: Permission[];
  description: string;
}

// Default role permissions
export const ROLE_PERMISSIONS: Record<TenantRole, RolePermissions> = {
  owner: {
    role: "owner",
    permissions: [
      "admin",
      "read",
      "write",
      "delete",
      "invite",
      "billing",
      "campaigns:read",
      "campaigns:write",
      "campaigns:delete",
      "workflows:read",
      "workflows:write",
      "workflows:delete",
      "templates:read",
      "templates:write",
      "templates:delete",
      "analytics:read",
      "settings:read",
      "settings:write",
      "members:read",
      "members:write",
      "members:invite",
      "members:remove",
    ],
    description: "Full access to all features and settings",
  },
  admin: {
    role: "admin",
    permissions: [
      "read",
      "write",
      "delete",
      "invite",
      "campaigns:read",
      "campaigns:write",
      "campaigns:delete",
      "workflows:read",
      "workflows:write",
      "workflows:delete",
      "templates:read",
      "templates:write",
      "templates:delete",
      "analytics:read",
      "settings:read",
      "settings:write",
      "members:read",
      "members:write",
      "members:invite",
      "members:remove",
    ],
    description: "Full access except billing and tenant management",
  },
  manager: {
    role: "manager",
    permissions: [
      "read",
      "write",
      "campaigns:read",
      "campaigns:write",
      "workflows:read",
      "workflows:write",
      "templates:read",
      "templates:write",
      "analytics:read",
      "settings:read",
      "members:read",
      "members:invite",
    ],
    description: "Can manage campaigns, workflows, and templates",
  },
  member: {
    role: "member",
    permissions: [
      "read",
      "write",
      "campaigns:read",
      "campaigns:write",
      "workflows:read",
      "workflows:write",
      "templates:read",
      "templates:write",
      "analytics:read",
    ],
    description: "Can create and edit content but not manage settings",
  },
  viewer: {
    role: "viewer",
    permissions: ["read", "campaigns:read", "workflows:read", "templates:read", "analytics:read"],
    description: "Read-only access to all content",
  },
};

export interface PermissionCheck {
  hasPermission: boolean;
  reason?: string;
}

export interface AuditLogEntry {
  id: string;
  tenantId: string;
  userId: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
  timestamp: string;
  ipAddress?: string;
  userAgent?: string;
}
