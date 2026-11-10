import { z } from "zod";
import type { Sanarwa } from "@sanarwa/sdk";

const item = z.object({
  to: z.string().describe("Recipient: email address, phone number, or device token."),
  channel: z.enum(["email", "sms", "push", "whatsapp", "in_app"]).describe("Delivery channel."),
  data: z.string().describe("Plain-text body."),
  subject: z.string().optional(),
  templateId: z.string().optional(),
  variables: z.record(z.string(), z.unknown()).optional(),
  priority: z.enum(["low", "normal", "high"]).optional(),
});

export const sendBulkInput = {
  notifications: z
    .array(item)
    .min(1)
    .max(1000)
    .describe("Up to 1000 notifications to queue in one batch."),
  batchId: z
    .string()
    .optional()
    .describe("Caller-supplied batch id so the batch can be polled later."),
};

export async function sendBulk(
  client: Sanarwa,
  input: z.infer<z.ZodObject<typeof sendBulkInput>>,
): Promise<unknown> {
  const { notifications, batchId } = input;

  return client.transport.sendBulk(
    notifications.map((n) => ({
      to: n.to,
      channel: n.channel,
      data: n.data,
      subject: n.subject,
      templateId: n.templateId,
      variables: n.variables,
      priority: n.priority,
    })),
    batchId,
  );
}
