import { z } from "zod";
import type { Sanarwa } from "@sanarwa/sdk";

export const sendWhatsAppInput = {
  to: z.string().describe("Recipient phone number in E.164 format, e.g. +1234567890."),
  data: z.string().describe("Free-text message body."),
  templateId: z.string().optional().describe("Render an approved WhatsApp template."),
  variables: z
    .record(z.string(), z.unknown())
    .optional()
    .describe("Values to interpolate into templateId."),
};

export async function sendWhatsApp(
  client: Sanarwa,
  input: z.infer<z.ZodObject<typeof sendWhatsAppInput>>,
): Promise<unknown> {
  const { to, data, templateId, variables } = input;

  return client.transport.send({
    to,
    channel: "whatsapp",
    data,
    templateId,
    variables,
  });
}

export const sendWhatsAppTemplateInput = {
  to: z.string().describe("Recipient phone number in E.164 format."),
  templateName: z.string().describe("Name of the approved WhatsApp template."),
  languageCode: z.string().default("en").describe("Language code for the template."),
  parameters: z
    .array(z.object({ type: z.string(), text: z.string() }))
    .optional()
    .describe("Ordered placeholder values for the template body, as {type, text} pairs."),
};

export async function sendWhatsAppTemplate(
  client: Sanarwa,
  input: z.infer<z.ZodObject<typeof sendWhatsAppTemplateInput>>,
): Promise<unknown> {
  const { to, templateName, languageCode, parameters } = input;

  return client.whatsapp.sendTemplate({
    to,
    templateName,
    languageCode,
    parameters,
  });
}
