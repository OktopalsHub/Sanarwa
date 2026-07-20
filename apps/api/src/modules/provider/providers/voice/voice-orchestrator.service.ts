import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  IVoiceProvider,
  VoiceCallPayload,
  VoiceCallResponse,
  TTSPayload,
  TTSResponse
} from './voice-provider.interface';
import { TelnyxVoiceProvider } from './providers/telnyx-voice.provider';

@Injectable()
export class VoiceOrchestratorService {
  private readonly logger = new Logger(VoiceOrchestratorService.name);

  constructor(
    private configService: ConfigService,
    private telnyxVoiceProvider: TelnyxVoiceProvider,
  ) { }

  /**
   * Create voice call using Telnyx
   */
  async createVoiceCall(phoneNumber: string, message?: string): Promise<{ success: boolean; callId?: string; error?: string }> {
    try {
      // Use Telnyx for voice calls
      if (await this.telnyxVoiceProvider.validateConfig()) {
        this.logger.debug(`Creating voice call via Telnyx to ${phoneNumber}`);
        const result = await this.telnyxVoiceProvider.createCall(phoneNumber, message);

        if (result.success) {
          this.logger.log(`Voice call created via Telnyx: ${result.callId}`);
          return {
            success: true,
            callId: result.callId,
          };
        } else {
          this.logger.error(`Telnyx voice call failed: ${result.error}`);
          return {
            success: false,
            error: result.error,
          };
        }
      } else {
        this.logger.error('Telnyx not configured');
        return {
          success: false,
          error: 'Telnyx voice provider not configured',
        };
      }
    } catch (error) {
      this.logger.error(`Voice call orchestration failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * End voice call using Telnyx
   */
  async endVoiceCall(callControlId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // End call on Telnyx
      if (await this.telnyxVoiceProvider.validateConfig()) {
        const result = await this.telnyxVoiceProvider.endCall(callControlId);
        if (result.success) {
          this.logger.log(`Voice call ended via Telnyx: ${callControlId}`);
          return { success: true };
        } else {
          return { success: false, error: result.error };
        }
      }

      return { success: false, error: 'Telnyx not configured' };
    } catch (error) {
      this.logger.error(`End voice call failed: ${error.message}`, error.stack);
      return { success: false, error: error.message };
    }
  }

  /**
   * Send TTS to call with Telnyx built-in TTS
   */
  async sendTTSToCall(callControlId: string, text: string, voice?: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      // Use Telnyx built-in TTS (much simpler and cheaper)
      if (await this.telnyxVoiceProvider.validateConfig()) {
        this.logger.debug(`Sending TTS to call via Telnyx: ${callControlId}`);
        const result = await this.telnyxVoiceProvider.sendTTS(callControlId, text, voice);

        if (result.success) {
          this.logger.log(`TTS sent to call via Telnyx: ${result.messageId}`);
          return {
            success: true,
            messageId: result.messageId,
          };
        } else {
          this.logger.error(`Telnyx TTS failed: ${result.error}`);
          return {
            success: false,
            error: result.error,
          };
        }
      }

      return {
        success: false,
        error: 'Telnyx TTS provider not available',
      };
    } catch (error) {
      this.logger.error(`Call TTS failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send TTS to multiple calls using Telnyx
   */
  async sendTTSToMultipleCalls(callControlIds: string[], text: string, voice?: string): Promise<{ success: boolean; results?: any[]; error?: string }> {
    try {
      // Use Telnyx built-in TTS for multiple calls
      if (await this.telnyxVoiceProvider.validateConfig()) {
        this.logger.debug(`Sending TTS to multiple calls via Telnyx`);
        
        const results = await Promise.all(
          callControlIds.map(callId => this.telnyxVoiceProvider.sendTTS(callId, text, voice))
        );

        const successful = results.filter(r => r.success);
        const failed = results.filter(r => !r.success);

        this.logger.log(`TTS sent to ${successful.length}/${callControlIds.length} calls`);
        
        return {
          success: successful.length > 0,
          results: results,
        };
      }

      return {
        success: false,
        error: 'Telnyx TTS provider not available',
      };
    } catch (error) {
      this.logger.error(`Multiple call TTS failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Send voice announcement (TTS) to a call
   */
  async sendVoiceAnnouncement(
    callControlId: string,
    text: string,
    options?: {
      voice?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<{ success: boolean; messageId?: string; error?: string }> {
    try {
      const result = await this.sendTTSToCall(
        callControlId, 
        text, 
        options?.voice || 'Telnyx.Natural.abbie'
      );

      this.logger.log(`Voice announcement sent to call ${callControlId}: ${result.messageId}`);
      return result;
    } catch (error) {
      this.logger.error(`Voice announcement failed: ${error.message}`, error.stack);
      return {
        success: false,
        error: error.message,
      };
    }
  }

  /**
   * Get provider status
   */
  async getProviderStatus(): Promise<{
    telnyxVoice: { available: boolean; healthy?: boolean };
  }> {
    const status = {
      telnyxVoice: { available: false, healthy: false },
    };

    try {
      status.telnyxVoice.available = await this.telnyxVoiceProvider.validateConfig();
      if (status.telnyxVoice.available) {
        status.telnyxVoice.healthy = true; // Could add actual health check
      }
    } catch (error) {
      this.logger.warn(`Telnyx voice status check failed: ${error.message}`);
    }

    return status;
  }

  /**
   * List active voice calls (placeholder)
   */
  async getActiveVoiceCalls(): Promise<string[]> {
    // In production, this would query Telnyx for active calls
    return [];
  }

  /**
   * Validate TTS providers configuration
   */
  async validateTTSProviders(): Promise<boolean> {
    try {
      // Telnyx has built-in TTS, so just validate Telnyx config
      return await this.telnyxVoiceProvider.validateConfig();
    } catch (error) {
      this.logger.error(`TTS providers validation failed: ${error.message}`);
      return false;
    }
  }

  /**
   * Get available voices from Telnyx
   */
  async getAvailableVoices(): Promise<{ success: boolean; voices?: any[]; error?: string }> {
    try {
      if (await this.telnyxVoiceProvider.validateConfig()) {
        this.logger.debug('Getting available voices from Telnyx');
        return await this.telnyxVoiceProvider.getAvailableVoices();
      }

      return {
        success: false,
        error: 'Telnyx provider is not configured',
      };
    } catch (error) {
      this.logger.error(`Get available voices failed: ${error.message}`);
      return {
        success: false,
        error: error.message,
      };
    }
  }
}
