import { Channel } from "../../providers/types";
import { isValidEmail } from "./provider-config-validator.helpers";
import { ProviderConfigSchema } from "./provider-config-validator.types";

export function buildProviderConfigSchemas(): Map<string, ProviderConfigSchema> {
  const schemas = new Map<string, ProviderConfigSchema>();

  schemas.set(`${Channel.EMAIL}:aws_ses`, {
    required: ["accessKeyId", "secretAccessKey", "region"],
    optional: ["fromEmail", "fromName", "replyToEmail"],
    validation: {
      accessKeyId: (value) => typeof value === "string" && value.length > 0,
      secretAccessKey: (value) => typeof value === "string" && value.length > 0,
      region: (value) => typeof value === "string" && /^[a-z0-9-]+$/.test(value),
      fromEmail: (value) => typeof value === "string" && isValidEmail(value),
      replyToEmail: (value) => typeof value === "string" && isValidEmail(value),
    },
    description: {
      accessKeyId: "AWS Access Key ID",
      secretAccessKey: "AWS Secret Access Key",
      region: "AWS Region (e.g., us-east-1)",
      fromEmail: "Default sender email address",
      fromName: "Default sender name",
      replyToEmail: "Reply-to email address",
    },
  });

  schemas.set(`${Channel.SMS}:aws_sns`, {
    required: ["accessKeyId", "secretAccessKey", "region"],
    optional: ["senderName", "messageType"],
    validation: {
      accessKeyId: (value) => typeof value === "string" && value.length > 0,
      secretAccessKey: (value) => typeof value === "string" && value.length > 0,
      region: (value) => typeof value === "string" && /^[a-z0-9-]+$/.test(value),
      senderName: (value) => typeof value === "string" && value.length <= 11,
      messageType: (value) => ["Promotional", "Transactional"].includes(value),
    },
    description: {
      accessKeyId: "AWS Access Key ID",
      secretAccessKey: "AWS Secret Access Key",
      region: "AWS Region",
      senderName: "SMS sender name (max 11 characters)",
      messageType: "Message type: Promotional or Transactional",
    },
  });

  schemas.set(`${Channel.SMS}:termii`, {
    required: ["apiKey", "senderId"],
    optional: ["channel", "type"],
    validation: {
      apiKey: (value) => typeof value === "string" && value.length > 0,
      senderId: (value) => typeof value === "string" && value.length <= 11,
      channel: (value) => ["generic", "dnd", "whatsapp"].includes(value),
      type: (value) => ["plain", "unicode"].includes(value),
    },
    description: {
      apiKey: "Termii API Key",
      senderId: "Sender ID (max 11 characters)",
      channel: "Message channel: generic, dnd, or whatsapp",
      type: "Message type: plain or unicode",
    },
  });

  schemas.set(`${Channel.PUSH}:aws_pinpoint`, {
    required: ["accessKeyId", "secretAccessKey", "region", "applicationId"],
    optional: ["gcmApiKey", "apnsCertificate", "apnsPrivateKey"],
    validation: {
      accessKeyId: (value) => typeof value === "string" && value.length > 0,
      secretAccessKey: (value) => typeof value === "string" && value.length > 0,
      region: (value) => typeof value === "string" && /^[a-z0-9-]+$/.test(value),
      applicationId: (value) => typeof value === "string" && value.length > 0,
      gcmApiKey: (value) => typeof value === "string" && value.length > 0,
    },
    description: {
      accessKeyId: "AWS Access Key ID",
      secretAccessKey: "AWS Secret Access Key",
      region: "AWS Region",
      applicationId: "Pinpoint Application ID",
      gcmApiKey: "Google Cloud Messaging API Key",
      apnsCertificate: "Apple Push Notification Certificate",
      apnsPrivateKey: "Apple Push Notification Private Key",
    },
  });

  schemas.set(`${Channel.WHATSAPP}:whatsapp_business`, {
    required: ["accessToken", "phoneNumberId", "businessAccountId"],
    optional: ["webhookVerifyToken", "apiVersion"],
    validation: {
      accessToken: (value) => typeof value === "string" && value.length > 0,
      phoneNumberId: (value) => typeof value === "string" && /^\d+$/.test(value),
      businessAccountId: (value) => typeof value === "string" && /^\d+$/.test(value),
      apiVersion: (value) => typeof value === "string" && /^v\d+\.\d+$/.test(value),
    },
    description: {
      accessToken: "WhatsApp Business API Access Token",
      phoneNumberId: "Phone Number ID",
      businessAccountId: "Business Account ID",
      webhookVerifyToken: "Webhook Verification Token",
      apiVersion: "API Version (e.g., v17.0)",
    },
  });

  return schemas;
}
