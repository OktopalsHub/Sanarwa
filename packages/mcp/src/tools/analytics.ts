import { z } from "zod";
import type { Sanarwa } from "@sanarwa/sdk";

export const getAnalyticsInput = {
  startDate: z.string().optional().describe("Inclusive start of the range, ISO 8601."),
  endDate: z.string().optional().describe("Inclusive end of the range, ISO 8601."),
  channel: z
    .enum(["email", "sms", "push", "whatsapp", "webhook", "in_app"])
    .optional()
    .describe("Restrict metrics to one channel."),
};

export async function getAnalytics(
  client: Sanarwa,
  input: z.infer<z.ZodObject<typeof getAnalyticsInput>>,
): Promise<unknown> {
  return client.transport.analytics({
    startDate: input.startDate,
    endDate: input.endDate,
    channel: input.channel,
  });
}
