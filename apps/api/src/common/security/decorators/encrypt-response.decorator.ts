import { SetMetadata } from '@nestjs/common';

export interface EncryptResponseOptions {
  fields?: string[]; // Specific fields to encrypt, if not provided, encrypt entire response
  excludeFields?: string[]; // Fields to exclude from encryption
  keyVersion?: string; // Encryption key version to use
}

export const ENCRYPT_RESPONSE_KEY = 'encrypt_response';

export const EncryptResponse = (options: EncryptResponseOptions = {}) =>
  SetMetadata(ENCRYPT_RESPONSE_KEY, options);
