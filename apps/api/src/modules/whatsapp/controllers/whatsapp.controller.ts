import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  Param,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeyAuthGuard } from '../../api-key/guards/api-key-auth.guard';
import { WhatsAppBusinessAPIService } from '../services/whatsapp-business-api.service';
import { WhatsAppEmbeddedSignupService } from '../services/whatsapp-embedded-signup.service';

export class SendWhatsAppMessageDto {
  to: string;
  message: string;
  templateId?: string;
  templateData?: Record<string, string>;
  tenantId?: string;
}

export class SendTemplateMessageDto {
  to: string;
  templateName: string;
  languageCode?: string;
  parameters?: Array<{
    type: string;
    text: string;
  }>;
}

@ApiTags('WhatsApp Messaging')
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly whatsappAPIService: WhatsAppBusinessAPIService,
    private readonly embeddedSignupService: WhatsAppEmbeddedSignupService,
  ) {}

  @Post('messages/send')
  @UseGuards(ApiKeyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send WhatsApp message using shared templates' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Message sent successfully',
  })
  async sendMessage(@Body() messageData: SendWhatsAppMessageDto) {
    // Validate phone number
    const phoneValidation = this.whatsappAPIService.validatePhoneNumber(
      messageData.to,
    );
    if (!phoneValidation.isValid) {
      throw new BadRequestException(phoneValidation.error);
    }

    if (messageData.templateId && messageData.templateData) {
      // For ESU pattern, each tenant uses their own WABA
      // This would need tenant-specific WABA lookup
      throw new BadRequestException(
        'Template messaging requires tenant-specific WABA setup via Embedded Signup',
      );
    } else {
      // Send simple text message
      return this.whatsappAPIService.sendTextMessage(
        phoneValidation.cleanNumber!,
        messageData.message,
      );
    }
  }

  @Post('messages/template')
  @UseGuards(ApiKeyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Send WhatsApp template message directly' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Template message sent successfully',
  })
  async sendTemplateMessage(@Body() templateData: SendTemplateMessageDto) {
    // Validate phone number
    const phoneValidation = this.whatsappAPIService.validatePhoneNumber(
      templateData.to,
    );
    if (!phoneValidation.isValid) {
      throw new BadRequestException(phoneValidation.error);
    }

    // Prepare components if parameters provided
    const components = templateData.parameters
      ? [
          {
            type: 'body',
            parameters: templateData.parameters,
          },
        ]
      : undefined;

    return this.whatsappAPIService.sendTemplateMessage(
      phoneValidation.cleanNumber!,
      templateData.templateName,
      templateData.languageCode || 'en',
      components,
    );
  }

  @Get('health')
  @ApiOperation({ summary: 'Check WhatsApp Business API health status' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Health status retrieved successfully',
  })
  async getHealthStatus() {
    return this.whatsappAPIService.getHealthStatus();
  }

  @Get('templates')
  @UseGuards(ApiKeyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List available WhatsApp templates' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Templates retrieved successfully',
  })
  async listTemplates() {
    return this.whatsappAPIService.listTemplates();
  }

  @Post('phone/validate')
  @ApiOperation({ summary: 'Validate WhatsApp phone number format' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Phone number validation result',
  })
  async validatePhoneNumber(@Body() data: { phoneNumber: string }) {
    return this.whatsappAPIService.validatePhoneNumber(data.phoneNumber);
  }

  @Get('pricing/:region')
  @ApiOperation({ summary: 'Get WhatsApp messaging pricing for region' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Pricing information retrieved successfully',
  })
  async getPricingInfo(@Param('region') region: string) {
    // WhatsApp Business API pricing by region (as of 2024)
    const pricingMap = {
      'north-america': {
        cost: 0.0055,
        currency: 'USD',
        region: 'North America',
      },
      europe: { cost: 0.0092, currency: 'USD', region: 'Europe' },
      'asia-pacific': { cost: 0.0108, currency: 'USD', region: 'Asia Pacific' },
      'latin-america': {
        cost: 0.0095,
        currency: 'USD',
        region: 'Latin America',
      },
      'middle-east-africa': {
        cost: 0.016,
        currency: 'USD',
        region: 'Middle East & Africa',
      },
      other: { cost: 0.016, currency: 'USD', region: 'Other Regions' },
    };

    const pricing = pricingMap[region.toLowerCase()] || pricingMap['other'];

    return {
      ...pricing,
      examples: {
        '1k_messages': (1000 * pricing.cost).toFixed(2),
        '10k_messages': (10000 * pricing.cost).toFixed(2),
        '100k_messages': (100000 * pricing.cost).toFixed(2),
      },
      lastUpdated: '2024-01-01',
      note: "Prices are subject to change. Check Meta's official pricing for latest rates.",
    };
  }

  @Get('stats/usage')
  @UseGuards(ApiKeyAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get WhatsApp usage statistics' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: 'Usage statistics retrieved successfully',
  })
  async getUsageStats() {
    // In ESU pattern, usage stats are per-tenant WABA
    return {
      message: 'Usage statistics are now per-tenant via Embedded Signup WABAs',
      recommendation:
        'Use /whatsapp/embedded-signup/status/:tenantId for tenant-specific stats',
    };
  }
}
