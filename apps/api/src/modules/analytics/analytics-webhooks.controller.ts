import {
  Body,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Controller,
  UseGuards,
} from "@nestjs/common";
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiResponse } from "@nestjs/swagger";
import { CurrentTenantId } from "src/common/decorators";
import { TenantContextGuard } from "src/common/guards";
import { AuthGuard } from "../auth/guards/jwt-auth.guard";
import { WebhookService } from "./webhook.service";
import { RegisterWebhookDto } from "./dto/webhook-config.dto";

@ApiTags("Analytics")
@ApiBearerAuth()
@Controller("analytics")
@UseGuards(AuthGuard, TenantContextGuard)
export class AnalyticsWebhooksController {
  constructor(private readonly webhookService: WebhookService) {}

  /**
   * Register webhook configuration
   */
  /**
   * Register webhook configuration
   */
  @Post("webhooks")
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: "Register a new webhook" })
  @ApiResponse({ status: 201, description: "Webhook registered successfully" })
  @ApiResponse({ status: 400, description: "Bad Request" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async registerWebhook(@CurrentTenantId() tenantId: string, @Body() dto: RegisterWebhookDto) {
    const config = {
      url: dto.url,
      secret: dto.secret,
      headers: dto.headers,
      retryAttempts: dto.retryAttempts,
      timeout: dto.timeout,
    };

    this.webhookService.registerWebhook(tenantId, config);

    return {
      message: "Webhook registered successfully",
      tenantId,
      url: dto.url,
    };
  }

  /**
   * Remove webhook configuration
   */
  /**
   * Remove webhook configuration
   */
  @Delete("webhooks/:tenantId")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: "Remove webhook configuration" })
  @ApiParam({ name: "tenantId", description: "Tenant ID" })
  @ApiResponse({ status: 204, description: "Webhook removed successfully" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Webhook configuration not found" })
  async removeWebhook(@CurrentTenantId() tenantId: string) {
    this.webhookService.removeWebhook(tenantId);
  }

  /**
   * Test webhook configuration
   */
  /**
   * Test webhook configuration
   */
  @Post("webhooks/:tenantId/test")
  @ApiOperation({ summary: "Test webhook configuration" })
  @ApiParam({ name: "tenantId", description: "Tenant ID" })
  @ApiResponse({ status: 200, description: "Webhook test executed" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  @ApiResponse({ status: 404, description: "Webhook configuration not found" })
  async testWebhook(@CurrentTenantId() tenantId: string) {
    const success = await this.webhookService.testWebhook(tenantId);
    return {
      success,
      message: success ? "Webhook test successful" : "Webhook test failed",
    };
  }

  /**
   * Get webhook configuration
   */
  /**
   * Get webhook configuration
   */
  @Get("webhooks/:tenantId")
  @ApiOperation({ summary: "Get webhook configuration" })
  @ApiParam({ name: "tenantId", description: "Tenant ID" })
  @ApiResponse({ status: 200, description: "Webhook configuration retrieved" })
  @ApiResponse({ status: 401, description: "Unauthorized" })
  async getWebhookConfig(@CurrentTenantId() tenantId: string) {
    const config = this.webhookService.getWebhookConfig(tenantId);
    if (!config) {
      return { configured: false };
    }

    return {
      configured: true,
      url: config.url,
      retryAttempts: config.retryAttempts,
      timeout: config.timeout,
      // Don't expose secret or headers for security
    };
  }
}
