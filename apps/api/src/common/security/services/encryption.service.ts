import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import * as crypto from "crypto";

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  tag: string;
  algorithm: string;
  keyVersion: string;
}

export interface EncryptionOptions {
  algorithm?: string;
  keyVersion?: string;
  additionalData?: string;
}

@Injectable()
export class EncryptionService {
  private readonly logger = new Logger(EncryptionService.name);
  private readonly algorithm = "aes-256-gcm";
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly tagLength = 16;
  private readonly encryptionKeys: Map<string, Buffer> = new Map();
  private readonly currentKeyVersion: string;

  constructor(private readonly configService: ConfigService) {
    this.currentKeyVersion = this.configService.get<string>("ENCRYPTION_KEY_VERSION", "v1");
    this.initializeEncryptionKeys();
  }

  private initializeEncryptionKeys(): void {
    const primaryKey = this.configService.get<string>("PROVIDER_ENCRYPTION_KEY");
    if (!primaryKey) {
      throw new Error("PROVIDER_ENCRYPTION_KEY environment variable is required");
    }

    const salt = crypto.randomBytes(32);
    const derivedKey = crypto.scryptSync(primaryKey, salt, this.keyLength);
    this.encryptionKeys.set(this.currentKeyVersion, derivedKey);

    const keyVersions = this.configService.get<string>("ENCRYPTION_KEY_VERSIONS", "");
    if (keyVersions) {
      const versions = keyVersions.split(",");
      versions.forEach((version) => {
        const versionKey = this.configService.get<string>(
          `ENCRYPTION_KEY_${version.toUpperCase()}`,
        );
        if (versionKey) {
          const derivedVersionKey = crypto.scryptSync(versionKey, "salt", this.keyLength);
          this.encryptionKeys.set(version, derivedVersionKey);
        }
      });
    }

    this.logger.log(`Initialized encryption with ${this.encryptionKeys.size} key versions`);
  }

  async encrypt(
    data: string | Record<string, any>,
    options: EncryptionOptions = {},
  ): Promise<EncryptionResult> {
    try {
      const keyVersion = options.keyVersion || this.currentKeyVersion;
      const algorithm = options.algorithm || this.algorithm;
      const encryptionKey = this.encryptionKeys.get(keyVersion);

      if (!encryptionKey) {
        throw new Error(`Encryption key version '${keyVersion}' not found`);
      }

      const plaintext = typeof data === "string" ? data : JSON.stringify(data);
      const iv = crypto.randomBytes(this.ivLength);

      const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv) as crypto.CipherGCM;

      if (options.additionalData) {
        cipher.setAAD(Buffer.from(options.additionalData, "utf8"));
      }

      let encrypted = cipher.update(plaintext, "utf8", "hex");
      encrypted += cipher.final("hex");

      const tag = cipher.getAuthTag();

      const result: EncryptionResult = {
        encryptedData: encrypted,
        iv: iv.toString("hex"),
        tag: tag.toString("hex"),
        algorithm,
        keyVersion,
      };

      this.logger.debug(`Successfully encrypted data with key version ${keyVersion}`);
      return result;
    } catch (error) {
      this.logger.error(`Encryption failed: ${error.message}`);
      throw new Error(`Encryption failed: ${error.message}`, { cause: error });
    }
  }

  async decrypt(encryptedResult: EncryptionResult, additionalData?: string): Promise<string> {
    try {
      const encryptionKey = this.encryptionKeys.get(encryptedResult.keyVersion);

      if (!encryptionKey) {
        throw new Error(`Encryption key version '${encryptedResult.keyVersion}' not found`);
      }

      const iv = Buffer.from(encryptedResult.iv, "hex");
      const tag = Buffer.from(encryptedResult.tag, "hex");

      const decipher = crypto.createDecipheriv(
        encryptedResult.algorithm,
        encryptionKey,
        iv,
      ) as crypto.DecipherGCM;

      decipher.setAuthTag(tag);

      if (additionalData) {
        decipher.setAAD(Buffer.from(additionalData, "utf8"));
      }

      let decrypted = decipher.update(encryptedResult.encryptedData, "hex", "utf8");
      decrypted += decipher.final("utf8");

      this.logger.debug(
        `Successfully decrypted data with key version ${encryptedResult.keyVersion}`,
      );
      return decrypted;
    } catch (error) {
      this.logger.error(`Decryption failed: ${error.message}`);
      throw new Error(`Decryption failed: ${error.message}`, { cause: error });
    }
  }

  async encryptProviderConfig(config: Record<string, any>): Promise<Record<string, any>> {
    if (!config || typeof config !== "object") {
      return config;
    }

    const encryptedConfig: Record<string, any> = {};

    for (const [key, value] of Object.entries(config)) {
      if (this.shouldEncryptField(key, value)) {
        try {
          encryptedConfig[key] = await this.encrypt(value, {
            additionalData: `provider_config_${key}`,
          });
        } catch (error) {
          this.logger.error(`Failed to encrypt provider config field '${key}': ${error.message}`);
          throw new Error(`Provider config encryption failed for field '${key}'`, { cause: error });
        }
      } else {
        encryptedConfig[key] = value;
      }
    }

    return encryptedConfig;
  }

  async decryptProviderConfig(config: Record<string, any>): Promise<Record<string, any>> {
    if (!config || typeof config !== "object") {
      return config;
    }

    const decryptedConfig: Record<string, any> = {};

    for (const [key, value] of Object.entries(config)) {
      if (this.isEncryptedValue(value)) {
        try {
          decryptedConfig[key] = await this.decrypt(value, `provider_config_${key}`);
        } catch (error) {
          this.logger.error(`Failed to decrypt provider config field '${key}': ${error.message}`);
          throw new Error(`Provider config decryption failed for field '${key}'`, { cause: error });
        }
      } else {
        decryptedConfig[key] = value;
      }
    }

    return decryptedConfig;
  }

  async hash(data: string, salt?: string): Promise<{ hash: string; salt: string }> {
    const actualSalt = salt || crypto.randomBytes(16).toString("hex");
    const hash = crypto.scryptSync(data, actualSalt, 64).toString("hex");

    return { hash, salt: actualSalt };
  }

  async verifyHash(data: string, hash: string, salt: string): Promise<boolean> {
    try {
      const computedHash = crypto.scryptSync(data, salt, 64).toString("hex");
      return crypto.timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(computedHash, "hex"));
    } catch (error) {
      this.logger.error(`Hash verification failed: ${error.message}`);
      return false;
    }
  }

  generateSecureToken(length: number = 32): string {
    return crypto.randomBytes(length).toString("hex");
  }

  generateApiKey(): { key: string; hash: string; prefix: string } {
    const key = `nk_${crypto.randomBytes(32).toString("hex")}`;
    const hash = crypto.createHash("sha256").update(key).digest("hex");
    const prefix = key.substring(0, 8);

    return { key, hash, prefix };
  }

  async rotateKeys(newKeyVersion: string, newKey: string): Promise<void> {
    try {
      const salt = crypto.randomBytes(32);
      const derivedKey = crypto.scryptSync(newKey, salt, this.keyLength);
      this.encryptionKeys.set(newKeyVersion, derivedKey);

      this.logger.log(`Added new encryption key version: ${newKeyVersion}`);
    } catch (error) {
      this.logger.error(`Key rotation failed: ${error.message}`);
      throw new Error(`Key rotation failed: ${error.message}`, { cause: error });
    }
  }

  async reencryptWithNewKey(
    encryptedResult: EncryptionResult,
    newKeyVersion: string,
    additionalData?: string,
  ): Promise<EncryptionResult> {
    const decryptedData = await this.decrypt(encryptedResult, additionalData);

    return this.encrypt(decryptedData, {
      keyVersion: newKeyVersion,
      additionalData,
    });
  }

  getEncryptionInfo(): {
    algorithm: string;
    keyLength: number;
    ivLength: number;
    tagLength: number;
    currentKeyVersion: string;
    availableKeyVersions: string[];
  } {
    return {
      algorithm: this.algorithm,
      keyLength: this.keyLength,
      ivLength: this.ivLength,
      tagLength: this.tagLength,
      currentKeyVersion: this.currentKeyVersion,
      availableKeyVersions: Array.from(this.encryptionKeys.keys()),
    };
  }

  static validateEncryptionKey(key: string): boolean {
    if (!key || typeof key !== "string") {
      return false;
    }
    return key.length >= 32;
  }

  static generateEncryptionKey(): string {
    return crypto.randomBytes(32).toString("hex");
  }

  private shouldEncryptField(fieldName: string, value: any): boolean {
    if (typeof value !== "string" && typeof value !== "object") {
      return false;
    }

    const sensitiveFields = [
      "accessKeyId",
      "secretAccessKey",
      "apiKey",
      "privateKey",
      "certificate",
      "password",
      "token",
      "accessToken",
      "refreshToken",
      "clientSecret",
      "webhookSecret",
      "encryptionKey",
      "signingKey",
      "credentials",
      "authToken",
      "bearerToken",
      "sessionToken",
      "oauthToken",
      "jwtSecret",
      "databasePassword",
      "redisPassword",
    ];

    const fieldLower = fieldName.toLowerCase();
    return sensitiveFields.some((sensitiveField) =>
      fieldLower.includes(sensitiveField.toLowerCase()),
    );
  }

  private isEncryptedValue(value: any): value is EncryptionResult {
    return (
      value &&
      typeof value === "object" &&
      typeof value.encryptedData === "string" &&
      typeof value.iv === "string" &&
      typeof value.tag === "string" &&
      typeof value.algorithm === "string" &&
      typeof value.keyVersion === "string"
    );
  }
}
