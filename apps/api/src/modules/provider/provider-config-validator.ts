import { Injectable, Logger } from "@nestjs/common";
import { NotificationChannel } from "../../common/enums/notification-channel.enum";
import { isSecretField } from "./mask-provider-config";
import { ProviderConfig } from "./provider-config.entity";

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export interface ProviderConfigSchema {
  required: string[];
  optional: string[];
  requiredAny?: string[];
  validation: Record<string, (value: any) => boolean>;
  description: Record<string, string>;
}

export interface ProviderSchemaDescription {
  channel: string;
  providerId: string;
  required: string[];
  optional: string[];
  requiredAny: string[];
  description: Record<string, string>;
  secretFields: string[];
}

@Injectable()
export class ProviderConfigValidator {
  private readonly logger = new Logger(ProviderConfigValidator.name);
  private readonly schemas = new Map<string, ProviderConfigSchema>();

  constructor() {
    this.initializeSchemas();
  }

  async validate(config: ProviderConfig): Promise<boolean> {
    const result = await this.validateDetailed(config);
    return result.isValid;
  }

  async validateDetailed(config: ProviderConfig): Promise<ValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    try {
      if (!config.providerId) {
        errors.push("Provider ID is required");
      }

      if (!config.providerName) {
        errors.push("Provider name is required");
      }

      if (!config.channel) {
        errors.push("NotificationChannel is required");
      }

      if (!config.config || typeof config.config !== "object") {
        errors.push("Provider configuration object is required");
      }

      if (config.priority < 1) {
        errors.push("Priority must be greater than 0");
      }

      if (config.channel && config.config) {
        const channelValidation = await this.validateChannelConfig(
          config.channel,
          config.providerId,
          config.config,
        );
        errors.push(...channelValidation.errors);
        warnings.push(...channelValidation.warnings);
      }

      if (config.rateLimits) {
        const rateLimitValidation = this.validateRateLimits(config.rateLimits);
        errors.push(...rateLimitValidation.errors);
        warnings.push(...rateLimitValidation.warnings);
      }

      if (config.supportedCountries) {
        const countriesValidation = this.validateSupportedCountries(config.supportedCountries);
        errors.push(...countriesValidation.errors);
        warnings.push(...countriesValidation.warnings);
      }

      return {
        isValid: errors.length === 0,
        errors,
        warnings,
      };
    } catch (error) {
      this.logger.error(`Validation error: ${error.message}`);
      return {
        isValid: false,
        errors: [`Validation failed: ${error.message}`],
        warnings,
      };
    }
  }

  private async validateChannelConfig(
    channel: NotificationChannel,
    providerId: string,
    config: Record<string, any>,
  ): Promise<ValidationResult> {
    const schemaKey = `${channel}:${providerId}`;
    const schema = this.schemas.get(schemaKey) || this.schemas.get(channel);

    if (!schema) {
      return {
        isValid: true,
        errors: [],
        warnings: [`No validation schema found for ${channel}:${providerId}`],
      };
    }

    const errors: string[] = [];
    const warnings: string[] = [];

    for (const field of schema.required) {
      if (!config[field]) {
        errors.push(`Required field '${field}' is missing`);
      }
    }

    if (schema.requiredAny?.length && !schema.requiredAny.some((field) => config[field])) {
      errors.push(`At least one of ${schema.requiredAny.join(", ")} is required`);
    }

    for (const [field, validator] of Object.entries(schema.validation)) {
      if (config[field] !== undefined && !validator(config[field])) {
        errors.push(`Invalid value for field '${field}'`);
      }
    }

    const knownFields = [...schema.required, ...schema.optional];
    for (const field of Object.keys(config)) {
      if (!knownFields.includes(field)) {
        warnings.push(`Unknown field '${field}' in configuration`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateRateLimits(rateLimits: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (typeof rateLimits !== "object") {
      errors.push("Rate limits must be an object");
      return { isValid: false, errors, warnings };
    }

    const validFields = [
      "requestsPerSecond",
      "requestsPerMinute",
      "requestsPerHour",
      "requestsPerDay",
    ];

    for (const [field, value] of Object.entries(rateLimits)) {
      if (!validFields.includes(field)) {
        warnings.push(`Unknown rate limit field: ${field}`);
        continue;
      }

      if (typeof value !== "number" || value <= 0) {
        errors.push(`Rate limit '${field}' must be a positive number`);
      }
    }

    if (rateLimits.requestsPerSecond && rateLimits.requestsPerMinute) {
      if (rateLimits.requestsPerSecond * 60 > rateLimits.requestsPerMinute) {
        warnings.push("Requests per second * 60 exceeds requests per minute limit");
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  private validateSupportedCountries(countries: any): ValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (!Array.isArray(countries)) {
      errors.push("Supported countries must be an array");
      return { isValid: false, errors, warnings };
    }

    const validCountryCodes = this.getValidCountryCodes();

    for (const country of countries) {
      if (typeof country !== "string") {
        errors.push("Country codes must be strings");
        continue;
      }

      if (country.length !== 2) {
        warnings.push(`Country code '${country}' should be 2 characters (ISO 3166-1 alpha-2)`);
      }

      if (!validCountryCodes.includes(country.toUpperCase())) {
        warnings.push(`Unknown country code: ${country}`);
      }
    }

    return { isValid: errors.length === 0, errors, warnings };
  }

  describeSchemas(): ProviderSchemaDescription[] {
    const described: ProviderSchemaDescription[] = [];

    for (const [key, schema] of this.schemas) {
      const [channel, providerId] = key.split(":");
      if (!channel || !providerId) {
        continue;
      }
      described.push({
        channel,
        providerId,
        required: schema.required,
        optional: schema.optional,
        requiredAny: schema.requiredAny ?? [],
        description: schema.description,
        secretFields: [
          ...schema.required,
          ...schema.optional,
          ...(schema.requiredAny ?? []),
        ].filter(isSecretField),
      });
    }

    return described;
  }

  private initializeSchemas(): void {
    this.schemas.set(`${NotificationChannel.EMAIL}:aws_ses`, {
      required: ["accessKeyId", "secretAccessKey", "region"],
      optional: ["fromEmail", "fromName", "replyToEmail"],
      validation: {
        accessKeyId: (value) => typeof value === "string" && value.length > 0,
        secretAccessKey: (value) => typeof value === "string" && value.length > 0,
        region: (value) => typeof value === "string" && /^[a-z0-9-]+$/.test(value),
        fromEmail: (value) => typeof value === "string" && this.isValidEmail(value),
        replyToEmail: (value) => typeof value === "string" && this.isValidEmail(value),
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

    this.schemas.set(
      `${NotificationChannel.EMAIL}:ses`,
      this.schemas.get(`${NotificationChannel.EMAIL}:aws_ses`) as ProviderConfigSchema,
    );

    this.schemas.set(`${NotificationChannel.EMAIL}:sendgrid`, {
      required: ["apiKey"],
      optional: ["fromEmail", "fromName", "webhookPublicKey"],
      validation: {
        apiKey: (value) => typeof value === "string" && value.length > 0,
        fromEmail: (value) => typeof value === "string" && this.isValidEmail(value),
        webhookPublicKey: (value) => typeof value === "string" && value.length > 0,
      },
      description: {
        apiKey: "SendGrid API key",
        fromEmail: "Default sender email address",
        fromName: "Default sender name",
        webhookPublicKey:
          "SendGrid signed event webhook public key (Settings > Mail Settings > Event Webhooks)",
      },
    });

    this.schemas.set(`${NotificationChannel.EMAIL}:mailgun`, {
      required: ["apiKey"],
      optional: ["domain", "fromEmail", "webhookSecret"],
      validation: {
        apiKey: (value) => typeof value === "string" && value.length > 0,
        domain: (value) => typeof value === "string" && value.length > 0,
        fromEmail: (value) => typeof value === "string" && this.isValidEmail(value),
        webhookSecret: (value) => typeof value === "string" && value.length > 0,
      },
      description: {
        apiKey: "Mailgun API key",
        domain: "Mailgun sending domain",
        fromEmail: "Default sender email address",
        webhookSecret: "Mailgun webhook signing key (passed as HMAC secret)",
      },
    });

    this.schemas.set(`${NotificationChannel.EMAIL}:resend`, {
      required: ["apiKey"],
      optional: ["fromEmail", "webhookSecret"],
      validation: {
        apiKey: (value) => typeof value === "string" && value.length > 0,
        fromEmail: (value) => typeof value === "string" && this.isValidEmail(value),
        webhookSecret: (value) => typeof value === "string" && value.length > 0,
      },
      description: {
        apiKey: "Resend API key",
        fromEmail: "Default sender email address",
        webhookSecret: "Resend webhook secret (whsec_..., from the Resend dashboard)",
      },
    });

    this.schemas.set(`${NotificationChannel.EMAIL}:zeptomail`, {
      required: ["apiKey", "fromEmail"],
      optional: ["apiUrl", "fromName", "replyToEmail"],
      validation: {
        apiKey: (value) => typeof value === "string" && value.length > 0,
        apiUrl: (value) => typeof value === "string" && /^https?:\/\//.test(value),
        fromEmail: (value) => typeof value === "string" && this.isValidEmail(value),
        replyToEmail: (value) => typeof value === "string" && this.isValidEmail(value),
      },
      description: {
        apiKey: "ZeptoMail send-mail token",
        apiUrl: "ZeptoMail API endpoint (defaults to https://api.zeptomail.com/v1.1/email)",
        fromEmail: "Default sender email address",
        fromName: "Default sender name",
        replyToEmail: "Reply-to email address",
      },
    });

    this.schemas.set(`${NotificationChannel.EMAIL}:smtp`, {
      required: ["host", "fromEmail"],
      optional: ["port", "secure", "username", "password", "fromName", "replyToEmail"],
      validation: {
        host: (value) => typeof value === "string" && value.length > 0,
        port: (value) =>
          value === undefined || (Number.isInteger(value) && value > 0 && value <= 65535),
        secure: (value) => value === undefined || typeof value === "boolean",
        username: (value) => value === undefined || typeof value === "string",
        fromEmail: (value) => typeof value === "string" && this.isValidEmail(value),
        replyToEmail: (value) => typeof value === "string" && this.isValidEmail(value),
      },
      description: {
        host: "SMTP server hostname",
        port: "SMTP server port (defaults to 587)",
        secure: "Use TLS on connect (true for port 465)",
        username: "SMTP username",
        password: "SMTP password",
        fromEmail: "Default sender email address",
        fromName: "Default sender name",
        replyToEmail: "Reply-to email address",
      },
    });

    this.schemas.set(`${NotificationChannel.SMS}:aws_sns`, {
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

    this.schemas.set(`${NotificationChannel.SMS}:termii`, {
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

    this.schemas.set(`${NotificationChannel.PUSH}:aws_pinpoint`, {
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

    this.schemas.set(`${NotificationChannel.CHAT}:slack`, {
      required: [],
      optional: [
        "botToken",
        "token",
        "webhookUrl",
        "defaultChannel",
        "appId",
        "clientId",
        "clientSecret",
      ],
      requiredAny: ["botToken", "token", "webhookUrl"],
      validation: {
        botToken: (value) => typeof value === "string" && value.startsWith("xox"),
        token: (value) => typeof value === "string" && value.startsWith("xox"),
        webhookUrl: (value) => typeof value === "string" && this.isSlackWebhookUrl(value),
        defaultChannel: (value) => typeof value === "string" && value.length > 0,
        appId: (value) => typeof value === "string" && value.length > 0,
      },
      description: {
        botToken: "Slack bot or user OAuth token (xoxb-/xoxp-) for chat.postMessage",
        token: "Alias for botToken",
        webhookUrl: "Slack incoming webhook URL (https://hooks.slack.com/...)",
        defaultChannel: "Channel or user id used when a send names none (e.g. C0123456789)",
        appId: "Descriptive Slack app id used in log lines",
      },
    });

    this.schemas.set(`${NotificationChannel.CHAT}:discord`, {
      required: [],
      optional: ["webhookUrl", "username", "avatarUrl"],
      requiredAny: ["webhookUrl"],
      validation: {
        webhookUrl: (value) => typeof value === "string" && this.isDiscordWebhookUrl(value),
        username: (value) => typeof value === "string" && value.length > 0,
        avatarUrl: (value) => typeof value === "string" && value.startsWith("https://"),
      },
      description: {
        webhookUrl: "Discord incoming webhook URL (https://discord.com/api/webhooks/...)",
        username: "Default sender name shown on messages",
        avatarUrl: "Default sender avatar URL",
      },
    });

    this.schemas.set(`${NotificationChannel.CHAT}:telegram`, {
      required: [],
      optional: ["botToken", "parseMode", "defaultChatId"],
      requiredAny: ["botToken"],
      validation: {
        botToken: (value) => typeof value === "string" && /^\d+:[A-Za-z0-9_-]+$/.test(value),
        parseMode: (value) => ["HTML", "MarkdownV2", "Markdown"].includes(value),
        defaultChatId: (value) => typeof value === "string" && value.length > 0,
      },
      description: {
        botToken: "Bot token from @BotFather",
        parseMode: "Default formatting mode: HTML, MarkdownV2 or Markdown",
        defaultChatId: "Fallback chat id when a recipient names none",
      },
    });

    const whatsappSchema: ProviderConfigSchema = {
      required: ["accessToken", "phoneNumberId"],
      optional: ["businessAccountId", "webhookVerifyToken", "appSecret", "apiVersion"],
      validation: {
        accessToken: (value) => typeof value === "string" && value.length > 0,
        phoneNumberId: (value) => typeof value === "string" && /^\d+$/.test(value),
        businessAccountId: (value) => typeof value === "string" && /^\d+$/.test(value),
        appSecret: (value) => typeof value === "string" && value.length > 0,
        apiVersion: (value) => typeof value === "string" && /^v\d+\.\d+$/.test(value),
      },
      description: {
        accessToken: "WhatsApp Business API Access Token",
        phoneNumberId: "Phone Number ID",
        businessAccountId: "Business Account ID (required for template listing)",
        webhookVerifyToken: "Webhook Verification Token",
        appSecret: "Meta app secret used to verify webhook signatures",
        apiVersion: "API Version (e.g., v21.0)",
      },
    };

    this.schemas.set(`${NotificationChannel.WHATSAPP}:whatsapp`, whatsappSchema);
    this.schemas.set(`${NotificationChannel.WHATSAPP}:whatsapp_business`, whatsappSchema);
  }

  private isValidEmail(email: string): boolean {
    // Labels must be non-empty (no leading/trailing/double dots) and the domain
    // must have a TLD of at least two characters.
    const emailRegex = /^[^\s@.]+(\.[^\s@.]+)*@[^\s@.]+(\.[^\s@.]+)*\.[^\s@.]{2,}$/;
    return emailRegex.test(email);
  }

  private isSlackWebhookUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        ["hooks.slack.com", "hooks.slack-gov.com"].includes(url.hostname.toLowerCase())
      );
    } catch {
      return false;
    }
  }

  private isDiscordWebhookUrl(value: string): boolean {
    try {
      const url = new URL(value);
      return (
        url.protocol === "https:" &&
        ["discord.com", "discordapp.com", "ptb.discord.com", "canary.discord.com"].includes(
          url.hostname.toLowerCase(),
        ) &&
        url.pathname.startsWith("/api/webhooks/")
      );
    } catch {
      return false;
    }
  }

  private getValidCountryCodes(): string[] {
    return [
      "AD",
      "AE",
      "AF",
      "AG",
      "AI",
      "AL",
      "AM",
      "AO",
      "AQ",
      "AR",
      "AS",
      "AT",
      "AU",
      "AW",
      "AX",
      "AZ",
      "BA",
      "BB",
      "BD",
      "BE",
      "BF",
      "BG",
      "BH",
      "BI",
      "BJ",
      "BL",
      "BM",
      "BN",
      "BO",
      "BQ",
      "BR",
      "BS",
      "BT",
      "BV",
      "BW",
      "BY",
      "BZ",
      "CA",
      "CC",
      "CD",
      "CF",
      "CG",
      "CH",
      "CI",
      "CK",
      "CL",
      "CM",
      "CN",
      "CO",
      "CR",
      "CU",
      "CV",
      "CW",
      "CX",
      "CY",
      "CZ",
      "DE",
      "DJ",
      "DK",
      "DM",
      "DO",
      "DZ",
      "EC",
      "EE",
      "EG",
      "EH",
      "ER",
      "ES",
      "ET",
      "FI",
      "FJ",
      "FK",
      "FM",
      "FO",
      "FR",
      "GA",
      "GB",
      "GD",
      "GE",
      "GF",
      "GG",
      "GH",
      "GI",
      "GL",
      "GM",
      "GN",
      "GP",
      "GQ",
      "GR",
      "GS",
      "GT",
      "GU",
      "GW",
      "GY",
      "HK",
      "HM",
      "HN",
      "HR",
      "HT",
      "HU",
      "ID",
      "IE",
      "IL",
      "IM",
      "IN",
      "IO",
      "IQ",
      "IR",
      "IS",
      "IT",
      "JE",
      "JM",
      "JO",
      "JP",
      "KE",
      "KG",
      "KH",
      "KI",
      "KM",
      "KN",
      "KP",
      "KR",
      "KW",
      "KY",
      "KZ",
      "LA",
      "LB",
      "LC",
      "LI",
      "LK",
      "LR",
      "LS",
      "LT",
      "LU",
      "LV",
      "LY",
      "MA",
      "MC",
      "MD",
      "ME",
      "MF",
      "MG",
      "MH",
      "MK",
      "ML",
      "MM",
      "MN",
      "MO",
      "MP",
      "MQ",
      "MR",
      "MS",
      "MT",
      "MU",
      "MV",
      "MW",
      "MX",
      "MY",
      "MZ",
      "NA",
      "NC",
      "NE",
      "NF",
      "NG",
      "NI",
      "NL",
      "NO",
      "NP",
      "NR",
      "NU",
      "NZ",
      "OM",
      "PA",
      "PE",
      "PF",
      "PG",
      "PH",
      "PK",
      "PL",
      "PM",
      "PN",
      "PR",
      "PS",
      "PT",
      "PW",
      "PY",
      "QA",
      "RE",
      "RO",
      "RS",
      "RU",
      "RW",
      "SA",
      "SB",
      "SC",
      "SD",
      "SE",
      "SG",
      "SH",
      "SI",
      "SJ",
      "SK",
      "SL",
      "SM",
      "SN",
      "SO",
      "SR",
      "SS",
      "ST",
      "SV",
      "SX",
      "SY",
      "SZ",
      "TC",
      "TD",
      "TF",
      "TG",
      "TH",
      "TJ",
      "TK",
      "TL",
      "TM",
      "TN",
      "TO",
      "TR",
      "TT",
      "TV",
      "TW",
      "TZ",
      "UA",
      "UG",
      "UM",
      "US",
      "UY",
      "UZ",
      "VA",
      "VC",
      "VE",
      "VG",
      "VI",
      "VN",
      "VU",
      "WF",
      "WS",
      "YE",
      "YT",
      "ZA",
      "ZM",
      "ZW",
    ];
  }
}
