import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { ProviderEncryptionService } from './provider-encryption.service';
import type { Mock, Mocked } from 'vitest';

describe('ProviderEncryptionService', () => {
  let service: ProviderEncryptionService;
  let configService: Mocked<ConfigService>;

  const mockEncryptionKey =
    'test-encryption-key-that-is-long-enough-for-security';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderEncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn().mockReturnValue(mockEncryptionKey),
          },
        },
      ],
    }).compile();

    service = module.get<ProviderEncryptionService>(ProviderEncryptionService);
    configService = module.get(ConfigService);
  });

  describe('constructor', () => {
    it('should throw error when encryption key is not provided', async () => {
      const moduleWithoutKey = Test.createTestingModule({
        providers: [
          ProviderEncryptionService,
          {
            provide: ConfigService,
            useValue: {
              get: vi.fn().mockReturnValue(undefined),
            },
          },
        ],
      });

      await expect(moduleWithoutKey.compile()).rejects.toThrow(
        'PROVIDER_ENCRYPTION_KEY environment variable is required',
      );
    });
  });

  describe('encrypt and decrypt', () => {
    const testData = {
      accessKeyId: 'AKIAIOSFODNN7EXAMPLE',
      secretAccessKey: 'wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY',
      region: 'us-east-1',
      fromEmail: 'test@example.com',
      nonSensitiveField: 'this should not be encrypted',
    };

    it('should encrypt sensitive fields and leave others unchanged', async () => {
      const encrypted = await service.encrypt(testData);

      // Sensitive fields should be encrypted (objects with encryptedData, iv, tag)
      expect(encrypted.accessKeyId).toHaveProperty('encryptedData');
      expect(encrypted.accessKeyId).toHaveProperty('iv');
      expect(encrypted.accessKeyId).toHaveProperty('tag');
      expect(encrypted.secretAccessKey).toHaveProperty('encryptedData');

      // Non-sensitive fields should remain unchanged
      expect(encrypted.region).toBe('us-east-1');
      expect(encrypted.nonSensitiveField).toBe('this should not be encrypted');
    });

    it('should decrypt encrypted fields back to original values', async () => {
      const encrypted = await service.encrypt(testData);
      const decrypted = await service.decrypt(encrypted);

      expect(decrypted.accessKeyId).toBe(testData.accessKeyId);
      expect(decrypted.secretAccessKey).toBe(testData.secretAccessKey);
      expect(decrypted.region).toBe(testData.region);
      expect(decrypted.fromEmail).toBe(testData.fromEmail);
      expect(decrypted.nonSensitiveField).toBe(testData.nonSensitiveField);
    });

    it('should handle empty or null data', async () => {
      expect(await service.encrypt(null)).toBe(null);
      expect(await service.encrypt(undefined)).toBe(undefined);
      expect(await service.encrypt({})).toEqual({});

      expect(await service.decrypt(null)).toBe(null);
      expect(await service.decrypt(undefined)).toBe(undefined);
      expect(await service.decrypt({})).toEqual({});
    });

    it('should handle non-object data', async () => {
      const stringData = 'test string';
      const numberData = 123;

      expect(await service.encrypt(stringData as any)).toBe(stringData);
      expect(await service.encrypt(numberData as any)).toBe(numberData);
      expect(await service.decrypt(stringData as any)).toBe(stringData);
      expect(await service.decrypt(numberData as any)).toBe(numberData);
    });
  });

  describe('encryptValue and decryptValue', () => {
    it('should encrypt and decrypt single values', async () => {
      const testValue = 'sensitive-api-key-12345';

      const encrypted = await service.encryptValue(testValue);
      expect(encrypted).toHaveProperty('encryptedData');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('tag');
      expect(encrypted.encryptedData).not.toBe(testValue);

      const decrypted = await service.decryptValue(encrypted);
      expect(decrypted).toBe(testValue);
    });

    it('should encrypt and decrypt object values', async () => {
      const testObject = { key: 'value', nested: { data: 'test' } };

      const encrypted = await service.encryptValue(testObject);
      const decrypted = await service.decryptValue(encrypted);

      expect(JSON.parse(decrypted)).toEqual(testObject);
    });

    it('should handle empty strings', async () => {
      const emptyString = '';

      const encrypted = await service.encryptValue(emptyString);
      const decrypted = await service.decryptValue(encrypted);

      expect(decrypted).toBe(emptyString);
    });
  });

  describe('shouldEncrypt', () => {
    const shouldEncrypt = (service as any).shouldEncrypt.bind(service);

    it('should identify sensitive field names', () => {
      expect(shouldEncrypt('accessKeyId', 'test')).toBe(true);
      expect(shouldEncrypt('secretAccessKey', 'test')).toBe(true);
      expect(shouldEncrypt('apiKey', 'test')).toBe(true);
      expect(shouldEncrypt('privateKey', 'test')).toBe(true);
      expect(shouldEncrypt('password', 'test')).toBe(true);
      expect(shouldEncrypt('token', 'test')).toBe(true);
      expect(shouldEncrypt('accessToken', 'test')).toBe(true);
      expect(shouldEncrypt('clientSecret', 'test')).toBe(true);
    });

    it('should not encrypt non-sensitive field names', () => {
      expect(shouldEncrypt('region', 'us-east-1')).toBe(false);
      expect(shouldEncrypt('fromEmail', 'test@example.com')).toBe(false);
      expect(shouldEncrypt('timeout', 5000)).toBe(false);
      expect(shouldEncrypt('retries', 3)).toBe(false);
    });

    it('should handle case-insensitive field names', () => {
      expect(shouldEncrypt('APIKEY', 'test')).toBe(true);
      expect(shouldEncrypt('ApiKey', 'test')).toBe(true);
      expect(shouldEncrypt('api_key', 'test')).toBe(true);
    });

    it('should not encrypt non-string and non-object values', () => {
      expect(shouldEncrypt('apiKey', 123)).toBe(false);
      expect(shouldEncrypt('apiKey', true)).toBe(false);
      expect(shouldEncrypt('apiKey', null)).toBe(false);
    });
  });

  describe('isEncryptedValue', () => {
    const isEncryptedValue = (service as any).isEncryptedValue.bind(service);

    it('should identify encrypted values', () => {
      const encryptedValue = {
        encryptedData: 'abc123',
        iv: 'def456',
        tag: 'ghi789',
      };

      expect(isEncryptedValue(encryptedValue)).toBe(true);
    });

    it('should reject non-encrypted values', () => {
      expect(isEncryptedValue('plain string')).toBe(false);
      expect(isEncryptedValue(123)).toBe(false);
      expect(isEncryptedValue({ key: 'value' })).toBe(false);
      expect(isEncryptedValue({ encryptedData: 'abc' })).toBe(false); // Missing iv and tag
      expect(isEncryptedValue(null)).toBe(false);
      expect(isEncryptedValue(undefined)).toBe(false);
    });
  });

  describe('batch operations', () => {
    const testData = {
      apiKey: 'secret-key-123',
      accessToken: 'token-456',
      region: 'us-east-1',
      timeout: 5000,
    };

    it('should encrypt multiple values in batch', async () => {
      const encrypted = await service.encryptBatch(testData);

      expect(encrypted).toHaveProperty('apiKey');
      expect(encrypted).toHaveProperty('accessToken');
      expect(encrypted).not.toHaveProperty('region'); // Not sensitive
      expect(encrypted).not.toHaveProperty('timeout'); // Not sensitive

      expect(encrypted.apiKey).toHaveProperty('encryptedData');
      expect(encrypted.accessToken).toHaveProperty('encryptedData');
    });

    it('should decrypt multiple values in batch', async () => {
      const encrypted = await service.encryptBatch(testData);
      const decrypted = await service.decryptBatch(encrypted);

      expect(decrypted.apiKey).toBe(testData.apiKey);
      expect(decrypted.accessToken).toBe(testData.accessToken);
    });
  });

  describe('rotateKey', () => {
    it('should re-encrypt data with new key', async () => {
      const testData = {
        apiKey: 'secret-key-123',
        region: 'us-east-1',
      };

      const encrypted = await service.encrypt(testData);
      const newKey = 'new-encryption-key-that-is-also-long-enough';

      const reencrypted = await service.rotateKey(newKey, encrypted);

      // Should be able to decrypt with the service that now has the new key
      const decrypted = await service.decrypt(reencrypted);
      expect(decrypted.apiKey).toBe(testData.apiKey);
      expect(decrypted.region).toBe(testData.region);
    });

    it('should restore old key on rotation failure', async () => {
      const testData = { apiKey: 'secret-key-123' };
      const encrypted = await service.encrypt(testData);

      // Mock decrypt to fail
      const originalDecrypt = service.decrypt;
      service.decrypt = vi
        .fn()
        .mockRejectedValue(new Error('Decryption failed'));

      const newKey = 'new-key';

      await expect(service.rotateKey(newKey, encrypted)).rejects.toThrow(
        'Decryption failed',
      );

      // Restore original method
      service.decrypt = originalDecrypt;

      // Should still be able to decrypt with original key
      const decrypted = await service.decrypt(encrypted);
      expect(decrypted.apiKey).toBe(testData.apiKey);
    });
  });

  describe('verifyIntegrity', () => {
    it('should verify integrity of valid encrypted data', async () => {
      const testData = { apiKey: 'secret-key-123', region: 'us-east-1' };
      const encrypted = await service.encrypt(testData);

      const isValid = await service.verifyIntegrity(encrypted);
      expect(isValid).toBe(true);
    });

    it('should detect corrupted encrypted data', async () => {
      const testData = { apiKey: 'secret-key-123' };
      const encrypted = await service.encrypt(testData);

      // Corrupt the encrypted data
      (encrypted.apiKey as any).encryptedData = 'corrupted-data';

      const isValid = await service.verifyIntegrity(encrypted);
      expect(isValid).toBe(false);
    });

    it('should handle non-encrypted data', async () => {
      const plainData = { region: 'us-east-1', timeout: 5000 };

      const isValid = await service.verifyIntegrity(plainData);
      expect(isValid).toBe(true);
    });
  });

  describe('static methods', () => {
    it('should generate valid encryption key', () => {
      const key = ProviderEncryptionService.generateEncryptionKey();

      expect(typeof key).toBe('string');
      expect(key.length).toBe(64); // 32 bytes * 2 (hex encoding)
      expect(ProviderEncryptionService.validateEncryptionKey(key)).toBe(true);
    });

    it('should validate encryption key format', () => {
      expect(
        ProviderEncryptionService.validateEncryptionKey(
          'valid-key-that-is-long-enough-for-security',
        ),
      ).toBe(true);
      expect(ProviderEncryptionService.validateEncryptionKey('short')).toBe(
        false,
      );
      expect(ProviderEncryptionService.validateEncryptionKey('')).toBe(false);
      expect(ProviderEncryptionService.validateEncryptionKey(null as any)).toBe(
        false,
      );
      expect(ProviderEncryptionService.validateEncryptionKey(123 as any)).toBe(
        false,
      );
    });
  });

  describe('getEncryptionInfo', () => {
    it('should return encryption metadata', () => {
      const info = service.getEncryptionInfo();

      expect(info).toEqual({
        algorithm: 'aes-256-gcm',
        keyLength: 32,
        ivLength: 16,
        tagLength: 16,
      });
    });
  });

  describe('error handling', () => {
    it('should handle encryption errors gracefully', async () => {
      // Mock crypto methods to throw errors
      const originalEncryptValue = service.encryptValue;
      service.encryptValue = vi
        .fn()
        .mockRejectedValue(new Error('Encryption failed'));

      const testData = { apiKey: 'test' };

      await expect(service.encrypt(testData)).rejects.toThrow(
        "Encryption failed for field 'apiKey'",
      );

      // Restore original method
      service.encryptValue = originalEncryptValue;
    });

    it('should handle decryption errors gracefully', async () => {
      const testData = { apiKey: 'secret-key-123' };
      const encrypted = await service.encrypt(testData);

      // Mock decryptValue to throw error
      const originalDecryptValue = service.decryptValue;
      service.decryptValue = vi
        .fn()
        .mockRejectedValue(new Error('Decryption failed'));

      await expect(service.decrypt(encrypted)).rejects.toThrow(
        "Decryption failed for field 'apiKey'",
      );

      // Restore original method
      service.decryptValue = originalDecryptValue;
    });
  });
});
