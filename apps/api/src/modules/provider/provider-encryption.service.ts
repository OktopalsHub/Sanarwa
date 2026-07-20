import { Injectable, Logger } from '@nestjs/common';
import { EncryptionService } from '../../common/security/services/encryption.service';

export interface EncryptionResult {
  encryptedData: string;
  iv: string;
  tag: string;
  algorithm: string;
  keyVersion: string;
}

@Injectable()
export class ProviderEncryptionService {
  private readonly logger = new Logger(ProviderEncryptionService.name);

  constructor(private readonly encryptionService: EncryptionService) {}

  /**
   * Encrypt sensitive provider configuration data
   */
  async encrypt(data: Record<string, any>): Promise<Record<string, any>> {
    return this.encryptionService.encryptProviderConfig(data);
  }

  /**
   * Decrypt sensitive provider configuration data
   */
  async decrypt(data: Record<string, any>): Promise<Record<string, any>> {
    return this.encryptionService.decryptProviderConfig(data);
  }

  /**
   * Encrypt a single value
   */
  async encryptValue(value: any): Promise<EncryptionResult> {
    return this.encryptionService.encrypt(value, {
      additionalData: 'provider_config_value',
    });
  }

  /**
   * Decrypt a single value
   */
  async decryptValue(encryptedValue: EncryptionResult): Promise<string> {
    return this.encryptionService.decrypt(
      encryptedValue,
      'provider_config_value',
    );
  }

  /**
   * Generate a new encryption key
   */
  static generateEncryptionKey(): string {
    return EncryptionService.generateEncryptionKey();
  }

  /**
   * Validate encryption key format
   */
  static validateEncryptionKey(key: string): boolean {
    return EncryptionService.validateEncryptionKey(key);
  }

  /**
   * Verify data integrity
   */
  async verifyIntegrity(data: Record<string, any>): Promise<boolean> {
    try {
      // Try to decrypt all encrypted fields
      await this.decrypt(data);
      return true;
    } catch (error) {
      this.logger.warn(`Data integrity check failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get encryption metadata
   */
  getEncryptionInfo() {
    return this.encryptionService.getEncryptionInfo();
  }
}
