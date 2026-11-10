import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

export interface SessionData {
  sessionId: string;
  userId: string;
  tenantId: string;
  ipAddress: string;
  userAgent: string;
  createdAt: Date;
  lastAccessedAt: Date;
  expiresAt: Date;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface SessionValidationResult {
  isValid: boolean;
  session?: SessionData;
  reason?: string;
}

@Injectable()
export class SessionSecurityService {
  private readonly logger = new Logger(SessionSecurityService.name);
  private readonly sessions: Map<string, SessionData> = new Map();
  private readonly sessionTimeout: number;
  private readonly maxSessionsPerUser: number;
  private readonly sessionSecret: string;

  constructor(private readonly configService: ConfigService) {
    this.sessionTimeout = this.configService.get<number>("SESSION_TIMEOUT", 3600000);
    this.maxSessionsPerUser = this.configService.get<number>("MAX_SESSIONS_PER_USER", 5);
    this.sessionSecret = this.configService.get<string>("SESSION_SECRET", "default-session-secret");

    setInterval(
      () => {
        this.cleanupExpiredSessions();
      },
      5 * 60 * 1000,
    );
  }

  async createSession(
    userId: string,
    tenantId: string,
    ipAddress: string,
    userAgent: string,
    metadata?: Record<string, any>,
  ): Promise<SessionData> {
    await this.enforceSessionLimit(userId);

    const sessionId = this.generateSecureSessionId();
    const now = new Date();
    const expiresAt = new Date(now.getTime() + this.sessionTimeout);

    const session: SessionData = {
      sessionId,
      userId,
      tenantId,
      ipAddress,
      userAgent,
      createdAt: now,
      lastAccessedAt: now,
      expiresAt,
      isActive: true,
      metadata,
    };

    this.sessions.set(sessionId, session);

    this.logger.log(`Session created for user ${userId}: ${sessionId}`);
    return session;
  }

  async validateSession(
    sessionId: string,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<SessionValidationResult> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return {
        isValid: false,
        reason: "Session not found",
      };
    }

    if (!session.isActive) {
      return {
        isValid: false,
        reason: "Session is inactive",
      };
    }

    if (session.expiresAt < new Date()) {
      await this.invalidateSession(sessionId);
      return {
        isValid: false,
        reason: "Session expired",
      };
    }

    if (ipAddress && this.configService.get<boolean>("ENFORCE_SESSION_IP", false)) {
      if (session.ipAddress !== ipAddress) {
        await this.invalidateSession(sessionId);
        this.logger.warn(
          `Session IP mismatch for ${sessionId}: expected ${session.ipAddress}, got ${ipAddress}`,
        );
        return {
          isValid: false,
          reason: "IP address mismatch",
        };
      }
    }

    session.lastAccessedAt = new Date();
    this.sessions.set(sessionId, session);

    return {
      isValid: true,
      session,
    };
  }

  async refreshSession(sessionId: string): Promise<SessionData | null> {
    const session = this.sessions.get(sessionId);

    if (!session || !session.isActive) {
      return null;
    }

    const now = new Date();
    session.lastAccessedAt = now;
    session.expiresAt = new Date(now.getTime() + this.sessionTimeout);

    this.sessions.set(sessionId, session);

    this.logger.debug(`Session refreshed: ${sessionId}`);
    return session;
  }

  async invalidateSession(sessionId: string): Promise<boolean> {
    const session = this.sessions.get(sessionId);

    if (!session) {
      return false;
    }

    session.isActive = false;
    this.sessions.set(sessionId, session);

    this.logger.log(`Session invalidated: ${sessionId}`);
    return true;
  }

  async invalidateUserSessions(userId: string): Promise<number> {
    let invalidatedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.userId === userId && session.isActive) {
        session.isActive = false;
        this.sessions.set(sessionId, session);
        invalidatedCount++;
      }
    }

    this.logger.log(`Invalidated ${invalidatedCount} sessions for user ${userId}`);
    return invalidatedCount;
  }

  async getUserSessions(userId: string): Promise<SessionData[]> {
    const userSessions: SessionData[] = [];

    for (const session of this.sessions.values()) {
      if (session.userId === userId && session.isActive && session.expiresAt > new Date()) {
        userSessions.push(session);
      }
    }

    return userSessions.toSorted((a, b) => b.lastAccessedAt.getTime() - a.lastAccessedAt.getTime());
  }

  async getSession(sessionId: string): Promise<SessionData | null> {
    return this.sessions.get(sessionId) || null;
  }

  generateSessionToken(sessionId: string): string {
    const timestamp = Date.now().toString();
    const data = `${sessionId}:${timestamp}`;
    const signature = crypto.createHmac("sha256", this.sessionSecret).update(data).digest("hex");

    return `${Buffer.from(data).toString("base64")}.${signature}`;
  }

  verifySessionToken(token: string): { sessionId: string; timestamp: number } | null {
    try {
      const [encodedData, signature] = token.split(".");

      if (!encodedData || !signature) {
        return null;
      }

      const data = Buffer.from(encodedData, "base64").toString("utf8");
      const expectedSignature = crypto
        .createHmac("sha256", this.sessionSecret)
        .update(data)
        .digest("hex");

      if (
        !crypto.timingSafeEqual(
          Buffer.from(signature, "hex"),
          Buffer.from(expectedSignature, "hex"),
        )
      ) {
        return null;
      }

      const [sessionId, timestampStr] = data.split(":");
      const timestamp = parseInt(timestampStr, 10);

      if (isNaN(timestamp)) {
        return null;
      }

      return { sessionId, timestamp };
    } catch (error) {
      this.logger.warn(`Invalid session token format: ${error.message}`);
      return null;
    }
  }

  async detectSuspiciousActivity(userId: string): Promise<{
    isSuspicious: boolean;
    reasons: string[];
    riskLevel: "low" | "medium" | "high";
  }> {
    const userSessions = await this.getUserSessions(userId);
    const reasons: string[] = [];
    let riskLevel: "low" | "medium" | "high" = "low";

    if (userSessions.length > this.maxSessionsPerUser * 0.8) {
      reasons.push("High number of concurrent sessions");
      riskLevel = "medium";
    }

    const uniqueIPs = new Set(userSessions.map((s) => s.ipAddress));
    if (uniqueIPs.size > 3) {
      reasons.push("Sessions from multiple IP addresses");
      riskLevel = "high";
    }

    const uniqueUserAgents = new Set(userSessions.map((s) => s.userAgent));
    if (uniqueUserAgents.size > 2) {
      reasons.push("Sessions from multiple devices/browsers");
      if (riskLevel === "low") riskLevel = "medium";
    }

    const recentSessions = userSessions.filter(
      (s) => s.createdAt > new Date(Date.now() - 10 * 60 * 1000),
    );
    if (recentSessions.length > 3) {
      reasons.push("Rapid session creation");
      riskLevel = "high";
    }

    return {
      isSuspicious: reasons.length > 0,
      reasons,
      riskLevel,
    };
  }

  async getSessionStats(): Promise<{
    totalSessions: number;
    activeSessions: number;
    expiredSessions: number;
    sessionsByTenant: Record<string, number>;
    averageSessionDuration: number;
  }> {
    const now = new Date();
    let totalSessions = 0;
    let activeSessions = 0;
    let expiredSessions = 0;
    const sessionsByTenant: Record<string, number> = {};
    let totalDuration = 0;

    for (const session of this.sessions.values()) {
      totalSessions++;

      if (session.isActive && session.expiresAt > now) {
        activeSessions++;
        totalDuration += now.getTime() - session.createdAt.getTime();
      } else {
        expiredSessions++;
      }

      sessionsByTenant[session.tenantId] = (sessionsByTenant[session.tenantId] || 0) + 1;
    }

    const averageSessionDuration = activeSessions > 0 ? totalDuration / activeSessions : 0;

    return {
      totalSessions,
      activeSessions,
      expiredSessions,
      sessionsByTenant,
      averageSessionDuration,
    };
  }

  private async cleanupExpiredSessions(): Promise<void> {
    const now = new Date();
    let cleanedCount = 0;

    for (const [sessionId, session] of this.sessions.entries()) {
      if (session.expiresAt < now || !session.isActive) {
        this.sessions.delete(sessionId);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      this.logger.debug(`Cleaned up ${cleanedCount} expired sessions`);
    }
  }

  private async enforceSessionLimit(userId: string): Promise<void> {
    const userSessions = await this.getUserSessions(userId);

    if (userSessions.length >= this.maxSessionsPerUser) {
      const sessionsToRemove = userSessions
        .toSorted((a, b) => a.lastAccessedAt.getTime() - b.lastAccessedAt.getTime())
        .slice(0, userSessions.length - this.maxSessionsPerUser + 1);

      for (const session of sessionsToRemove) {
        await this.invalidateSession(session.sessionId);
      }

      this.logger.log(
        `Enforced session limit for user ${userId}, removed ${sessionsToRemove.length} old sessions`,
      );
    }
  }

  private generateSecureSessionId(): string {
    return crypto.randomBytes(32).toString("hex");
  }
}
