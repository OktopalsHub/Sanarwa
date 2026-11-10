export interface SMSPayload {
  to: string;
  message: string;
  from?: string;
  metadata?: Record<string, any>;
}

export interface BulkSMSPayload {
  recipients: string[];
  message: string;
  from?: string;
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
  validateConfig(config?: unknown): Promise<boolean>;
  getProviderName(): string;
  getSupportedCountries(): string[];
  getCostPerMessage(countryCode: string): number;
}
