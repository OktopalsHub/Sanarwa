export interface ChatAttachment {
  url: string;
  type: "image" | "file" | "video";
  filename?: string;
}

export interface ChatPayload {
  channel: string;
  message: string;
  subject?: string;
  attachments?: ChatAttachment[];
  blocks?: unknown[];
  embeds?: unknown[];
  metadata?: Record<string, any>;
}

export interface ChatResponse {
  success: boolean;
  messageId?: string;
  timestamp?: string;
  error?: string;
  provider: string;
  retryable?: boolean;
  invalidDestination?: boolean;
}

export interface IChatProvider {
  sendMessage(payload: ChatPayload): Promise<ChatResponse>;
  validateConfig(config?: unknown): Promise<boolean>;
  getProviderName(): string;
}
