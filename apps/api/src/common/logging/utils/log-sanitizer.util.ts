/**
 * Utility class for sanitizing log data to prevent sensitive information leakage
 */
export class LogSanitizer {
  private static readonly SENSITIVE_FIELDS = [
    'password',
    'token',
    'secret',
    'apiKey',
    'api_key',
    'accessToken',
    'refreshToken',
    'authorization',
    'cookie',
    'session',
    'ssn',
    'creditCard',
    'credit_card',
    'cvv',
    'pin',
    'otp',
  ];

  private static readonly SENSITIVE_PATTERNS = [
    /password/i,
    /token/i,
    /secret/i,
    /key/i,
    /auth/i,
    /credential/i,
  ];

  /**
   * Sanitize an object by removing or masking sensitive fields
   */
  static sanitizeObject(obj: any, maxDepth = 5): any {
    if (maxDepth <= 0) return '[MAX_DEPTH_REACHED]';
    if (obj === null || obj === undefined) return obj;
    if (typeof obj !== 'object') return obj;

    if (Array.isArray(obj)) {
      return obj.map(item => this.sanitizeObject(item, maxDepth - 1));
    }

    const sanitized: any = {};
    
    for (const [key, value] of Object.entries(obj)) {
      if (this.isSensitiveField(key) && typeof value !== 'object') {
        // Only mask primitive values, not objects
        sanitized[key] = this.maskValue(value, key);
      } else if (typeof value === 'object') {
        // Always sanitize objects recursively, even if the key name is sensitive
        sanitized[key] = this.sanitizeObject(value, maxDepth - 1);
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize request headers
   */
  static sanitizeHeaders(headers: Record<string, any>): Record<string, any> {
    const sanitized: Record<string, any> = {};
    
    for (const [key, value] of Object.entries(headers)) {
      const lowerKey = key.toLowerCase();
      if (lowerKey.includes('authorization') || 
          lowerKey.includes('cookie') || 
          lowerKey.includes('token') ||
          lowerKey.includes('key') ||
          lowerKey.includes('secret')) {
        sanitized[key] = '[REDACTED]';
      } else {
        sanitized[key] = value;
      }
    }

    return sanitized;
  }

  /**
   * Sanitize query parameters
   */
  static sanitizeQuery(query: Record<string, any>): Record<string, any> {
    return this.sanitizeObject(query);
  }

  /**
   * Sanitize request body
   */
  static sanitizeBody(body: any): any {
    return this.sanitizeObject(body);
  }

  /**
   * Sanitize error objects
   */
  static sanitizeError(error: Error): any {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
      // Don't include other properties that might contain sensitive data
    };
  }

  /**
   * Sanitize URL by removing sensitive query parameters
   */
  static sanitizeUrl(url: string): string {
    try {
      const urlObj = new URL(url, 'http://localhost');
      const sensitiveParams = ['token', 'key', 'secret', 'password', 'auth'];
      
      for (const param of sensitiveParams) {
        if (urlObj.searchParams.has(param)) {
          urlObj.searchParams.set(param, '[REDACTED]');
        }
      }
      
      return urlObj.pathname + urlObj.search;
    } catch {
      // If URL parsing fails, just return the original
      return url;
    }
  }

  /**
   * Check if a field name indicates sensitive data
   */
  private static isSensitiveField(fieldName: string): boolean {
    const lowerFieldName = fieldName.toLowerCase();
    
    // Check exact matches
    if (this.SENSITIVE_FIELDS.includes(lowerFieldName)) {
      return true;
    }

    // Check pattern matches
    return this.SENSITIVE_PATTERNS.some(pattern => pattern.test(fieldName));
  }

  /**
   * Mask a sensitive value
   */
  private static maskValue(value: any, fieldName?: string): string {
    if (typeof value === 'string') {
      // For passwords and other highly sensitive fields, completely redact
      const lowerFieldName = fieldName?.toLowerCase() || '';
      if (lowerFieldName === 'password' || lowerFieldName.includes('secret')) {
        return '[REDACTED]';
      }
      
      if (value.length <= 4) {
        return '[REDACTED]';
      }
      return value.substring(0, 2) + '*'.repeat(value.length - 4) + value.substring(value.length - 2);
    }
    return '[REDACTED]';
  }

  /**
   * Truncate large strings to prevent log bloat
   */
  static truncateString(str: string, maxLength = 1000): string {
    if (str.length <= maxLength) {
      return str;
    }
    return str.substring(0, maxLength) + '... [TRUNCATED]';
  }

  /**
   * Limit object size to prevent memory issues
   */
  static limitObjectSize(obj: any, maxSize = 10000): any {
    const jsonString = JSON.stringify(obj);
    if (jsonString.length <= maxSize) {
      return obj;
    }
    
    return {
      ...obj,
      _truncated: true,
      _originalSize: jsonString.length,
      _note: 'Object truncated due to size limit'
    };
  }
}