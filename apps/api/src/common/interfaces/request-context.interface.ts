import { Request } from "express";

/**
 * Authentication context interface
 * Available on req.auth when user is authenticated
 */
export interface AuthContext {
  principalId: string; // The authenticated user's ID
  sessionId?: string;
  tokenType?: "jwt" | "api-key";
  issuedAt?: Date;
  expiresAt?: Date;
}

/**
 * Member context interface
 * Available on req.member when user is acting within a tenant context
 */
export interface MemberContext {
  id: string; // TenantMember ID
  userId: string; // User ID
  tenantId: string; // Tenant ID
  role: string; // Member role in the tenant
  // permissions?: string[]; // Member permissions
}

/**
 * Async context for member (using AsyncLocalStorage)
 * Available through context when using async hooks
 */
export interface AsyncMemberContext {
  id: string; // TenantMember ID
  userId: string;
  tenantId: string;
  role: string;
  permissions?: string[];
  tenant?: {
    id: string;
    name: string;
    status: string;
  };
  user?: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
  };
}

/**
 * Extended Express Request interface
 */
export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
  member?: MemberContext;
  user?: any; // For Passport.js compatibility
}
