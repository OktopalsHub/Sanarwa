/**
 * @vitest-environment jsdom
 */

import { describe, expect, it } from "vitest";
import {
  getContentSecurityPolicy,
  getCORSConfig,
  getCSRFConfig,
  getRateLimitConfig,
  getRequestValidationConfig,
  getSecurityHeaders,
  RateLimitTracker,
  RequestSanitizer,
  SecurityUtils,
} from "../security";

describe("Security Configuration", () => {
  describe("Content Security Policy", () => {
    it("should generate valid CSP", () => {
      const csp = getContentSecurityPolicy();

      expect(csp).toContain("default-src 'self'");
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("frame-ancestors 'none'");
      expect(typeof csp).toBe("string");
      expect(csp.length).toBeGreaterThan(0);
    });
  });

  describe("Security Headers", () => {
    it("should return security headers", () => {
      const headers = getSecurityHeaders();

      expect(headers["X-Frame-Options"]).toBe("DENY");
      expect(headers["X-Content-Type-Options"]).toBe("nosniff");
      expect(headers["Referrer-Policy"]).toBe("strict-origin-when-cross-origin");
      expect(headers["X-XSS-Protection"]).toBe("1; mode=block");
      expect(headers["Content-Security-Policy"]).toBeDefined();
    });
  });

  describe("CORS Configuration", () => {
    it("should return CORS configuration", () => {
      const corsConfig = getCORSConfig();

      expect(Array.isArray(corsConfig.allowedOrigins)).toBe(true);
      expect(Array.isArray(corsConfig.allowedMethods)).toBe(true);
      expect(Array.isArray(corsConfig.allowedHeaders)).toBe(true);
      expect(corsConfig.allowedMethods).toContain("GET");
      expect(corsConfig.allowedMethods).toContain("POST");
      expect(corsConfig.allowedHeaders).toContain("Authorization");
      expect(typeof corsConfig.allowCredentials).toBe("boolean");
      expect(corsConfig.maxAge).toBeGreaterThan(0);
    });
  });

  describe("Rate Limit Configuration", () => {
    it("should return rate limit configuration", () => {
      const rateLimitConfig = getRateLimitConfig();

      expect(rateLimitConfig.windowMs).toBeGreaterThan(0);
      expect(rateLimitConfig.maxRequests).toBeGreaterThan(0);
      expect(typeof rateLimitConfig.skipSuccessfulRequests).toBe("boolean");
      expect(typeof rateLimitConfig.skipFailedRequests).toBe("boolean");
      expect(typeof rateLimitConfig.keyGenerator).toBe("function");
    });
  });

  describe("CSRF Configuration", () => {
    it("should return CSRF configuration", () => {
      const csrfConfig = getCSRFConfig();

      expect(typeof csrfConfig.enabled).toBe("boolean");
      expect(csrfConfig.tokenName).toBeTruthy();
      expect(csrfConfig.cookieName).toBeTruthy();
      expect(csrfConfig.headerName).toBeTruthy();
      expect(["strict", "lax", "none"]).toContain(csrfConfig.sameSite);
      expect(typeof csrfConfig.secure).toBe("boolean");
    });
  });

  describe("Request Validation Configuration", () => {
    it("should return request validation configuration", () => {
      const validationConfig = getRequestValidationConfig();

      expect(validationConfig.maxBodySize).toBeGreaterThan(0);
      expect(Array.isArray(validationConfig.allowedContentTypes)).toBe(true);
      expect(validationConfig.allowedContentTypes).toContain("application/json");
      expect(typeof validationConfig.requireContentType).toBe("boolean");
      expect(typeof validationConfig.validateHeaders).toBe("boolean");
      expect(typeof validationConfig.sanitizeInput).toBe("boolean");
    });
  });
});

describe("Rate Limit Tracker", () => {
  it("should be a singleton", () => {
    const tracker1 = RateLimitTracker.getInstance();
    const tracker2 = RateLimitTracker.getInstance();
    expect(tracker1).toBe(tracker2);
  });

  it("should handle rate limit info", () => {
    const tracker = RateLimitTracker.getInstance();

    const headers = {
      "x-rate-limit-limit": "100",
      "x-rate-limit-remaining": "50",
      "x-rate-limit-reset": String(Math.floor(Date.now() / 1000) + 3600),
    };

    tracker.updateFromHeaders("/api/test", headers);

    const info = tracker.getInfo("/api/test");
    expect(info).toBeDefined();
    if (info) {
      expect(info.limit).toBe(100);
      expect(info.remaining).toBe(50);
      expect(info.percentage).toBe(0.5);
      expect(typeof info.isNearLimit).toBe("boolean");
    }
  });
});

describe("Request Sanitizer", () => {
  describe("XSS Sanitization", () => {
    it("should remove script tags", () => {
      const input = '<script>alert("xss")</script>Hello';
      const result = RequestSanitizer.sanitizeXSS(input);
      expect(result).toBe("Hello");
    });

    it("should encode HTML entities", () => {
      const input = '<div>Hello & "World"</div>';
      const result = RequestSanitizer.sanitizeXSS(input);
      expect(result).toContain("&lt;");
      expect(result).toContain("&gt;");
      expect(result).toContain("&amp;");
      expect(result).toContain("&quot;");
    });

    it("should handle non-string input", () => {
      const result = RequestSanitizer.sanitizeXSS(123 as any);
      expect(result).toBe(123);
    });
  });

  describe("SQL Sanitization", () => {
    it("should remove SQL keywords", () => {
      const input = "'; DROP TABLE users; --";
      const result = RequestSanitizer.sanitizeSQL(input);
      expect(result).not.toContain("DROP");
      expect(result).not.toContain("--");
    });

    it("should handle non-string input", () => {
      const result = RequestSanitizer.sanitizeSQL(123 as any);
      expect(result).toBe(123);
    });
  });

  describe("Object Sanitization", () => {
    it("should sanitize nested objects", () => {
      const input = {
        name: '<script>alert("xss")</script>John',
        data: {
          description: "Test<script>evil</script>",
        },
        tags: ["<script>evil</script>", "safe"],
      };

      const result = RequestSanitizer.sanitizeObject(input);

      expect(result.name).toBe("John");
      expect(result.data.description).not.toContain("<script>");
      expect(result.tags[0]).not.toContain("<script>");
      expect(result.tags[1]).toBe("safe");
    });

    it("should handle null and undefined values", () => {
      const input = { a: null, b: undefined, c: "test" };
      const result = RequestSanitizer.sanitizeObject(input);

      expect(result.a).toBeNull();
      expect(result.b).toBeUndefined();
      expect(result.c).toBe("test");
    });
  });
});

describe("Security Utils", () => {
  describe("URL Safety", () => {
    it("should allow safe HTTP/HTTPS URLs", () => {
      expect(SecurityUtils.isUrlSafe("https://example.com")).toBe(true);
      expect(SecurityUtils.isUrlSafe("http://localhost:3000")).toBe(true);
    });

    it("should allow WebSocket URLs", () => {
      expect(SecurityUtils.isUrlSafe("ws://localhost:9000")).toBe(true);
      expect(SecurityUtils.isUrlSafe("wss://example.com")).toBe(true);
    });

    it("should reject dangerous protocols", () => {
      expect(SecurityUtils.isUrlSafe('javascript:alert("xss")')).toBe(false);
      expect(SecurityUtils.isUrlSafe('data:text/html,<script>alert("xss")</script>')).toBe(false);
      expect(SecurityUtils.isUrlSafe("file:///etc/passwd")).toBe(false);
    });

    it("should reject invalid URLs", () => {
      expect(SecurityUtils.isUrlSafe("not-a-url")).toBe(false);
      expect(SecurityUtils.isUrlSafe("")).toBe(false);
    });
  });

  describe("Token Generation", () => {
    it("should generate secure tokens", () => {
      const token = SecurityUtils.generateSecureToken(16);
      expect(token).toHaveLength(32); // 16 bytes = 32 hex chars
      expect(/^[0-9a-f]+$/.test(token)).toBe(true);
    });

    it("should generate different tokens", () => {
      const token1 = SecurityUtils.generateSecureToken();
      const token2 = SecurityUtils.generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("String Hashing", () => {
    it("should hash strings consistently", async () => {
      const input = "test string";
      const hash1 = await SecurityUtils.hashString(input);
      const hash2 = await SecurityUtils.hashString(input);

      expect(hash1).toBe(hash2);
      expect(typeof hash1).toBe("string");
      expect(hash1.length).toBeGreaterThan(0);
    });

    it("should produce different hashes for different inputs", async () => {
      const hash1 = await SecurityUtils.hashString("input1");
      const hash2 = await SecurityUtils.hashString("input2");

      expect(hash1).not.toBe(hash2);
    });
  });
});
