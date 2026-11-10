import { z } from "zod";
import type { Sanarwa } from "@sanarwa/sdk";

export const sendPushInput = {
  to: z.string().describe("Device token or subscriber id."),
  subject: z.string().describe("Notification title."),
  data: z.string().describe("Notification body."),
  priority: z.enum(["low", "normal", "high"]).optional(),
  scheduledAt: z.string().optional().describe("ISO 8601 time to deliver instead of immediately."),
  expiresAt: z.string().optional().describe("ISO 8601 time after which delivery is abandoned."),
};

export async function sendPush(
  client: Sanarwa,
  input: z.infer<z.ZodObject<typeof sendPushInput>>,
): Promise<unknown> {
  const { to, subject, data, priority, scheduledAt, expiresAt } = input;

  return client.transport.send({
    to,
    channel: "push",
    subject,
    data,
    priority,
    scheduledAt,
    expiresAt,
  });
}

export const sendPushBulkInput = {
  notifications: z
    .array(
      z.object({
        to: z.string(),
        subject: z.string(),
        data: z.string(),
        priority: z.enum(["low", "normal", "high"]).optional(),
      }),
    )
    .min(1)
    .max(1000)
    .describe("Up to 1000 push notifications to queue in one batch."),
  batchId: z.string().optional(),
};

export async function sendPushBulk(
  client: Sanarwa,
  input: z.infer<z.ZodObject<typeof sendPushBulkInput>>,
): Promise<unknown> {
  return client.transport.sendBulk(
    input.notifications.map((n) => ({
      to: n.to,
      channel: "push" as const,
      subject: n.subject,
      data: n.data,
      priority: n.priority,
    })),
    input.batchId,
  );
}
