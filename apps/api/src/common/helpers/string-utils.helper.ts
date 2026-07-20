import * as crypto from 'crypto';

export class StringHelper {
  /**
   * Generate random token
   */
  static generateRandomToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
