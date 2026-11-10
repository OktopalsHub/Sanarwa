import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { Sanarwa } from "@sanarwa/sdk";

import { getAnalytics, getAnalyticsInput } from "./tools/analytics.js";
import { sendPush, sendPushBulk, sendPushBulkInput, sendPushInput } from "./tools/push.js";
import { sendBulk, sendBulkInput } from "./tools/send-bulk.js";
import { sendNotification, sendNotificationInput } from "./tools/send-notification.js";
import { getHealth, getHealthInput, getStatus, getStatusInput } from "./tools/status.js";
import {
  sendWhatsApp,
  sendWhatsAppInput,
  sendWhatsAppTemplate,
  sendWhatsAppTemplateInput,
} from "./tools/whatsapp.js";

export const SERVER_NAME = "sanarwa";
export const SERVER_VERSION = "0.1.0";

export interface SanarwaServerOptions {
  apiKey: string;
  baseUrl?: string;
  timeout?: number;
}

export function createServer(client: Sanarwa): McpServer {
  const server = new McpServer(
    { name: SERVER_NAME, version: SERVER_VERSION },
    {
      capabilities: { tools: {} },
      instructions:
        "Send transactional notifications through Sanarwa (email, SMS, push, WhatsApp, in-app, voice). " +
        "Start with notification_health to confirm connectivity, then send. " +
        "Every send returns a tracking id; poll notification_status with it to confirm delivery.",
    },
  );

  server.registerTool(
    "notification_send",
    {
      title: "Send notification",
      description:
        "Send one notification on any channel. Returns the tracking id to poll with notification_status.",
      inputSchema: sendNotificationInput,
    },
    (input) => reply(sendNotification(client, input)),
  );

  server.registerTool(
    "notification_send_bulk",
    {
      title: "Send notifications in bulk",
      description:
        "Queue up to 1000 notifications in a single batch. Each item carries its own channel, so a mixed batch is fine.",
      inputSchema: sendBulkInput,
    },
    (input) => reply(sendBulk(client, input)),
  );

  server.registerTool(
    "notification_status",
    {
      title: "Get delivery status",
      description: "Look up the delivery status of a notification by its tracking id.",
      inputSchema: getStatusInput,
    },
    (input) => reply(getStatus(client, input)),
  );

  server.registerTool(
    "notification_analytics",
    {
      title: "Get delivery analytics",
      description:
        "Delivery and per-channel metrics for a date range. Omit the dates for the default window.",
      inputSchema: getAnalyticsInput,
    },
    (input) => reply(getAnalytics(client, input)),
  );

  server.registerTool(
    "notification_health",
    {
      title: "Check API health",
      description:
        "Report API and per-transport service health. Call this first when a send fails.",
      inputSchema: getHealthInput,
    },
    () => reply(getHealth(client)),
  );

  server.registerTool(
    "push_send",
    {
      title: "Send push notification",
      description: "Send a push notification to a device token or subscriber id.",
      inputSchema: sendPushInput,
    },
    (input) => reply(sendPush(client, input)),
  );

  server.registerTool(
    "push_send_bulk",
    {
      title: "Send push notifications in bulk",
      description: "Queue up to 1000 push notifications in one batch.",
      inputSchema: sendPushBulkInput,
    },
    (input) => reply(sendPushBulk(client, input)),
  );

  server.registerTool(
    "whatsapp_send",
    {
      title: "Send WhatsApp message",
      description: "Send a free-text or template WhatsApp message to an E.164 number.",
      inputSchema: sendWhatsAppInput,
    },
    (input) => reply(sendWhatsApp(client, input)),
  );

  server.registerTool(
    "whatsapp_send_template",
    {
      title: "Send WhatsApp template message",
      description: "Send an approved WhatsApp template with ordered placeholder parameters.",
      inputSchema: sendWhatsAppTemplateInput,
    },
    (input) => reply(sendWhatsAppTemplate(client, input)),
  );

  return server;
}

export function createClient(options: SanarwaServerOptions): Sanarwa {
  return new Sanarwa({
    key: options.apiKey,
    baseUrl: options.baseUrl,
    timeout: options.timeout,
  });
}

async function reply(work: Promise<unknown>) {
  try {
    const result = await work;
    return {
      content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
      structuredContent: toStructured(result),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      content: [{ type: "text" as const, text: `Sanarwa API error: ${message}` }],
      isError: true,
    };
  }
}

function toStructured(result: unknown): Record<string, unknown> {
  if (result !== null && typeof result === "object" && !Array.isArray(result)) {
    return result as Record<string, unknown>;
  }
  return { result };
}
