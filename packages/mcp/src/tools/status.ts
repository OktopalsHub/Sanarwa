import { z } from "zod";
import type { Sanarwa } from "@sanarwa/sdk";

export const getStatusInput = {
  trackingId: z.string().describe("Tracking id returned when the notification was queued."),
};

export async function getStatus(
  client: Sanarwa,
  input: z.infer<z.ZodObject<typeof getStatusInput>>,
): Promise<unknown> {
  return client.getNotificationStatus(input.trackingId);
}

export const getHealthInput = {};

export async function getHealth(client: Sanarwa): Promise<unknown> {
  return client.getHealth();
}
