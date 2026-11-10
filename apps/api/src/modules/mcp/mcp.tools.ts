import { Injectable, UnauthorizedException, UseInterceptors } from "@nestjs/common";
import { Tool, type McpContext } from "@nestjs/mcp";
import * as z from "zod";
import { AnalyticsService } from "../analytics/analytics.service";
import { MessagingService } from "../messaging/messaging.service";
import { MessagePriority } from "../messaging/message.entity";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { TokenManagementService } from "../token-management/services/token-management.service";
import { McpCallLoggingInterceptor } from "./mcp-call-logging.interceptor";

const recipientSchema = z.object({
  id: z.string().min(1).describe("Recipient identifier, unique within the tenant"),
  email: z.email().optional().describe("Recipient email address, required for the email channel"),
  phone: z.string().optional().describe("E.164 phone number, required for sms and voice"),
  deviceToken: z.string().optional().describe("Push device token, required for push"),
  whatsappNumber: z.string().optional().describe("WhatsApp number, required for whatsapp"),
  userId: z.string().optional().describe("In-app user identifier"),
});

const sendNotificationInputSchema = z.object({
  channels: z
    .array(z.enum(["email", "sms", "push", "whatsapp", "voice"]))
    .min(1)
    .describe(
      "Channels to send through. sms (24 tokens), whatsapp (48) and voice (250/min) cost far more than email (1), push (0.5) and in_app (0.5)",
    ),
  recipients: z
    .array(recipientSchema)
    .min(1)
    .max(1000)
    .describe("Who to notify, at most 1000 per call"),
  variables: z
    .record(z.string(), z.any())
    .describe(
      "Template variables or payload sent to the provider, for example { name, orderNumber }",
    ),
  templateId: z
    .string()
    .optional()
    .describe("Template to render, for example 123e4567-e89b-12d3-a456-426614174000"),
  subject: z.string().optional().describe("Subject line, used for email"),
  data: z.string().optional().describe("Message body, used when no templateId is given"),
  priority: z
    .enum(["low", "normal", "high", "urgent"])
    .optional()
    .describe("Delivery priority, defaults to normal"),
  metadata: z
    .record(z.string(), z.any())
    .optional()
    .describe("Arbitrary metadata stored on the message"),
});

type SendNotificationInput = z.infer<typeof sendNotificationInputSchema>;

const messageStatusInputSchema = z.object({
  messageId: z
    .string()
    .min(1)
    .describe(
      "The persisted message UUID. Immediate sends return transient msg_ ids; only persisted (scheduled) messages have a status",
    ),
});

@Injectable()
@UseInterceptors(McpCallLoggingInterceptor)
export class SanarwaMcpTools {
  constructor(
    private readonly tokenManagementService: TokenManagementService,
    private readonly analyticsService: AnalyticsService,
    private readonly messagingService: MessagingService,
  ) {}

  @Tool({
    name: "get-token-balance",
    description:
      "Get the tenant's current token balance: total granted, used, available and reserved tokens. Check this before a send to confirm the tenant can afford it. Does not spend tokens.",
    annotations: { readOnlyHint: true },
    scopes: ["billing:read"],
  })
  getTokenBalance(_input: unknown, ctx: McpContext) {
    const { tenantId } = this.tenantAuth(ctx);
    return this.tokenManagementService.getBalance(tenantId);
  }

  @Tool({
    name: "get-delivery-analytics",
    description:
      "Delivery analytics for the tenant's scheduled notifications over the last 30 days: total scheduled, delivered, failed and pending, plus the delivery rate in percent. Covers scheduled messages only; immediate sends are tracked by the provider dashboards. Does not spend tokens.",
    annotations: { readOnlyHint: true },
    scopes: ["analytics:read"],
  })
  getDeliveryAnalytics(_input: unknown, ctx: McpContext) {
    const { tenantId } = this.tenantAuth(ctx);
    return this.analyticsService.getTenantAnalytics(tenantId);
  }

  @Tool({
    name: "get-notification-status",
    description:
      "Get the delivery status of a persisted notification message by its id: status, channels, recipients and timestamps. Only persisted (scheduled) messages have a status; ids starting with msg_ are transient and return an error. Does not spend tokens.",
    inputSchema: messageStatusInputSchema,
    annotations: { readOnlyHint: true },
    scopes: ["notifications:read"],
  })
  getNotificationStatus({ messageId }: { messageId: string }, ctx: McpContext) {
    const { tenantId } = this.tenantAuth(ctx);
    return this.messagingService.getMessageStatus(messageId, tenantId);
  }

  @Tool({
    name: "send-notification",
    description:
      "Send a notification to one or more recipients through the tenant's providers. Spends the tenant's tokens (per channel). Requires the notifications:send scope; the API key must carry it. Returns the message id and delivery state.",
    inputSchema: sendNotificationInputSchema,
    annotations: { readOnlyHint: false, idempotentHint: false, openWorldHint: true },
    scopes: ["notifications:send"],
  })
  sendNotification(input: SendNotificationInput, ctx: McpContext) {
    const { tenantId, projectId } = this.tenantAuth(ctx);

    return this.messagingService.sendMessage(
      {
        channels: input.channels as NotificationChannel[],
        recipients: input.recipients,
        variables: input.variables,
        templateId: input.templateId,
        subject: input.subject,
        data: input.data,
        priority: input.priority as MessagePriority | undefined,
        metadata: { ...input.metadata, ...(projectId ? { projectId } : {}) },
      },
      tenantId,
    );
  }

  private tenantAuth(ctx: McpContext): { tenantId: string; projectId?: string } {
    const extra = ctx.authInfo?.extra as { tenantId?: unknown; projectId?: unknown } | undefined;
    if (typeof extra?.tenantId !== "string" || extra.tenantId.length === 0) {
      throw new UnauthorizedException("MCP calls must carry a tenant-scoped credential");
    }
    return {
      tenantId: extra.tenantId,
      projectId: typeof extra.projectId === "string" ? extra.projectId : undefined,
    };
  }
}
