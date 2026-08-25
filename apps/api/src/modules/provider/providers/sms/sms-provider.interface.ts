export interface SMSPayload {
  to: string; // Phone number in E.164 format
  message: string;
  from?: string; // Sender ID or phone number
  metadata?: Record<string, any>;
}

export interface BulkSMSPayload {
  recipients: string[]; // Array of phone numbers in E.164 format
  message: string;
  from?: string; // Sender ID or phone number
  metadata?: Record<string, any>;
}

export interface SMSResponse {
  success: boolean;
  messageId?: string;
  cost?: number;
  error?: string;
  provider: string;
}

export interface BulkSMSResponse {
  success: boolean;
  results: Array<{
    recipient: string;
    messageId?: string;
    success: boolean;
    error?: string;
  }>;
  totalCost?: number;
  successCount: number;
  failureCount: number;
  provider: string;
}

export interface ISMSProvider {
  sendSMS(payload: SMSPayload): Promise<SMSResponse>;
  sendBulkSMS(payload: BulkSMSPayload): Promise<BulkSMSResponse>;
  validateConfig(): Promise<boolean>;
  getProviderName(): string;
  getSupportedCountries(): string[]; // ISO country codes
  getCostPerMessage(countryCode: string): number; // Cost in USD
}
