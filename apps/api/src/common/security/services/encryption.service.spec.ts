import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { EncryptionService } from "./encryption.service";

describe("EncryptionService", () => {
  let service: EncryptionService;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EncryptionService,
        {
          provide: ConfigService,
          useValue: {
            get: vi.fn((key: string) => {
              switch (key) {
                case "PROVIDER_ENCRYPTION_KEY":
                  return "test-encryption-key-32-characters-long";
                case "ENCRYPTION_KEY_VERSION":
                  return "v1";
                default:
                  return undefined;
              }
            }),
          },
        },
      ],
    }).compile();

    service = module.get<EncryptionService>(EncryptionService);
    configService = module.get<ConfigService>(ConfigService);
  });

  it("should be defined", () => {
    expect(service).toBeDefined();
  });

  describe("encrypt and decrypt", () => {
    it("should encrypt and decrypt a string successfully", async () => {
      const plaintext = "sensitive-api-key-12345";

      const encrypted = await service.encrypt(plaintext);
      expect(encrypted).toHaveProperty("encryptedData");
      expect(encrypted).toHaveProperty("iv");
      expect(encrypted).toHaveProperty("tag");
      expect(encrypted).toHaveProperty("algorithm");
      expect(encrypted).toHaveProperty("keyVersion");

      const decrypted = await service.decrypt(encrypted);
      expect(decrypted).toBe(plaintext);
    });

    it("should encrypt and decrypt an object successfully", async () => {
      const data = { apiKey: "secret-key", userId: 123 };

      const encrypted = await service.encrypt(data);
      const decrypted = await service.decrypt(encrypted);

      expect(JSON.parse(decrypted)).toEqual(data);
    });

    it("should use additional authenticated data", async () => {
      const plaintext = "sensitive-data";
      const additionalData = "context-info";

      const encrypted = await service.encrypt(plaintext, { additionalData });
      const decrypted = await service.decrypt(encrypted, additionalData);

      expect(decrypted).toBe(plaintext);
    });

    it("should fail decryption with wrong additional data", async () => {
      const plaintext = "sensitive-data";
      const additionalData = "context-info";
      const wrongAdditionalData = "wrong-context";

      const encrypted = await service.encrypt(plaintext, { additionalData });

      await expect(service.decrypt(encrypted, wrongAdditionalData)).rejects.toThrow();
    });
  });

  describe("encryptProviderConfig", () => {
    it("should encrypt sensitive fields in provider config", async () => {
      const config = {
        apiKey: "secret-api-key",
        accessToken: "secret-token",
        region: "us-east-1",
        timeout: 5000,
      };

      const encrypted = await service.encryptProviderConfig(config);

      expect(encrypted.region).toBe("us-east-1");
      expect(encrypted.timeout).toBe(5000);
      expect(typeof encrypted.apiKey).toBe("object");
      expect(typeof encrypted.accessToken).toBe("object");
      expect(encrypted.apiKey).toHaveProperty("encryptedData");
      expect(encrypted.accessToken).toHaveProperty("encryptedData");
    });

    it("should decrypt provider config correctly", async () => {
      const config = {
        apiKey: "secret-api-key",
        accessToken: "secret-token",
        region: "us-east-1",
      };

      const encrypted = await service.encryptProviderConfig(config);
      const decrypted = await service.decryptProviderConfig(encrypted);

      expect(decrypted).toEqual(config);
    });
  });

  describe("hash and verifyHash", () => {
    it("should hash and verify a string successfully", async () => {
      const data = "password123";

      const { hash, salt } = await service.hash(data);
      expect(hash).toBeDefined();
      expect(salt).toBeDefined();

      const isValid = await service.verifyHash(data, hash, salt);
      expect(isValid).toBe(true);

      const isInvalid = await service.verifyHash("wrong-password", hash, salt);
      expect(isInvalid).toBe(false);
    });

    it("should use provided salt", async () => {
      const data = "password123";
      const customSalt = "custom-salt";

      const { hash, salt } = await service.hash(data, customSalt);
      expect(salt).toBe(customSalt);

      const isValid = await service.verifyHash(data, hash, salt);
      expect(isValid).toBe(true);
    });
  });

  describe("generateApiKey", () => {
    it("should generate a valid API key", () => {
      const { key, hash, prefix } = service.generateApiKey();

      expect(key).toMatch(/^nk_[a-f0-9]{64}$/);
      expect(hash).toHaveLength(64);
      expect(prefix).toBe(key.substring(0, 8));
    });
  });

  describe("generateSecureToken", () => {
    it("should generate a secure token of specified length", () => {
      const token = service.generateSecureToken(16);
      expect(token).toHaveLength(32); // 16 bytes = 32 hex characters
    });

    it("should generate different tokens each time", () => {
      const token1 = service.generateSecureToken();
      const token2 = service.generateSecureToken();
      expect(token1).not.toBe(token2);
    });
  });

  describe("static methods", () => {
    it("should validate encryption key format", () => {
      expect(EncryptionService.validateEncryptionKey("short")).toBe(false);
      expect(EncryptionService.validateEncryptionKey("")).toBe(false);
      expect(EncryptionService.validateEncryptionKey(null as any)).toBe(false);
      expect(EncryptionService.validateEncryptionKey("this-is-a-valid-32-character-key")).toBe(
        true,
      );
    });

    it("should generate a valid encryption key", () => {
      const key = EncryptionService.generateEncryptionKey();
      expect(key).toHaveLength(64); // 32 bytes = 64 hex characters
      expect(EncryptionService.validateEncryptionKey(key)).toBe(true);
    });
  });

  describe("error handling", () => {
    it("should throw error for invalid key version", async () => {
      await expect(service.encrypt("test", { keyVersion: "invalid" })).rejects.toThrow();
    });

    it("should throw error for corrupted encrypted data", async () => {
      const corrupted = {
        encryptedData: "corrupted",
        iv: "invalid",
        tag: "invalid",
        algorithm: "aes-256-gcm",
        keyVersion: "v1",
      };

      await expect(service.decrypt(corrupted)).rejects.toThrow();
    });
  });
});
