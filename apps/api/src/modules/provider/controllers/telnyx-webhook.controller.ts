import {
  Controller,
  Post,
  Body,
  Headers,
  Logger,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Public } from '../../auth/decorators/public.decorator';
import { VoiceService } from '../services/voice.service';

interface TelnyxWebhookEvent {
  data: {
    event_type: string;
    id: string;
    occurred_at: string;
    payload: {
      call_control_id: string;
      call_leg_id: string;
      call_session_id: string;
      client_state?: string;
      connection_id: string;
      direction: string;
      from: string;
      to: string;
      state?: string;
      [key: string]: any;
    };
  };
}

@ApiTags('Telnyx Webhooks')
@Controller('webhooks/telnyx')
@Public()
export class TelnyxWebhookController {
  private readonly logger = new Logger(TelnyxWebhookController.name);

  constructor(private readonly voiceService: VoiceService) {}

  @Post('voice')
  @ApiOperation({ summary: 'Handle Telnyx voice webhooks' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  async handleVoiceWebhook(
    @Body() event: TelnyxWebhookEvent,
    @Headers('telnyx-signature-ed25519') signature?: string,
    @Headers('telnyx-timestamp') timestamp?: string,
  ) {
    try {
      this.logger.log(`Received Telnyx webhook: ${event.data.event_type} for call ${event.data.payload.call_control_id}`);

      const { event_type, payload } = event.data;

      switch (event_type) {
        case 'call.initiated':
          await this.handleCallInitiated(payload);
          break;
        
        case 'call.answered':
          await this.handleCallAnswered(payload);
          break;
        
        case 'call.hangup':
          await this.handleCallHangup(payload);
          break;
        
        case 'call.speak.started':
          this.logger.log(`TTS started for call ${payload.call_control_id}`);
          break;
        
        case 'call.speak.ended':
          this.logger.log(`TTS ended for call ${payload.call_control_id}`);
          break;
        
        default:
          this.logger.log(`Unhandled webhook event: ${event_type}`);
      }

      return { success: true, message: 'Webhook processed' };
    } catch (error) {
      this.logger.error(`Failed to process webhook: ${error.message}`, error.stack);
      throw new HttpException(
        'Failed to process webhook',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  private async handleCallInitiated(payload: any) {
    this.logger.log(`Call initiated: ${payload.call_control_id} from ${payload.from} to ${payload.to}`);
    // Track call initiation
  }

  private async handleCallAnswered(payload: any) {
    this.logger.log(`Call answered: ${payload.call_control_id}`);
    
    // Check if there's a TTS message to play
    const customHeaders = payload.custom_headers || [];
    const ttsHeader = customHeaders.find((h: any) => h.name === 'X-TTS-Message');
    
    if (ttsHeader) {
      try {
        const message = Buffer.from(ttsHeader.value, 'base64').toString('utf-8');
        this.logger.log(`Playing TTS message for answered call: "${message}"`);
        
        // Send TTS message to the call with default Telnyx voice
        await this.voiceService.sendTTSToCall(payload.call_control_id, message, {
          voice: 'Telnyx.Natural.abbie',
          language: 'en-US'
        });
      } catch (error) {
        this.logger.error(`Failed to play TTS message: ${error.message}`);
      }
    }
  }

  private async handleCallHangup(payload: any) {
    this.logger.log(`Call ended: ${payload.call_control_id} - ${payload.hangup_cause || 'unknown cause'}`);
    // Track call completion and duration
  }
}