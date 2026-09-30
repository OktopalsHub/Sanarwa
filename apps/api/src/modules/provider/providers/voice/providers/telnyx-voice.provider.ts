import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
const Telnyx = require("telnyx");

export interface TelnyxCallResult {
  success: boolean;
  callId?: string;
  callControlId?: string;
  error?: string;
}

export interface TelnyxTTSResult {
  success: boolean;
  messageId?: string;
  characterCount?: number;
  error?: string;
}

@Injectable()
export class TelnyxVoiceProvider {
  private readonly logger = new Logger(TelnyxVoiceProvider.name);
  private readonly client: any;
  private readonly fromNumber: string;
  private readonly connectionId: string;
  private readonly webhookUrl: string;

  constructor(private configService: ConfigService) {
    const apiKey = this.configService.get("TELNYX_API_KEY") || "";
    this.fromNumber = this.configService.get("TELNYX_FROM_NUMBER") || "";
    this.connectionId = this.configService.get("TELNYX_CONNECTION_ID") || "";
    this.webhookUrl = this.configService.get("TELNYX_WEBHOOK_URL") || "";

    // Initialize Telnyx client
    this.client = new Telnyx(apiKey);
    this.logger.log("Telnyx Voice Provider initialized");
  }

  /**
   * Create an outbound call using Telnyx
   */
  async createCall(phoneNumber: string, message?: string): Promise<TelnyxCallResult> {
    try {
      this.logger.log(`Creating call to ${phoneNumber}`);

      // Create call using Telnyx SDK
      const response = await this.client.calls.create({
        connection_id: this.connectionId,
        to: phoneNumber,
        from: this.fromNumber,
        webhook_url: this.webhookUrl,
        ...(message && {
          // Store message in custom headers to be used when call is answered
          custom_headers: [
            {
              name: "X-TTS-Message",
              value: Buffer.from(message).toString("base64"),
            },
          ],
        }),
      });

      this.logger.log(`Call created successfully: ${response.data.call_control_id}`);

      return {
        success: true,
        callId: response.data.call_control_id,
        callControlId: response.data.call_control_id,
      };
    } catch (error) {
      this.logger.error(`Failed to create call: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * End a call using Telnyx
   */
  async endCall(callControlId: string): Promise<{ success: boolean; error?: string }> {
    try {
      await this.client.callCommands(callControlId).hangup();
      this.logger.log(`Call ${callControlId} ended successfully`);
      return { success: true };
    } catch (error) {
      this.logger.error(`Failed to end call ${callControlId}: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send TTS to an active call using Telnyx
   */
  async sendTTS(callControlId: string, text: string, voice?: string): Promise<TelnyxTTSResult> {
    try {
      this.logger.log(`Sending TTS to call ${callControlId}: "${text}"`);

      // Use Telnyx SDK speak command
      const response = await this.client.callCommands(callControlId).speak({
        payload: text,
        voice: voice || "Telnyx.Natural.abbie",
      });

      const characterCount = text.length;
      this.logger.log(`TTS sent successfully to call ${callControlId}`);

      return {
        success: true,
        characterCount,
        messageId: response.data?.command_id,
      };
    } catch (error) {
      this.logger.error(
        `Failed to send TTS to call ${callControlId}: ${error.message}`,
        error.stack,
      );
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get available voices from Telnyx API
   */
  async getAvailableVoices(): Promise<{ success: boolean; voices?: any[]; error?: string }> {
    try {
      this.logger.log("Fetching available voices from Telnyx API");

      const response = await fetch("https://api.telnyx.com/v2/ai/text_to_speech/voices", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.client.apiKey}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const result = (await response.json()) as { errors?: { detail: string }[] };
        throw new Error(
          `Failed to fetch voices: ${result.errors?.[0]?.detail || response.statusText}`,
        );
      }

      const result = (await response.json()) as { data?: any[] };
      this.logger.log(`Retrieved ${result.data?.length || 0} voices from Telnyx`);

      return {
        success: true,
        voices: result.data || [],
      };
    } catch (error) {
      this.logger.error(`Failed to get available voices: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate configuration
   */
  async validateConfig(): Promise<boolean> {
    return !!(this.client && this.fromNumber && this.connectionId);
  }

  /**
   * Get provider name
   */
  getProviderName(): string {
    return "telnyx";
  }
}
