import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { TelnyxVoiceProvider } from "../providers/voice/providers/telnyx-voice.provider";
import { VoiceCallTrackingService } from "./voice-call-tracking.service";

export interface OutboundCallRequest {
  phoneNumber: string;
  message: string;
  voice?: {
    voice?: string; // Telnyx voice identifier like 'Telnyx.Natural.abbie'
    language?: string;
  };
  callerId?: string;
  maxDuration?: number;
  recordCall?: boolean;
}

export interface OutboundCallResponse {
  success: boolean;
  callId?: string;
  callControlId?: string;
  error?: string;
  cost?: number;
}

@Injectable()
export class VoiceService {
  private readonly logger = new Logger(VoiceService.name);

  constructor(
    private readonly telnyxVoiceProvider: TelnyxVoiceProvider,
    private readonly configService: ConfigService,
    private readonly voiceCallTrackingService: VoiceCallTrackingService,
  ) {
    this.logger.log("Using Telnyx voice provider with built-in TTS");
  }

  /**
   * Create an outbound voice call with TTS message using Telnyx
   */
  async createOutboundCall(
    request: OutboundCallRequest,
    tenantId: string,
  ): Promise<OutboundCallResponse> {
    try {
      this.logger.log(
        `Creating outbound call to ${request.phoneNumber} with message: "${request.message}"`,
      );

      // Create the call using Telnyx
      const result = await this.telnyxVoiceProvider.createCall(
        request.phoneNumber,
        request.message,
      );

      if (!result.success) {
        return {
          success: false,
          error: `Failed to create call: ${result.error}`,
        };
      }

      // Start call tracking for quota management
      if (result.callControlId) {
        await this.voiceCallTrackingService.startCall({
          tenantId,
          callControlId: result.callControlId,
          phoneNumber: request.phoneNumber,
          ttsMessage: request.message,
          metadata: {
            voice: request.voice,
            maxDuration: request.maxDuration,
            recordCall: request.recordCall,
            fromNumber: this.configService.get("TELNYX_FROM_NUMBER") || "",
          },
        });
      }

      this.logger.log(`Outbound call initiated: ${result.callId} -> ${request.phoneNumber}`);

      return {
        success: true,
        callId: result.callId,
        callControlId: result.callControlId,
        // Cost will be tracked by Telnyx billing
      };
    } catch (error) {
      this.logger.error(`Failed to create outbound call: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  // TTS message will be played automatically via webhook when call is answered

  /**
   * Get call status
   */
  async getCallStatus(callId: string) {
    try {
      // For now, return basic status - Telnyx webhooks would provide real status
      return {
        success: true,
        callId,
        status: "active",
        message: "Call status - use Telnyx webhooks for real-time status updates",
      };
    } catch (error) {
      this.logger.error(`Failed to get call status for ${callId}: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * End a call
   */
  async endCall(callControlId: string): Promise<{ success: boolean; error?: string }> {
    try {
      this.logger.log(`Ending call: ${callControlId}`);

      const result = await this.telnyxVoiceProvider.endCall(callControlId);

      if (result.success) {
        this.logger.log(`Call ${callControlId} ended successfully`);
      } else {
        this.logger.error(`Failed to end call ${callControlId}: ${result.error}`);
      }

      return result;
    } catch (error) {
      this.logger.error(`Failed to end call ${callControlId}: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send additional TTS message to active call
   */
  async sendTTSToCall(
    callControlId: string,
    message: string,
    voiceSettings?: OutboundCallRequest["voice"],
  ) {
    try {
      this.logger.log(`Sending TTS message to call ${callControlId}: ${message}`);

      const result = await this.telnyxVoiceProvider.sendTTS(
        callControlId,
        message,
        voiceSettings?.voice || "Telnyx.Natural.abbie",
      );

      if (result.success) {
        this.logger.log(`TTS message sent successfully to call ${callControlId}`);
      } else {
        this.logger.error(`Failed to send TTS message: ${result.error}`);
      }

      return result;
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
   * Get call statistics for tenant
   */
  async getCallStats(tenantId: string, startDate?: Date): Promise<any> {
    try {
      return await this.voiceCallTrackingService.getCallStats(tenantId, startDate);
    } catch (error) {
      this.logger.error(`Failed to get call stats: ${error.message}`, error.stack);
      throw error;
    }
  }

  /**
   * Get available voices from Telnyx
   */
  async getAvailableVoices(): Promise<{ success: boolean; voices?: any[]; error?: string }> {
    try {
      return await this.telnyxVoiceProvider.getAvailableVoices();
    } catch (error) {
      this.logger.error(`Failed to get available voices: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Validate voice service configuration
   */
  async validateConfiguration(): Promise<{
    telnyx: boolean;
    tts: boolean;
    overall: boolean;
  }> {
    const telnyxValid = await this.telnyxVoiceProvider.validateConfig();

    this.logger.log(`Telnyx Voice Provider: ${telnyxValid ? "✅" : "❌"}`);

    return {
      telnyx: telnyxValid,
      tts: telnyxValid, // TTS is built into Telnyx
      overall: telnyxValid,
    };
  }
}
