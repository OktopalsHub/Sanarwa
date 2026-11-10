import { Request } from "express";

export interface AuthContext {
  principalId: string;
  sessionId?: string;
  tokenType?: "jwt" | "api-key";
  issuedAt?: Date;
  expiresAt?: Date;
}

export interface MemberContext {
  id: string;
  userId: string;
  tenantId: string;
  role: string;
}

export interface AsyncMemberContext {
  id: string;
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

export interface AuthenticatedRequest extends Request {
  auth: AuthContext;
  member?: MemberContext;
  user?: any;
}
