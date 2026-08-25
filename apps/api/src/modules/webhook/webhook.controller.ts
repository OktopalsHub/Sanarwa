import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { TenantMemberGuard } from "src/common/guards";
import { CreateWebhookDto, UpdateWebhookDto, WebhookResponseDto } from "./dto";
import { WebhookService } from "./webhook.service";

@ApiTags("Webhooks")
@ApiBearerAuth()
@UseGuards(TenantMemberGuard)
@Controller("tenants/:tenantId/webhooks")
export class WebhookController {
  constructor(private readonly webhookService: WebhookService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: "Create a new webhook",
    description: "Create a webhook configuration for the tenant",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiCreatedResponse({
    description: "Webhook created successfully",
    type: WebhookResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input or webhook URL already exists",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User is not a member of this tenant",
  })
  async create(
    @Param("tenantId") tenantId: string,
    @Body() createWebhookDto: CreateWebhookDto,
  ): Promise<WebhookResponseDto> {
    const webhook = await this.webhookService.create(tenantId, createWebhookDto);
    return this.mapToResponseDto(webhook);
  }

  @Get()
  @ApiOperation({
    summary: "Get all webhooks for tenant",
    description: "Retrieve all webhook configurations for the tenant",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiResponse({
    status: 200,
    description: "Webhooks retrieved successfully",
    type: [WebhookResponseDto],
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User is not a member of this tenant",
  })
  async findAll(@Param("tenantId") tenantId: string): Promise<WebhookResponseDto[]> {
    const webhooks = await this.webhookService.findAll(tenantId);
    return webhooks.map((webhook) => this.mapToResponseDto(webhook));
  }

  @Get(":id")
  @ApiOperation({
    summary: "Get webhook by ID",
    description: "Retrieve a specific webhook configuration",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Webhook unique identifier",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({
    status: 200,
    description: "Webhook retrieved successfully",
    type: WebhookResponseDto,
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User is not a member of this tenant",
  })
  @ApiResponse({
    status: 404,
    description: "Webhook not found",
  })
  async findOne(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
  ): Promise<WebhookResponseDto> {
    const webhook = await this.webhookService.findOne(tenantId, id);
    return this.mapToResponseDto(webhook);
  }

  @Patch(":id")
  @ApiOperation({
    summary: "Update webhook",
    description: "Update webhook configuration",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Webhook unique identifier",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({
    status: 200,
    description: "Webhook updated successfully",
    type: WebhookResponseDto,
  })
  @ApiResponse({
    status: 400,
    description: "Invalid input",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User is not a member of this tenant",
  })
  @ApiResponse({
    status: 404,
    description: "Webhook not found",
  })
  async update(
    @Param("tenantId") tenantId: string,
    @Param("id") id: string,
    @Body() updateWebhookDto: UpdateWebhookDto,
  ): Promise<WebhookResponseDto> {
    const webhook = await this.webhookService.update(tenantId, id, updateWebhookDto);
    return this.mapToResponseDto(webhook);
  }

  @Delete(":id")
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: "Delete webhook",
    description: "Delete webhook configuration",
  })
  @ApiParam({
    name: "tenantId",
    description: "Tenant unique identifier",
    example: "123e4567-e89b-12d3-a456-426614174000",
  })
  @ApiParam({
    name: "id",
    description: "Webhook unique identifier",
    example: "550e8400-e29b-41d4-a716-446655440000",
  })
  @ApiResponse({
    status: 204,
    description: "Webhook deleted successfully",
  })
  @ApiResponse({
    status: 401,
    description: "Unauthorized",
  })
  @ApiResponse({
    status: 403,
    description: "Forbidden - User is not a member of this tenant",
  })
  @ApiResponse({
    status: 404,
    description: "Webhook not found",
  })
  async remove(@Param("tenantId") tenantId: string, @Param("id") id: string): Promise<void> {
    await this.webhookService.remove(tenantId, id);
  }

  private mapToResponseDto(webhook: any): WebhookResponseDto {
    return {
      id: webhook.id,
      name: webhook.name,
      url: webhook.url,
      events: webhook.events,
      active: webhook.active,
      createdAt: webhook.createdAt,
      updatedAt: webhook.updatedAt,
    };
  }
}
