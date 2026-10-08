import {
  Body,
  Controller,
  Delete,
  Get,
  Req,
  UnauthorizedException,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { ApiBearerAuth, ApiHeader, ApiOperation, ApiResponse, ApiTags } from "@nestjs/swagger";
import { CurrentTenantId } from "../../common/decorators/current-context.decorator";
import { TenantMemberGuard } from "../../common/guards";
import { ApiKeyAuthGuard } from "../api-key/guards/api-key-auth.guard";
import { Public } from "../auth/decorators/public.decorator";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import {
  BulkNotificationResponseDto,
  NotificationResponseDto,
  NotificationStatusDto,
} from "./dto/notification-response.dto";
import { BulkMessageDto, SendMessageDto } from "./dto/send-message.dto";
import { MessagingService } from "./messaging.service";

@ApiTags("messaging")
@Controller("messaging")
export class MessagingController {
  constructor(private readonly messagingService: MessagingService) {}

  @Post("send")
  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @ApiOperation({ summary: "Send a single message (SDK)" })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  @ApiResponse({
    status: 201,
    description: "Message sent successfully",
    type: NotificationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Invalid message data",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  async sendMessage(
    @Body() sendMessageDto: SendMessageDto,
    @Req() req: { apiKey?: { tenantId?: string; projectId?: string } },
  ) {
    const tenantId = req.apiKey?.tenantId;
    const projectId = req.apiKey?.projectId;
    if (!tenantId || !projectId) {
      throw new UnauthorizedException("API key is missing tenant or project");
    }

    return this.messagingService.sendMessage(
      {
        ...sendMessageDto,
        metadata: { ...sendMessageDto.metadata, projectId },
      },
      tenantId,
    );
  }

  @Post("send-bulk")
  @Public()
  @UseGuards(ApiKeyAuthGuard)
  @ApiOperation({ summary: "Send multiple messages in bulk (SDK)" })
  @ApiHeader({ name: "X-API-Key", description: "API Key for authentication", required: true })
  @ApiHeader({ name: "X-Tenant", description: "Tenant ID", required: false })
  @ApiResponse({
    status: 201,
    description: "Bulk messages sent successfully",
    type: BulkNotificationResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Invalid bulk message data",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized - Invalid or missing API key",
  })
  async sendBulkMessages(
    @Body() bulkMessageDto: BulkMessageDto,
    @Req() req: { apiKey?: { tenantId?: string; projectId?: string } },
  ) {
    const tenantId = req.apiKey?.tenantId;
    const projectId = req.apiKey?.projectId;
    if (!tenantId || !projectId) {
      throw new UnauthorizedException("API key is missing tenant or project");
    }

    return this.messagingService.sendBulkMessages(
      {
        ...bulkMessageDto,
        messages: bulkMessageDto.messages.map((message) => ({
          ...message,
          metadata: { ...message.metadata, projectId },
        })),
      },
      tenantId,
    );
  }

  @Get()
  @UseGuards(AuthGuard, TenantMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get messages with pagination" })
  @ApiResponse({
    status: 200,
    description: "Messages retrieved",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async getMessages(@Query() query: any, @CurrentTenantId() tenantId?: string) {
    return this.messagingService.getTenantMessages(query, tenantId);
  }

  @Get("stats/delivery")
  @UseGuards(AuthGuard, TenantMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get delivery statistics" })
  @ApiResponse({
    status: 200,
    description: "Delivery stats retrieved",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  async getDeliveryStats(@Query() query: any, @CurrentTenantId() tenantId?: string) {
    return this.messagingService.getDeliveryStats(query, tenantId);
  }

  @Get(":id/status")
  @UseGuards(AuthGuard, TenantMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get message status" })
  @ApiResponse({
    status: 200,
    description: "Message status retrieved",
    type: NotificationStatusDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Message not found",
  })
  async getMessageStatus(@Param("id") messageId: string, @CurrentTenantId() tenantId?: string) {
    return this.messagingService.getMessageStatus(messageId, tenantId);
  }

  @Get(":id/deliveries")
  @UseGuards(AuthGuard, TenantMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get message delivery reports" })
  @ApiResponse({
    status: 200,
    description: "Delivery reports retrieved",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Message not found",
  })
  async getDeliveryReports(@Param("id") messageId: string, @CurrentTenantId() tenantId?: string) {
    return this.messagingService.getDeliveryReports(messageId, tenantId);
  }

  @Get(":id")
  @UseGuards(AuthGuard, TenantMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Get message log detail" })
  @ApiResponse({ status: 200, description: "Message detail retrieved" })
  @ApiResponse({ status: 404, description: "Message not found" })
  async getMessageDetail(@Param("id") messageId: string, @CurrentTenantId() tenantId?: string) {
    return this.messagingService.getMessageDetail(messageId, tenantId);
  }

  @Delete(":id")
  @UseGuards(AuthGuard, TenantMemberGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: "Cancel a scheduled message" })
  @ApiResponse({
    status: 200,
    description: "Message cancelled successfully",
  })
  @ApiResponse({
    status: 400,
    description: "Bad Request - Message already sent or cannot be cancelled",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 404,
    description: "Message not found",
  })
  async cancelMessage(@Param("id") messageId: string, @CurrentTenantId() tenantId?: string) {
    return this.messagingService.cancelMessage(messageId, tenantId);
  }
}
