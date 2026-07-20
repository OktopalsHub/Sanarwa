import { Test, TestingModule } from '@nestjs/testing';
import { InputSanitizationService } from './input-sanitization.service';

describe('InputSanitizationService', () => {
  let service: InputSanitizationService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [InputSanitizationService],
    }).compile();

    service = module.get<InputSanitizationService>(InputSanitizationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sanitize', () => {
    it('should return clean input unchanged', () => {
      const input = 'Hello World';
      const result = service.sanitize(input);

      expect(result.sanitized).toBe(input);
      expect(result.wasModified).toBe(false);
      expect(result.removedPatterns).toEqual([]);
    });

    it('should remove SQL injection patterns', () => {
      const input = "'; DROP TABLE users; --";
      const result = service.sanitize(input);

      expect(result.wasModified).toBe(true);
      expect(result.removedPatterns).toContain('sql_injection');
    });

    it('should remove XSS patterns', () => {
      const input = '<script>alert("xss")</script>';
      const result = service.sanitize(input);

      expect(result.wasModified).toBe(true);
      expect(result.removedPatterns).toContain('xss');
      expect(result.sanitized).not.toContain('<script>');
    });

    it('should remove command injection patterns', () => {
      const input = 'test; rm -rf /';
      const result = service.sanitize(input);

      expect(result.wasModified).toBe(true);
      expect(result.removedPatterns).toContain('command_injection');
    });

    it('should remove path traversal patterns', () => {
      const input = '../../../etc/passwd';
      const result = service.sanitize(input);

      expect(result.wasModified).toBe(true);
      expect(result.removedPatterns).toContain('path_traversal');
    });

    it('should remove null bytes', () => {
      const input = 'test\0null';
      const result = service.sanitize(input);

      expect(result.wasModified).toBe(true);
      expect(result.removedPatterns).toContain('null_bytes');
      expect(result.sanitized).toBe('testnull');
    });

    it('should trim whitespace', () => {
      const input = '  test  ';
      const result = service.sanitize(input);

      expect(result.wasModified).toBe(true);
      expect(result.removedPatterns).toContain('whitespace');
      expect(result.sanitized).toBe('test');
    });

    it('should enforce maximum length', () => {
      const input = 'a'.repeat(100);
      const result = service.sanitize(input, { maxLength: 50 });

      expect(result.wasModified).toBe(true);
      expect(result.removedPatterns).toContain('length_limit');
      expect(result.sanitized).toHaveLength(50);
    });

    it('should handle empty input', () => {
      const result = service.sanitize('');
      expect(result.sanitized).toBe('');
      expect(result.wasModified).toBe(false);
    });

    it('should handle null input', () => {
      const result = service.sanitize(null as any);
      expect(result.sanitized).toBe('');
      expect(result.wasModified).toBe(false);
    });
  });

  describe('sanitizeObject', () => {
    it('should sanitize string fields in object', () => {
      const obj = {
        name: 'John',
        email: '<script>alert("xss")</script>test@example.com',
        age: 25,
      };

      const result = service.sanitizeObject(obj);

      expect(result.wasModified).toBe(true);
      expect(result.modifiedFields).toContain('email');
      expect(result.sanitized.name).toBe('John');
      expect(result.sanitized.age).toBe(25);
      expect(result.sanitized.email).not.toContain('<script>');
    });

    it('should sanitize nested objects', () => {
      const obj = {
        user: {
          name: 'John',
          profile: {
            bio: '<script>alert("xss")</script>',
          },
        },
      };

      const result = service.sanitizeObject(obj);

      expect(result.wasModified).toBe(true);
      expect(result.modifiedFields).toContain('user.profile.bio');
    });

    it('should sanitize arrays', () => {
      const obj = {
        tags: ['tag1', '<script>alert("xss")</script>', 'tag3'],
      };

      const result = service.sanitizeObject(obj);

      expect(result.wasModified).toBe(true);
      expect(result.modifiedFields).toContain('tags');
    });
  });

  describe('validation methods', () => {
    it('should validate email format', () => {
      expect(service.validateEmail('test@example.com')).toBe(true);
      expect(service.validateEmail('invalid-email')).toBe(false);
      expect(service.validateEmail('test@')).toBe(false);
      expect(service.validateEmail('@example.com')).toBe(false);
    });

    it('should validate phone number format', () => {
      expect(service.validatePhoneNumber('+1234567890')).toBe(true);
      expect(service.validatePhoneNumber('1234567890')).toBe(true);
      expect(service.validatePhoneNumber('+1 (234) 567-8900')).toBe(true);
      expect(service.validatePhoneNumber('invalid')).toBe(false);
      expect(service.validatePhoneNumber('123')).toBe(true); // Short numbers are valid in some regions
    });

    it('should validate URL format', () => {
      expect(service.validateUrl('https://example.com')).toBe(true);
      expect(service.validateUrl('http://example.com')).toBe(true);
      expect(service.validateUrl('ftp://example.com')).toBe(false);
      expect(service.validateUrl('invalid-url')).toBe(false);
    });

    it('should validate JSON format', () => {
      const validJson = '{"key": "value"}';
      const invalidJson = '{key: value}';

      const validResult = service.validateJson(validJson);
      expect(validResult.isValid).toBe(true);
      expect(validResult.parsed).toEqual({ key: 'value' });

      const invalidResult = service.validateJson(invalidJson);
      expect(invalidResult.isValid).toBe(false);
      expect(invalidResult.error).toBeDefined();
    });
  });

  describe('escapeHtml', () => {
    it('should escape HTML entities', () => {
      const input = '<div>Hello & "World"</div>';
      const escaped = service.escapeHtml(input);

      expect(escaped).toBe(
        '&lt;div&gt;Hello &amp; &quot;World&quot;&lt;&#x2F;div&gt;',
      );
    });
  });

  describe('detectSuspiciousPatterns', () => {
    it('should detect SQL injection patterns', () => {
      const input = "'; DROP TABLE users; --";
      const result = service.detectSuspiciousPatterns(input);

      expect(result.isSuspicious).toBe(true);
      expect(result.detectedPatterns).toContain('sql_injection');
      expect(['low', 'medium', 'high']).toContain(result.riskLevel);
    });

    it('should detect multiple patterns and increase risk level', () => {
      const input = '<script>alert("xss")</script>; DROP TABLE users; --';
      const result = service.detectSuspiciousPatterns(input);

      expect(result.isSuspicious).toBe(true);
      expect(result.detectedPatterns).toContain('sql_injection');
      expect(result.detectedPatterns).toContain('xss');
      expect(['medium', 'high']).toContain(result.riskLevel);
    });

    it('should return low risk for clean input', () => {
      const input = 'Hello World';
      const result = service.detectSuspiciousPatterns(input);

      expect(result.isSuspicious).toBe(false);
      expect(result.detectedPatterns).toEqual([]);
      expect(result.riskLevel).toBe('low');
    });
  });
});
