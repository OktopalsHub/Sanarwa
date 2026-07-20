export interface ChatPayload {
  channel: string;
  message: string;
  attachments?: Array<{
    url: string;
    type: 'image' | 'file' | 'video';
    filename?: string;
  }>;
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  success: boolean;
  messageId?: string;
  timestamp?: string;
  error?: string;
  provider: string;
}

export interface IChatProvider {
  sendMessage(payload: ChatPayload): Promise<ChatResponse>;
  validateConfig(): Promise<boolean>;
  getProviderName(): string;
}