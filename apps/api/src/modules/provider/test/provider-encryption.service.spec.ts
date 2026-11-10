import { ConfigService } from "@nestjs/config";
import { Test, TestingModule } from "@nestjs/testing";
import { ProviderEncryptionService } from "../provider-encryption.service";
import { EncryptionService } from "../../../common/security/services/encryption.service";
import type { Mock, Mocked } from "vitest";

const { encryptionService } = vi.hoisted(() => {
  const envelope = {
    encryptedData: "encrypted",
    iv: "iv",
    tag: "tag",
    algorithm: "aes-256-gcm",
    keyVersion: "v1",
  };

  return {
    encryptionService: {
      encrypt: vi.fn().mockResolvedValue(envelope),
      decrypt: vi.fn().mockResolvedValue("decrypted"),
      encryptProviderConfig: vi.fn().mockResolvedValue(envelope),
      decryptProviderConfig: vi.fn().mockResolvedValue(envelope),
    },
  };
});

vi.mock("../../../common/security/services/encryption.service", () => ({
  EncryptionService: class {},
}));

describe("ProviderEncryptionService", () => {
  let service: ProviderEncryptionService;
  let configService: Mocked<ConfigService>;

  beforeEach(async () => {
    encryptionService.encrypt.mockClear();
    encryptionService.decrypt.mockClear();
    encryptionService.encryptProviderConfig.mockClear();
    encryptionService.decryptProviderConfig.mockClear();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ProviderEncryptionService,
        {
          provide: ConfigService,
          useValue: { get: vi.fn().mockReturnValue("test-key") },
        },
        { provide: EncryptionService, useValue: encryptionService },
      ],
    }).compile();

    service = module.get<ProviderEncryptionService>(ProviderEncryptionService);
    configService = module.get(ConfigService);
  });

  describe("encrypt", () => {
    it("should delegate config encryption to EncryptionService", async () => {
      const testData = { accessKeyId: "AKIAEXAMPLE", region: "us-east-1" };

      const encrypted = await service.encrypt(testData);

      expect(encryptionService.encryptProviderConfig).toHaveBeenCalledWith(testData);
      expect(encrypted).toHaveProperty("encryptedData");
    });
  });

  describe("decrypt", () => {
    it("should delegate config decryption to EncryptionService", async () => {
      const encrypted = { accessKeyId: "encrypted-envelope" };

      const decrypted = await service.decrypt(encrypted);

      expect(encryptionService.decryptProviderConfig).toHaveBeenCalledWith(encrypted);
      expect(decrypted).toHaveProperty("encryptedData");
    });
  });

  describe("encryptValue and decryptValue", () => {
    it("should delegate single-value encryption to EncryptionService", async () => {
      const encrypted = await service.encryptValue("secret-value");

      expect(encryptionService.encrypt).toHaveBeenCalled();
      expect(encrypted).toHaveProperty("encryptedData");
    });

    it("should delegate single-value decryption to EncryptionService", async () => {
      const envelope = {
        encryptedData: "encrypted",
        iv: "iv",
        tag: "tag",
        algorithm: "aes-256-gcm",
        keyVersion: "v1",
      } as any;

      const decrypted = await service.decryptValue(envelope);

      expect(encryptionService.decrypt).toHaveBeenCalled();
      expect(decrypted).toBe("decrypted");
    });
  });
});
