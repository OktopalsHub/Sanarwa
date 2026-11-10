import { z } from "zod";
import type { Sanarwa } from "@sanarwa/sdk";

export const sendNotificationInput = {
  to: z.string().describe("Recipient: email address, phone number, or device token."),
  channel: z.enum(["email", "sms", "push", "whatsapp", "in_app"]).describe("Delivery channel."),
  data: z.string().describe("Plain-text body of the notification."),
  subject: z.string().optional().describe("Title or email subject."),
  templateId: z.string().optional().describe("Render a stored template instead of a literal body."),
  variables: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Values to interpolate into templateId."),
  priority: z.enum(["low", "normal", "high"]).optional(),
  webhookUrl: z.string().optional().describe("Webhook to POST the delivery receipt to."),
};

export async function sendNotification(
  client: Sanarwa,
  input: z.infer<z.ZodObject<typeof sendNotificationInput>>,
): Promise<unknown> {
  const { to, channel, data, subject, templateId, variables, priority, webhookUrl } = input;

  return client.transport.send({
    to,
    channel,
    data,
    subject,
    templateId,
    variables,
    priority,
    webhookUrl,
  });
}
