export interface VoiceSettings {
  language: string;    // 'en-US', 'en-GB', 'es-ES', etc.
  gender?: 'male' | 'female'; // Optional for backward compatibility
  name?: string;       // Specific voice name
  speed?: number;      // 0.5 (slow) to 2.0 (fast) - Optional for Telnyx
  pitch?: number;      // 0.5 (low) to 2.0 (high) - Optional for Telnyx
  quality?: 'standard' | 'premium' | 'neural';
  voice?: string;      // Telnyx voice identifier like 'Telnyx.Natural.abbie'
}

export interface TTSPayload {
  text: string;
  voice?: VoiceSettings; // Optional for simpler usage
  outputFormat?: 'mp3' | 'wav' | 'ogg';
  sampleRate?: number;
  metadata?: Record<string, any>;
  participants?: string[];
  priority?: 'low' | 'normal' | 'high';
  roomId?: string;
}

export interface TTSResponse {
  success: boolean;
  audioUrl?: string;
  audioBuffer?: Buffer;
  duration?: number; // in seconds
  characterCount?: number;
  cost?: number; // in USD
  provider: string;
  error?: string;
  metadata?: Record<string, any>;
  messageId?: string;
  deliveredTo?: string[];
  failedDeliveries?: string[];
}

export interface VoiceCallPayload {
  roomId?: string;
  participants: string[];
  callType: 'voice_only' | 'video_call';
  initiatorId: string;
  maxDuration?: number; // in seconds
  recordCall?: boolean;
  metadata?: Record<string, any>;
}

export interface VoiceCallResponse {
  success: boolean;
  roomId?: string;
  roomUrl?: string;
  accessTokens?: Record<string, string>; // participant -> token
  cost?: number; // per minute
  provider: string;
  error?: string;
  metadata?: Record<string, any>;
}

export interface ITTSProvider {
  generateTTS(payload: TTSPayload): Promise<TTSResponse>;
  validateConfig(): Promise<boolean>;
  getProviderName(): string;
  getSupportedLanguages(): string[];
  getSupportedVoices(language: string): string[];
  getCostPerCharacter(quality?: string): number;
}

export interface IVoiceProvider {
  createCall(phoneNumber: string, message?: string): Promise<{ success: boolean; callId?: string; callControlId?: string; error?: string }>;
  endCall(callControlId: string): Promise<{ success: boolean; error?: string }>;
  sendTTS(callControlId: string, text: string, voice?: string): Promise<{ success: boolean; messageId?: string; characterCount?: number; error?: string }>;
  getAvailableVoices(): Promise<{ success: boolean; voices?: any[]; error?: string }>;
  validateConfig(): Promise<boolean>;
  getProviderName(): string;
}