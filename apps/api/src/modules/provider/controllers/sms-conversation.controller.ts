import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { AuthGuard } from "../../auth/guards/jwt-auth.guard";
import { SMSConversationService } from "../services/sms-conversation.service";
import { SMSService } from "../services/sms.service";

export interface SendSMSRequest {
  to: string;
  message: string;
  from?: string;
  tenantId: string;
  metadata?: Record<string, any>;
}

export interface SendConversationMessageRequest {
  conversationId: string;
  message: string;
  tenantId: string;
  metadata?: Record<string, any>;
}

@ApiTags("SMS Conversation")
@ApiBearerAuth()
@UseGuards(AuthGuard)
@Controller("sms")
export class SMSConversationController {
  private readonly logger = new Logger(SMSConversationController.name);

  constructor(
    private readonly smsService: SMSService,
    private readonly conversationService: SMSConversationService,
  ) {}

  /**
   * Send a new SMS (starts a new conversation)
   */
  @Post("send")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send a new SMS (starts a new conversation)" })
  @ApiResponse({ status: 200, description: "SMS sent successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async sendSMS(@Body() request: SendSMSRequest) {
    try {
      this.logger.log(`Sending SMS to ${request.to}`);

      const result = await this.smsService.sendSMS({
        to: request.to,
        message: request.message,
        from: request.from,
        tenantId: request.tenantId,
        metadata: request.metadata,
      });

      return {
        success: result.success,
        messageId: result.messageId,
        provider: result.provider,
        cost: result.cost,
        error: result.error,
      };
    } catch (error) {
      this.logger.error(`Failed to send SMS: ${error.message}`);
      throw new BadRequestException("Failed to send SMS");
    }
  }

  /**
   * Send a message in an existing conversation (maintains provider continuity)
   */
  @Post("conversation/send")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send a message in an existing conversation" })
  @ApiResponse({ status: 200, description: "Message sent successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  async sendConversationMessage(@Body() request: SendConversationMessageRequest) {
    try {
      this.logger.log(`Sending conversation message: ${request.conversationId}`);

      const result = await this.conversationService.sendConversationMessage(
        request.conversationId,
        request.message,
        request.tenantId,
        request.metadata,
      );

      return result;
    } catch (error) {
      this.logger.error(`Failed to send conversation message: ${error.message}`);
      throw new BadRequestException("Failed to send conversation message");
    }
  }

  /**
   * Get conversation history
   */
  @Get("conversation/:conversationId/history")
  @ApiOperation({ summary: "Get conversation history" })
  @ApiResponse({ status: 200, description: "History retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  @ApiResponse({ status: 404, description: "Conversation not found" })
  async getConversationHistory(
    @Param("conversationId") conversationId: string,
    @Query("limit") limit?: number,
  ) {
    try {
      const history = await this.conversationService.getConversationHistory(
        conversationId,
        limit ? parseInt(limit.toString()) : 50,
      );

      return history;
    } catch (error) {
      this.logger.error(`Failed to get conversation history: ${error.message}`);
      throw new BadRequestException("Failed to get conversation history");
    }
  }

  /**
   * Get active conversations for a tenant
   */
  @Get("conversations")
  @ApiOperation({ summary: "Get active conversations for a tenant" })
  @ApiResponse({ status: 200, description: "Active conversations retrieved successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getActiveConversations(
    @Query("tenantId") tenantId: string,
    @Query("limit") limit?: number,
  ) {
    try {
      if (!tenantId) {
        throw new BadRequestException("tenantId is required");
      }

      const conversations = await this.conversationService.getActiveConversations(
        tenantId,
        limit ? parseInt(limit.toString()) : 100,
      );

      return {
        conversations,
        total: conversations.length,
      };
    } catch (error) {
      this.logger.error(`Failed to get active conversations: ${error.message}`);
      throw new BadRequestException("Failed to get active conversations");
    }
  }

  /**
   * Send bulk SMS messages
   */
  @Post("bulk-send")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Send bulk SMS messages" })
  @ApiResponse({ status: 200, description: "Bulk SMS sent successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async sendBulkSMS(@Body() request: { messages: SendSMSRequest[] }) {
    try {
      this.logger.log(`Sending bulk SMS: ${request.messages.length} messages`);

      const result = await this.smsService.sendBulkSMS(request.messages);

      return {
        successful: result.successful,
        failed: result.failed,
        total: request.messages.length,
        results: result.results,
      };
    } catch (error) {
      this.logger.error(`Failed to send bulk SMS: ${error.message}`);
      throw new BadRequestException("Failed to send bulk SMS");
    }
  }

  /**
   * Get SMS analytics for a tenant
   */
  @Get("analytics")
  @ApiOperation({ summary: "Get SMS analytics for a tenant" })
  @ApiResponse({ status: 200, description: "Analytics retrieved successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async getSMSAnalytics(
    @Query("tenantId") tenantId: string,
    @Query("startDate") startDate: string,
    @Query("endDate") endDate: string,
  ) {
    try {
      if (!tenantId || !startDate || !endDate) {
        throw new BadRequestException("tenantId, startDate, and endDate are required");
      }

      const analytics = await this.smsService.getSMSAnalytics(
        tenantId,
        new Date(startDate),
        new Date(endDate),
      );

      return analytics;
    } catch (error) {
      this.logger.error(`Failed to get SMS analytics: ${error.message}`);
      throw new BadRequestException("Failed to get SMS analytics");
    }
  }

  /**
   * Test SMS functionality
   */
  @Post("test")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: "Test SMS functionality" })
  @ApiResponse({ status: 200, description: "Test result retrieved successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 403, description: "Forbidden" })
  async testSMSFunctionality() {
    try {
      const result = await this.smsService.testSMSFunctionality();
      return result;
    } catch (error) {
      this.logger.error(`Failed to test SMS functionality: ${error.message}`);
      throw new BadRequestException("Failed to test SMS functionality");
    }
  }
}
