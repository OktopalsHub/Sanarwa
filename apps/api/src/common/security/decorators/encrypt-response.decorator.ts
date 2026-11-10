import { SetMetadata } from "@nestjs/common";

export interface EncryptResponseOptions {
  fields?: string[];
  excludeFields?: string[];
  keyVersion?: string;
}

export const ENCRYPT_RESPONSE_KEY = "encrypt_response";

export const EncryptResponse = (options: EncryptResponseOptions = {}) =>
  SetMetadata(ENCRYPT_RESPONSE_KEY, options);
