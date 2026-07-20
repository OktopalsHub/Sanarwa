import { Injectable, Logger } from '@nestjs/common';

export interface SanitizationOptions {
  allowHtml?: boolean;
  allowedTags?: string[];
  maxLength?: number;
  trimWhitespace?: boolean;
  removeNullBytes?: boolean;
  preventSqlInjection?: boolean;
  preventXss?: boolean;
  preventCommandInjection?: boolean;
}

export interface SanitizationResult {
  sanitized: string;
  wasModified: boolean;
  removedPatterns: string[];
}

@Injectable()
export class InputSanitizationService {
  private readonly logger = new Logger(InputSanitizationService.name);

  // SQL injection patterns
  private readonly sqlInjectionPatterns = [
    /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION|SCRIPT)\b)/gi,
    /(\b(OR|AND)\s+\d+\s*=\s*\d+)/gi,
    /(\b(OR|AND)\s+['"]\w+['"]?\s*=\s*['"]\w+['"]?)/gi,
    /(--|\/\*|\*\/|;)/g,
    /(\bxp_\w+)/gi,
    /(\bsp_\w+)/gi,
    /('(\s*|\+|\|\|)+(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|EXECUTE|UNION))/gi,
  ];

  // XSS patterns
  private readonly xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi,
    /<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi,
    /<embed\b[^<]*(?:(?!<\/embed>)<[^<]*)*<\/embed>/gi,
    /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi,
    /on\w+\s*=\s*["'][^"']*["']/gi,
    /javascript:/gi,
    /vbscript:/gi,
    /data:text\/html/gi,
    /<\s*\/?\s*(script|iframe|object|embed|form|meta|link|style)\b[^>]*>/gi,
  ];

  // Command injection patterns
  private readonly commandInjectionPatterns = [
    /(\||&|;|`|\$\(|\${)/g,
    /(wget|curl|nc|netcat|telnet|ssh|ftp|tftp)/gi,
    /(rm|del|format|fdisk|mkfs)/gi,
    /(cat|type|more|less|head|tail)(\s+\/|\s+[a-zA-Z]:\\)/gi,
    /(echo|print).*(\||&|;|`)/gi,
  ];

  // Path traversal patterns
  private readonly pathTraversalPatterns = [
    /\.\.\//g,
    /\.\.\\/g,
    /%2e%2e%2f/gi,
    /%2e%2e%5c/gi,
    /\.\.%2f/gi,
    /\.\.%5c/gi,
  ];

  /**
   * Sanitize input string with comprehensive security checks
   */
  sanitize(
    input: string,
    options: SanitizationOptions = {},
  ): SanitizationResult {
    if (!input || typeof input !== 'string') {
      return {
        sanitized: input || '',
        wasModified: false,
        removedPatterns: [],
      };
    }

    let sanitized = input;
    const removedPatterns: string[] = [];
    let wasModified = false;

    // Remove null bytes
    if (options.removeNullBytes !== false) {
      const beforeNullBytes = sanitized;
      sanitized = sanitized.replace(/\0/g, '');
      if (sanitized !== beforeNullBytes) {
        wasModified = true;
        removedPatterns.push('null_bytes');
      }
    }

    // Trim whitespace
    if (options.trimWhitespace !== false) {
      const beforeTrim = sanitized;
      sanitized = sanitized.trim();
      if (sanitized !== beforeTrim) {
        wasModified = true;
        removedPatterns.push('whitespace');
      }
    }

    // Prevent SQL injection
    if (options.preventSqlInjection !== false) {
      const beforeSql = sanitized;
      sanitized = this.removeSqlInjectionPatterns(sanitized);
      if (sanitized !== beforeSql) {
        wasModified = true;
        removedPatterns.push('sql_injection');
      }
    }

    // Prevent XSS
    if (options.preventXss !== false) {
      const beforeXss = sanitized;
      sanitized = this.removeXssPatterns(sanitized, options);
      if (sanitized !== beforeXss) {
        wasModified = true;
        removedPatterns.push('xss');
      }
    }

    // Prevent command injection
    if (options.preventCommandInjection !== false) {
      const beforeCmd = sanitized;
      sanitized = this.removeCommandInjectionPatterns(sanitized);
      if (sanitized !== beforeCmd) {
        wasModified = true;
        removedPatterns.push('command_injection');
      }
    }

    // Remove path traversal attempts
    const beforePath = sanitized;
    sanitized = this.removePathTraversalPatterns(sanitized);
    if (sanitized !== beforePath) {
      wasModified = true;
      removedPatterns.push('path_traversal');
    }

    // Enforce maximum length
    if (options.maxLength && sanitized.length > options.maxLength) {
      sanitized = sanitized.substring(0, options.maxLength);
      wasModified = true;
      removedPatterns.push('length_limit');
    }

    if (wasModified) {
      this.logger.warn(
        `Input sanitized. Removed patterns: ${removedPatterns.join(', ')}`,
      );
    }

    return {
      sanitized,
      wasModified,
      removedPatterns,
    };
  }

  /**
   * Sanitize object recursively
   */
  sanitizeObject(
    obj: Record<string, any>,
    options: SanitizationOptions = {},
  ): {
    sanitized: Record<string, any>;
    wasModified: boolean;
    modifiedFields: string[];
  } {
    const sanitized: Record<string, any> = {};
    const modifiedFields: string[] = [];
    let wasModified = false;

    for (const [key, value] of Object.entries(obj)) {
      if (typeof value === 'string') {
        const result = this.sanitize(value, options);
        sanitized[key] = result.sanitized;
        if (result.wasModified) {
          wasModified = true;
          modifiedFields.push(key);
        }
      } else if (
        typeof value === 'object' &&
        value !== null &&
        !Array.isArray(value)
      ) {
        const result = this.sanitizeObject(value, options);
        sanitized[key] = result.sanitized;
        if (result.wasModified) {
          wasModified = true;
          modifiedFields.push(
            ...result.modifiedFields.map((field) => `${key}.${field}`),
          );
        }
      } else if (Array.isArray(value)) {
        const result = this.sanitizeArray(value, options);
        sanitized[key] = result.sanitized;
        if (result.wasModified) {
          wasModified = true;
          modifiedFields.push(key);
        }
      } else {
        sanitized[key] = value;
      }
    }

    return {
      sanitized,
      wasModified,
      modifiedFields,
    };
  }

  /**
   * Sanitize array recursively
   */
  sanitizeArray(
    arr: any[],
    options: SanitizationOptions = {},
  ): {
    sanitized: any[];
    wasModified: boolean;
  } {
    const sanitized: any[] = [];
    let wasModified = false;

    for (const item of arr) {
      if (typeof item === 'string') {
        const result = this.sanitize(item, options);
        sanitized.push(result.sanitized);
        if (result.wasModified) {
          wasModified = true;
        }
      } else if (
        typeof item === 'object' &&
        item !== null &&
        !Array.isArray(item)
      ) {
        const result = this.sanitizeObject(item, options);
        sanitized.push(result.sanitized);
        if (result.wasModified) {
          wasModified = true;
        }
      } else if (Array.isArray(item)) {
        const result = this.sanitizeArray(item, options);
        sanitized.push(result.sanitized);
        if (result.wasModified) {
          wasModified = true;
        }
      } else {
        sanitized.push(item);
      }
    }

    return {
      sanitized,
      wasModified,
    };
  }

  /**
   * Validate email format
   */
  validateEmail(email: string): boolean {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  }

  /**
   * Validate phone number format
   */
  validatePhoneNumber(phone: string): boolean {
    const phoneRegex = /^\+?[1-9]\d{1,14}$/;
    return phoneRegex.test(phone.replace(/[\s\-\(\)]/g, ''));
  }

  /**
   * Validate URL format
   */
  validateUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return ['http:', 'https:'].includes(urlObj.protocol);
    } catch {
      return false;
    }
  }

  /**
   * Escape HTML entities
   */
  escapeHtml(input: string): string {
    const htmlEntities: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#x27;',
      '/': '&#x2F;',
    };

    return input.replace(/[&<>"'/]/g, (match) => htmlEntities[match]);
  }

  /**
   * Validate JSON structure
   */
  validateJson(input: string): {
    isValid: boolean;
    parsed?: any;
    error?: string;
  } {
    try {
      const parsed = JSON.parse(input);
      return { isValid: true, parsed };
    } catch (error) {
      return { isValid: false, error: error.message };
    }
  }

  /**
   * Check for suspicious patterns
   */
  detectSuspiciousPatterns(input: string): {
    isSuspicious: boolean;
    detectedPatterns: string[];
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const detectedPatterns: string[] = [];

    // Check for SQL injection
    if (this.sqlInjectionPatterns.some((pattern) => pattern.test(input))) {
      detectedPatterns.push('sql_injection');
    }

    // Check for XSS
    if (this.xssPatterns.some((pattern) => pattern.test(input))) {
      detectedPatterns.push('xss');
    }

    // Check for command injection
    if (this.commandInjectionPatterns.some((pattern) => pattern.test(input))) {
      detectedPatterns.push('command_injection');
    }

    // Check for path traversal
    if (this.pathTraversalPatterns.some((pattern) => pattern.test(input))) {
      detectedPatterns.push('path_traversal');
    }

    const isSuspicious = detectedPatterns.length > 0;
    let riskLevel: 'low' | 'medium' | 'high' = 'low';

    if (detectedPatterns.length >= 3) {
      riskLevel = 'high';
    } else if (detectedPatterns.length >= 2) {
      riskLevel = 'medium';
    } else if (detectedPatterns.length >= 1) {
      riskLevel = 'low';
    }

    return {
      isSuspicious,
      detectedPatterns,
      riskLevel,
    };
  }

  /**
   * Private helper methods
   */

  private removeSqlInjectionPatterns(input: string): string {
    let sanitized = input;

    this.sqlInjectionPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '');
    });

    return sanitized;
  }

  private removeXssPatterns(
    input: string,
    options: SanitizationOptions,
  ): string {
    let sanitized = input;

    if (!options.allowHtml) {
      // Remove all HTML tags if HTML is not allowed
      sanitized = sanitized.replace(/<[^>]*>/g, '');
    } else if (options.allowedTags && options.allowedTags.length > 0) {
      // Remove only non-allowed HTML tags
      const allowedTagsRegex = new RegExp(
        `<(?!/?(?:${options.allowedTags.join('|')})\\b)[^>]*>`,
        'gi',
      );
      sanitized = sanitized.replace(allowedTagsRegex, '');
    }

    // Remove XSS patterns
    this.xssPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '');
    });

    return sanitized;
  }

  private removeCommandInjectionPatterns(input: string): string {
    let sanitized = input;

    this.commandInjectionPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '');
    });

    return sanitized;
  }

  private removePathTraversalPatterns(input: string): string {
    let sanitized = input;

    this.pathTraversalPatterns.forEach((pattern) => {
      sanitized = sanitized.replace(pattern, '');
    });

    return sanitized;
  }
}
