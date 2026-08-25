/**
 * Security Configuration and CORS Management
 *
 * Provides security configuration, CORS handling, rate limiting awareness,
 * and request validation for the frontend application.
 */

import { config } from "./environment";

export interface SecurityHeaders {
  "Content-Security-Policy"?: string;
  "X-Frame-Options"?: string;
  "X-Content-Type-Options"?: string;
  "Referrer-Policy"?: string;
  "Permissions-Policy"?: string;
  "Strict-Transport-Security"?: string;
  "X-XSS-Protection"?: string;
}

export interface CORSConfig {
  allowedOrigins: string[];
  allowedMethods: string[];
  allowedHeaders: string[];
  exposedHeaders: string[];
  allowCredentials: boolean;
  maxAge: number;
}

export interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  skipSuccessfulRequests: boolean;
  skipFailedRequests: boolean;
  keyGenerator?: (request: any) => string;
}

export interface CSRFConfig {
  enabled: boolean;
  tokenName: string;
  cookieName: string;
  headerName: string;
  sameSite: "strict" | "lax" | "none";
  secure: boolean;
}

export interface RequestValidationConfig {
  maxBodySize: number;
  allowedContentTypes: string[];
  requireContentType: boolean;
  validateHeaders: boolean;
  sanitizeInput: boolean;
}

/**
 * Get Content Security Policy based on environment
 */
export function getContentSecurityPolicy(): string {
  const { environment } = config.app;
  const { baseUrl } = config.api;
  const { url: wsUrl } = config.websocket;

  // Extract domains from URLs
  const apiDomain = new URL(baseUrl).origin;
  const wsDomain = wsUrl.replace(/^ws/, "http"); // Convert for CSP

  const policies = [
    "default-src 'self'",
    `connect-src 'self' ${apiDomain} ${wsDomain}`,
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'", // Next.js requires unsafe-inline/eval in dev
    "style-src 'self' 'unsafe-inline'", // Required for styled-components and CSS-in-JS
    "img-src 'self' data: blob: https:",
    "font-src 'self' data:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];

  // Environment-specific adjustments
  if (environment === "development") {
    // Allow webpack dev server and hot reload
    policies.push("script-src 'self' 'unsafe-inline' 'unsafe-eval' webpack:");
    policies.push("connect-src 'self' ws: wss: webpack:");
  }

  // Add monitoring domains if enabled
  if (config.monitoring.enableSentry && config.monitoring.sentryDsn) {
    const sentryDomain = new URL(config.monitoring.sentryDsn).origin;
    policies.push(`connect-src 'self' ${apiDomain} ${wsDomain} ${sentryDomain}`);
  }

  if (config.monitoring.enablePosthog && config.monitoring.posthogHost) {
    const posthogDomain = new URL(config.monitoring.posthogHost).origin;
    policies.push(`connect-src 'self' ${apiDomain} ${wsDomain} ${posthogDomain}`);
  }

  return policies.join("; ");
}

/**
 * Get security headers configuration
 */
export function getSecurityHeaders(): SecurityHeaders {
  const { environment } = config.app;
  const isProduction = environment === "production";

  const headers: SecurityHeaders = {
    "Content-Security-Policy": getContentSecurityPolicy(),
    "X-Frame-Options": "DENY",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=(), payment=()",
    "X-XSS-Protection": "1; mode=block",
  };

  // Add HSTS in production with HTTPS
  if (isProduction && config.app.appUrl.startsWith("https://")) {
    headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains; preload";
  }

  return headers;
}

/**
 * Get CORS configuration
 */
export function getCORSConfig(): CORSConfig {
  const { allowedOrigins } = config.security;
  const { environment } = config.app;

  return {
    allowedOrigins,
    allowedMethods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Tenant-ID",
      "X-API-Key",
      "X-CSRF-Token",
      "Accept",
      "Origin",
      "User-Agent",
      "DNT",
      "Cache-Control",
      "X-Mx-ReqToken",
      "Keep-Alive",
      "If-Modified-Since",
    ],
    exposedHeaders: [
      "X-Total-Count",
      "X-Page-Count",
      "X-Per-Page",
      "X-Rate-Limit-Limit",
      "X-Rate-Limit-Remaining",
      "X-Rate-Limit-Reset",
    ],
    allowCredentials: true,
    maxAge: environment === "production" ? 86400 : 3600, // 24h in prod, 1h in dev
  };
}

/**
 * Get rate limiting configuration
 */
export function getRateLimitConfig(): RateLimitConfig {
  const { rateLimitWindow, rateLimitMax } = config.security;
  const { environment } = config.app;

  return {
    windowMs: rateLimitWindow,
    maxRequests: rateLimitMax,
    skipSuccessfulRequests: false,
    skipFailedRequests: false,
    keyGenerator: (request: any) => {
      // Use IP address and user ID if available
      const ip = request.ip || request.connection?.remoteAddress || "unknown";
      const userId = request.user?.id || "anonymous";
      return `${ip}:${userId}`;
    },
  };
}

/**
 * Get CSRF configuration
 */
export function getCSRFConfig(): CSRFConfig {
  const { enableCSRF } = config.security;
  const { environment } = config.app;
  const isProduction = environment === "production";

  return {
    enabled: enableCSRF,
    tokenName: "csrfToken",
    cookieName: "_csrf",
    headerName: "X-CSRF-Token",
    sameSite: isProduction ? "strict" : "lax",
    secure: isProduction && config.app.appUrl.startsWith("https://"),
  };
}

/**
 * Get request validation configuration
 */
export function getRequestValidationConfig(): RequestValidationConfig {
  return {
    maxBodySize: 10 * 1024 * 1024, // 10MB
    allowedContentTypes: [
      "application/json",
      "application/x-www-form-urlencoded",
      "multipart/form-data",
      "text/plain",
      "text/csv",
      "application/octet-stream",
    ],
    requireContentType: true,
    validateHeaders: true,
    sanitizeInput: true,
  };
}

/**
 * Rate limiting tracker for client-side awareness
 */
export class RateLimitTracker {
  private static instance: RateLimitTracker;
  private limits: Map<string, RateLimitInfo> = new Map();
  private callbacks: Set<(info: RateLimitInfo) => void> = new Set();

  static getInstance(): RateLimitTracker {
    if (!RateLimitTracker.instance) {
      RateLimitTracker.instance = new RateLimitTracker();
    }
    return RateLimitTracker.instance;
  }

  /**
   * Update rate limit info from response headers
   */
  updateFromHeaders(endpoint: string, headers: Record<string, string>): void {
    const limit = parseInt(headers["x-rate-limit-limit"] || "0", 10);
    const remaining = parseInt(headers["x-rate-limit-remaining"] || "0", 10);
    const reset = parseInt(headers["x-rate-limit-reset"] || "0", 10);

    if (limit > 0) {
      const info: RateLimitInfo = {
        endpoint,
        limit,
        remaining,
        reset: new Date(reset * 1000),
        percentage: remaining / limit,
        isNearLimit: remaining / limit < 0.1, // Less than 10% remaining
      };

      this.limits.set(endpoint, info);
      this.notifyCallbacks(info);
    }
  }

  /**
   * Get rate limit info for endpoint
   */
  getInfo(endpoint: string): RateLimitInfo | null {
    return this.limits.get(endpoint) || null;
  }

  /**
   * Check if endpoint is near rate limit
   */
  isNearLimit(endpoint: string, threshold: number = 0.1): boolean {
    const info = this.limits.get(endpoint);
    return info ? info.percentage < threshold : false;
  }

  /**
   * Get time until rate limit reset
   */
  getTimeUntilReset(endpoint: string): number {
    const info = this.limits.get(endpoint);
    if (!info) return 0;

    return Math.max(0, info.reset.getTime() - Date.now());
  }

  /**
   * Subscribe to rate limit updates
   */
  subscribe(callback: (info: RateLimitInfo) => void): () => void {
    this.callbacks.add(callback);
    return () => this.callbacks.delete(callback);
  }

  private notifyCallbacks(info: RateLimitInfo): void {
    this.callbacks.forEach((callback) => callback(info));
  }

  /**
   * Clear expired rate limit info
   */
  cleanup(): void {
    const now = Date.now();
    for (const [endpoint, info] of this.limits.entries()) {
      if (info.reset.getTime() < now) {
        this.limits.delete(endpoint);
      }
    }
  }
}

export interface RateLimitInfo {
  endpoint: string;
  limit: number;
  remaining: number;
  reset: Date;
  percentage: number;
  isNearLimit: boolean;
}

/**
 * Request sanitization utilities
 */
export class RequestSanitizer {
  private static readonly XSS_PATTERNS = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
  ];

  private static readonly SQL_PATTERNS = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b)/gi,
    /(--|\/\*|\*\/|;)/g,
    /(\b(OR|AND)\b.*=.*)/gi,
  ];

  /**
   * Sanitize string input to prevent XSS
   */
  static sanitizeXSS(input: string): string {
    if (typeof input !== "string") return input;

    let sanitized = input;

    // Remove dangerous HTML tags and attributes
    this.XSS_PATTERNS.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, "");
    });

    // Encode HTML entities
    sanitized = sanitized
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#x27;")
      .replace(/\//g, "&#x2F;");

    return sanitized;
  }

  /**
   * Sanitize input to prevent SQL injection
   */
  static sanitizeSQL(input: string): string {
    if (typeof input !== "string") return input;

    let sanitized = input;

    this.SQL_PATTERNS.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, "");
    });

    return sanitized.trim();
  }

  /**
   * Sanitize object recursively
   */
  static sanitizeObject(obj: any): any {
    if (obj === null || obj === undefined) return obj;

    if (typeof obj === "string") {
      return this.sanitizeXSS(obj);
    }

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item));
    }

    if (typeof obj === "object") {
      const sanitized: any = {};
      for (const [key, value] of Object.entries(obj)) {
        sanitized[this.sanitizeXSS(key)] = this.sanitizeObject(value);
      }
      return sanitized;
    }

    return obj;
  }

  /**
   * Validate and sanitize request payload
   */
  static validateAndSanitize(payload: any, options: RequestValidationConfig): any {
    if (!options.sanitizeInput) return payload;

    // Check payload size (approximate)
    const payloadSize = JSON.stringify(payload).length;
    if (payloadSize > options.maxBodySize) {
      throw new Error(`Request payload too large: ${payloadSize} bytes`);
    }

    return this.sanitizeObject(payload);
  }
}

/**
 * Security middleware for API requests
 */
export class SecurityMiddleware {
  private rateLimitTracker = RateLimitTracker.getInstance();
  private config = getRequestValidationConfig();

  /**
   * Process request before sending
   */
  processRequest(url: string, options: RequestInit): RequestInit {
    const processedOptions = { ...options };

    // Add security headers
    const headers = new Headers(processedOptions.headers);

    // Add CSRF token if available
    const csrfConfig = getCSRFConfig();
    if (csrfConfig.enabled && typeof window !== "undefined") {
      const csrfToken = this.getCSRFToken();
      if (csrfToken) {
        headers.set(csrfConfig.headerName, csrfToken);
      }
    }

    // Add request ID for tracking
    headers.set("X-Request-ID", this.generateRequestId());

    // Validate and sanitize body
    if (processedOptions.body && typeof processedOptions.body === "string") {
      try {
        const parsed = JSON.parse(processedOptions.body);
        const sanitized = RequestSanitizer.validateAndSanitize(parsed, this.config);
        processedOptions.body = JSON.stringify(sanitized);
      } catch (error) {
        console.warn("Failed to sanitize request body:", error);
      }
    }

    processedOptions.headers = headers;
    return processedOptions;
  }

  /**
   * Process response after receiving
   */
  processResponse(url: string, response: Response): void {
    // Update rate limit tracking
    const headers: Record<string, string> = {};
    response.headers.forEach((value, key) => {
      headers[key.toLowerCase()] = value;
    });

    this.rateLimitTracker.updateFromHeaders(url, headers);

    // Log security-related headers
    if (config.logging.enablePerformanceLogs) {
      const securityHeaders = [
        "x-rate-limit-remaining",
        "x-rate-limit-reset",
        "strict-transport-security",
        "content-security-policy",
      ];

      securityHeaders.forEach((header) => {
        const value = headers[header];
        if (value) {
          console.debug(`Security header ${header}:`, value);
        }
      });
    }
  }

  /**
   * Get CSRF token from cookie or meta tag
   */
  private getCSRFToken(): string | null {
    if (typeof window === "undefined") return null;

    const csrfConfig = getCSRFConfig();

    // Try to get from cookie
    const cookies = document.cookie.split(";");
    for (const cookie of cookies) {
      const [name, value] = cookie.trim().split("=");
      if (name === csrfConfig.cookieName) {
        return value ? decodeURIComponent(value) : "";
      }
    }

    // Try to get from meta tag
    const metaTag = document.querySelector(`meta[name="${csrfConfig.tokenName}"]`);
    if (metaTag) {
      return metaTag.getAttribute("content");
    }

    return null;
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }
}

/**
 * Global security middleware instance
 */
export const securityMiddleware = new SecurityMiddleware();

/**
 * Global rate limit tracker instance
 */
export const rateLimitTracker = RateLimitTracker.getInstance();

/**
 * Utility functions for security checks
 */
export const SecurityUtils = {
  /**
   * Check if origin is allowed
   */
  isOriginAllowed(origin: string): boolean {
    const { allowedOrigins } = config.security;
    return allowedOrigins.includes("*") || allowedOrigins.includes(origin);
  },

  /**
   * Validate URL for security
   */
  isUrlSafe(url: string): boolean {
    try {
      const urlObj = new URL(url);

      // Check protocol
      if (!["http:", "https:", "ws:", "wss:"].includes(urlObj.protocol)) {
        return false;
      }

      // Check for suspicious patterns
      const suspiciousPatterns = [/javascript:/i, /data:/i, /vbscript:/i, /file:/i];

      return !suspiciousPatterns.some((pattern) => pattern.test(url));
    } catch {
      return false;
    }
  },

  /**
   * Generate secure random string
   */
  generateSecureToken(length: number = 32): string {
    if (typeof window !== "undefined" && window.crypto && window.crypto.getRandomValues) {
      const array = new Uint8Array(length);
      window.crypto.getRandomValues(array);
      return Array.from(array, (byte) => byte.toString(16).padStart(2, "0")).join("");
    }

    // Fallback for environments without crypto API
    return Array.from({ length }, () => Math.floor(Math.random() * 16).toString(16)).join("");
  },

  /**
   * Hash string using Web Crypto API
   */
  async hashString(input: string): Promise<string> {
    if (typeof window !== "undefined" && window.crypto && window.crypto.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(input);
      const hashBuffer = await window.crypto.subtle.digest("SHA-256", data);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
    }

    // Fallback - not cryptographically secure
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      const char = input.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash = hash & hash; // Convert to 32-bit integer
    }
    return hash.toString(16);
  },
};
