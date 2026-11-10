export class LogSanitizer {
  private static readonly SENSITIVE_FIELDS = [
    "password",
    "token",
    "secret",
    "apiKey",
    "api_key",
    "accessToken",
    "refreshToken",
    "authorization",
    "cookie",
    "session",
    "ssn",
    "creditCard",
    "credit_card",
    "cvv",
    "pin",
    "otp",
  ];

  private static readonly SENSITIVE_PATTERNS = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /auth/i,
    /credential/i,
  ];

  static sanitizeObject(obj: any, maxDepth = 5): any {
    if (maxDepth <= 0) return "[MAX_DEPTH_REACHED]";
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== "object") return obj;

    if (Array.isArray(obj)) {
      return obj.map((item) => this.sanitizeObject(item, maxDepth - 1));
    }

    const sanitized: any = {};

    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key) && typeof value !== "object") {
        sanitized[key] = this.maskValue(value, key);
      } else if (typeof value === "object") {
        sanitized[key] = this.sanitizeObject(value, maxDepth - 1);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  static sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};

    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("authorization") ||
        lowerKey.includes("cookie") ||
        lowerKey.includes("token") ||
        lowerKey.includes("key") ||
        lowerKey.includes("secret")
      ) {
        sanitized[key] = "[REDACTED]";
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  static sanitizeQuery(query: Record<string, any>): Record<string, any> {
    return this.sanitizeObject(query);
  }

  static sanitizeBody(body: any): any {
    return this.sanitizeObject(body);
  }

  static sanitizeError(error: Error): any {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    };
  }

  static sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url, "http://localhost");
      const sensitiveParams = ["token", "key", "secret", "password", "auth"];

      for (const param of sensitiveParams) {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, "[REDACTED]");
        }
      }

      return urlObj.pathname + urlObj.search;
    } catch {
      return url;
    }
  }

  private static isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();

    if (this.SENSITIVE_FIELDS.includes(lowerFieldName)) {
      return true;
    }

    return this.SENSITIVE_PATTERNS.some((pattern) => pattern.test(fieldName));
  }

  private static maskValue(value: any, fieldName?: string): string {
    if (typeof value === "string") {
      const lowerFieldName = fieldName?.toLowerCase() || "";
      if (lowerFieldName === "password" || lowerFieldName.includes("secret")) {
        return "[REDACTED]";
      }

      if (value.length <= 4) {
        return "[REDACTED]";
      }
      return (
        value.substring(0, 2) + "*".repeat(value.length - 4) + value.substring(value.length - 2)
      );
    }
    return "[REDACTED]";
  }

  static truncateString(str: string, maxLength = 1000): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength) + "... [TRUNCATED]";
  }

  static limitObjectSize(obj: any, maxSize = 10000): any {
    const jsonString = JSON.stringify(obj);
    if (jsonString.length <= maxSize) {
      return obj;
    }

    return {
      ...obj,
      _truncated: true,
      _originalSize: jsonString.length,
      _note: "Object truncated due to size limit",
    };
  }
}
