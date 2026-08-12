import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  HttpException,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiHeader, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../api-key/guards/api-key-auth.guard';
import { Public } from '../../auth/decorators/public.decorator';
import { OutboundCallRequest, VoiceService } from '../services/voice.service';

@ApiTags('Voice')
@Controller('voice')
@Public()
@UseGuards(ApiKeyAuthGuard)
export class VoiceController {
  private readonly logger = new Logger(VoiceController.name);

  constructor(private readonly voiceService: VoiceService) { }

  @Post('calls/outbound')
  @ApiOperation({ summary: 'Create an outbound voice call with TTS message (SDK)' })
  @ApiResponse({ status: 201, description: 'Call created successfully' })
  @ApiResponse({ status: 400, description: 'Invalid request data' })
  @ApiResponse({ status: 500, description: 'Internal server error' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication', required: true })
  @ApiHeader({ name: 'X-Tenant', description: 'Tenant ID', required: true })
  async createOutboundCall(@Body() request: OutboundCallRequest, @Headers('x-tenant') tenantId: string) {
    try {
      this.logger.log(`Creating outbound call to ${request.phoneNumber}`);

      // Validate required fields
      if (!request.phoneNumber || !request.message) {
        throw new HttpException(
          'Phone number and message are required',
          HttpStatus.BAD_REQUEST,
        );
      }

      // Validate phone number format (basic validation)
      const phoneRegex = /^\+[1-9]\d{1,14}$/;
      if (!phoneRegex.test(request.phoneNumber)) {
        throw new HttpException(
          'Invalid phone number format. Use international format (+1234567890)',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.voiceService.createOutboundCall(request, tenantId);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to create outbound call',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        data: {
          callId: result.callId,
          callControlId: result.callControlId,
          cost: result.cost,
        },
        message: 'Outbound call created successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to create outbound call: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('calls/:callId/status')
  @ApiOperation({ summary: 'Get call status and information' })
  @ApiResponse({ status: 200, description: 'Call status retrieved successfully' })
  @ApiResponse({ status: 404, description: 'Call not found' })
  async getCallStatus(@Param('callId') callId: string) {
    try {
      const result = await this.voiceService.getCallStatus(callId);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Call not found',
          HttpStatus.NOT_FOUND,
        );
      }

      return {
        success: true,
        data: result,
        message: 'Call status retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to get call status: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Delete('calls/:callId')
  @ApiOperation({ summary: 'End an active call' })
  @ApiResponse({ status: 200, description: 'Call ended successfully' })
  @ApiResponse({ status: 404, description: 'Call not found' })
  async endCall(@Param('callId') callId: string) {
    try {
      const result = await this.voiceService.endCall(callId);

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to end call',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        message: 'Call ended successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to end call: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('calls/:callId/tts')
  @ApiOperation({ summary: 'Send additional TTS message to an active call' })
  @ApiResponse({ status: 200, description: 'TTS message sent successfully' })
  @ApiResponse({ status: 404, description: 'Call not found' })
  async sendTTSToCall(
    @Param('callId') callId: string,
    @Body() body: { message: string; voice?: OutboundCallRequest['voice'] },
  ) {
    try {
      if (!body.message) {
        throw new HttpException(
          'Message is required',
          HttpStatus.BAD_REQUEST,
        );
      }

      const result = await this.voiceService.sendTTSToCall(
        callId,
        body.message,
        body.voice,
      );

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to send TTS message',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        message: 'TTS message sent successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to send TTS to call: ${error.message}`, error.stack);

      if (error instanceof HttpException) {
        throw error;
      }

      throw new HttpException(
        'Internal server error',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('voices')
  @ApiOperation({ summary: 'Get available Telnyx voices' })
  @ApiResponse({ status: 200, description: 'Available voices retrieved successfully' })
  async getAvailableVoices() {
    try {
      const result = await this.voiceService.getAvailableVoices();

      if (!result.success) {
        throw new HttpException(
          result.error || 'Failed to get available voices',
          HttpStatus.INTERNAL_SERVER_ERROR,
        );
      }

      return {
        success: true,
        data: {
          voices: result.voices,
          defaultVoice: 'Telnyx.Natural.abbie',
          note: 'Use voice identifiers like "Telnyx.Natural.abbie" in your requests'
        },
        message: 'Available voices retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to get available voices: ${error.message}`, error.stack);

      throw new HttpException(
        'Failed to get available voices',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('customization/options')
  @ApiOperation({ summary: 'Get voice customization options' })
  @ApiResponse({ status: 200, description: 'Voice customization options retrieved' })
  async getVoiceCustomizationOptions() {
    try {
      // Get customization options supported by Telnyx
      const options = {
        languages: [
          'en-US', 'en-GB', 'en-AU', 'en-CA',
          'es-ES', 'es-MX', 'es-US',
          'fr-FR', 'fr-CA',
          'de-DE',
          'it-IT',
          'pt-BR',
          'ja-JP',
          'zh-CN',
          'nl-NL',
          'ru-RU',
        ],
        defaultVoice: 'Telnyx.Natural.abbie',
        note: 'Voice calls use Telnyx TTS. Use /voice/voices endpoint to get full list of available voices.'
      };

      return {
        success: true,
        data: options,
        message: 'Voice customization options retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to get voice customization options: ${error.message}`, error.stack);

      throw new HttpException(
        'Failed to get voice customization options',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get('health')
  @ApiOperation({ summary: 'Check voice service health' })
  @ApiResponse({ status: 200, description: 'Voice service health status' })
  async getHealthStatus() {
    try {
      const config = await this.voiceService.validateConfiguration();

      return {
        success: true,
        data: {
          status: config.overall ? 'healthy' : 'unhealthy',
          provider: 'telnyx',
          providers: {
            telnyx: config.telnyx ? 'connected' : 'disconnected',
            tts: config.tts ? 'connected' : 'disconnected',
          },
          timestamp: new Date().toISOString(),
        },
        message: 'Voice service health check completed',
      };
    } catch (error) {
      this.logger.error(`Health check failed: ${error.message}`, error.stack);

      return {
        success: false,
        data: {
          status: 'unhealthy',
          error: error.message,
          timestamp: new Date().toISOString(),
        },
        message: 'Voice service health check failed',
      };
    }
  }



  @Get('usage/stats')
  @ApiOperation({ summary: 'Get voice usage statistics' })
  @ApiResponse({ status: 200, description: 'Voice usage stats retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication', required: true })
  @ApiHeader({ name: 'X-Tenant', description: 'Tenant ID', required: true })
  async getVoiceUsageStats(@Headers('x-tenant') tenantId: string, @Query('days') days?: string) {
    try {
      const daysBack = parseInt(days || '30');
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - daysBack);

      // Get call stats from tracking service
      const stats = await this.voiceService.getCallStats(tenantId, startDate);

      return {
        success: true,
        data: {
          period: `${daysBack} days`,
          ...stats,
        },
        message: 'Voice usage stats retrieved successfully',
      };
    } catch (error) {
      this.logger.error(`Failed to get voice usage stats: ${error.message}`, error.stack);

      throw new HttpException(
        'Failed to get voice usage stats',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post('test/call')
  @ApiOperation({ summary: 'Test outbound call functionality' })
  @ApiResponse({ status: 200, description: 'Test call completed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiHeader({ name: 'X-API-Key', description: 'API Key for authentication', required: true })
  @ApiHeader({ name: 'X-Tenant', description: 'Tenant ID', required: true })
  async testCall(@Body() body: { phoneNumber: string; message?: string }, @Headers('x-tenant') tenantId: string) {
    try {
      const testMessage = body.message || 'This is a test call from Sanarwa notification platform. Thank you for testing our voice service.';

      const result = await this.voiceService.createOutboundCall({
        phoneNumber: body.phoneNumber,
        message: testMessage,
        voice: {
          voice: 'Telnyx.Natural.abbie',
          language: 'en-US',
        },
        maxDuration: 120, // 2 minutes for test
        recordCall: false,
      }, tenantId);

      return {
        success: result.success,
        data: result.success ? {
          callId: result.callId,
          callControlId: result.callControlId,
          cost: result.cost,
          message: 'Test call initiated successfully',
        } : null,
        error: result.error,
        message: result.success ? 'Test call created successfully' : 'Test call failed',
      };
    } catch (error) {
      this.logger.error(`Test call failed: ${error.message}`, error.stack);

      throw new HttpException(
        'Test call failed',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}