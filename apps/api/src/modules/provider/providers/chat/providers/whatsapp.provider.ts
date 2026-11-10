import { Injectable, Logger } from "@nestjs/common";
import { ChatPayload, ChatResponse, IChatProvider } from "../chat-provider.interface";

const DEFAULT_API_VERSION = "v21.0";
const DEFAULT_TIMEOUT_MS = 10_000;

const RETRYABLE_GRAPH_CODES = new Set([
  1, 2, 4, 17, 32, 613, 80007, 130429, 131000, 131016, 131048, 131056, 133004,
]);

export interface WhatsAppProviderConfig {
  accessToken?: string;
  phoneNumberId?: string;
  businessAccountId?: string;
  webhookVerifyToken?: string;
  appSecret?: string;
  apiVersion?: string;
  timeoutMs?: number;
}

export interface WhatsAppTemplate {
  name: string;
  language: string;
  components?: Array<{
    type: "header" | "body" | "footer" | "button";
    parameters?: Array<{
      type: "text" | "currency" | "date_time" | "image" | "document" | "video";
      text?: string;
      currency?: { fallback_value: string; code: string; amount_1000: number };
      date_time?: { fallback_value: string };
      image?: { link: string };
      document?: { link: string; filename?: string };
      video?: { link: string };
    }>;
  }>;
}

interface WhatsAppApiBody {
  messaging_product?: string;
  contacts?: unknown[];
  messages?: Array<{ id: string }>;
  error?: { message: string; type: string; code: number };
}

interface WhatsAppTemplatesBody {
  data?: Array<WhatsAppTemplate>;
  error?: { message: string; type: string; code: number };
}

@Injectable()
export class WhatsAppProvider implements IChatProvider {
  private readonly logger = new Logger(WhatsAppProvider.name);
  private readonly config: Required<Pick<WhatsAppProviderConfig, "apiVersion" | "timeoutMs">> &
    WhatsAppProviderConfig;

  constructor(config: WhatsAppProviderConfig = {}) {
    this.config = {
      ...config,
      apiVersion: config.apiVersion ?? DEFAULT_API_VERSION,
      timeoutMs: config.timeoutMs ?? DEFAULT_TIMEOUT_MS,
    };
  }

  async sendMessage(payload: ChatPayload): Promise<ChatResponse> {
    const to = normalizeToE164Digits(payload.channel);
    if (!to) {
      return this.failure("No WhatsApp phone number on payload", false, true);
    }

    const template = this.resolveTemplate(payload);
    if (template) {
      return this.sendTemplateMessages(to, template);
    }

    const text = [payload.subject, payload.message]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join("\n\n");

    if (!text) {
      return this.failure("No message text on payload", false, true);
    }

    return this.sendBody(to, {
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: text },
    });
  }

  async sendTemplate(phoneNumber: string, template: WhatsAppTemplate): Promise<ChatResponse> {
    const to = normalizeToE164Digits(phoneNumber);
    if (!to) {
      return this.failure("No WhatsApp phone number on payload", false, true);
    }

    return this.sendTemplateMessages(to, template);
  }

  async validateConfig(config?: unknown): Promise<boolean> {
    const candidate = (config ?? {}) as WhatsAppProviderConfig;
    const accessToken = candidate.accessToken ?? this.config.accessToken;
    const phoneNumberId = candidate.phoneNumberId ?? this.config.phoneNumberId;
    return Boolean(accessToken && phoneNumberId);
  }

  async verifyCredentials(config?: unknown): Promise<boolean> {
    const candidate = (config ?? {}) as WhatsAppProviderConfig;
    const accessToken = candidate.accessToken ?? this.config.accessToken;
    const phoneNumberId = candidate.phoneNumberId ?? this.config.phoneNumberId;
    const apiVersion = candidate.apiVersion ?? this.config.apiVersion;

    if (!accessToken || !phoneNumberId) {
      return false;
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${phoneNumberId}?fields=id,display_phone_number`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(this.config.timeoutMs),
        },
      );
      return response.ok;
    } catch (error) {
      this.logger.warn(`WhatsApp credential check failed: ${this.errorMessage(error)}`);
      return false;
    }
  }

  async getTemplates(config?: unknown): Promise<WhatsAppTemplate[]> {
    const candidate = (config ?? {}) as WhatsAppProviderConfig;
    const accessToken = candidate.accessToken ?? this.config.accessToken;
    const businessAccountId = candidate.businessAccountId ?? this.config.businessAccountId;
    const apiVersion = candidate.apiVersion ?? this.config.apiVersion;

    if (!accessToken || !businessAccountId) {
      return [];
    }

    try {
      const response = await fetch(
        `https://graph.facebook.com/${apiVersion}/${businessAccountId}/message_templates`,
        {
          headers: { Authorization: `Bearer ${accessToken}` },
          signal: AbortSignal.timeout(this.config.timeoutMs),
        },
      );

      const body = (await response.json()) as WhatsAppTemplatesBody;
      if (!response.ok) {
        this.logger.warn(
          `WhatsApp template listing failed: ${body.error?.message ?? response.status}`,
        );
        return [];
      }

      return body.data ?? [];
    } catch (error) {
      this.logger.warn(`WhatsApp template listing failed: ${this.errorMessage(error)}`);
      return [];
    }
  }

  getProviderName(): string {
    return "whatsapp";
  }

  private sendTemplateMessages(to: string, template: WhatsAppTemplate): Promise<ChatResponse> {
    if (!template.name || !template.language) {
      return Promise.resolve(
        this.failure("WhatsApp template needs a name and a language", false, true),
      );
    }

    return this.sendBody(to, {
      messaging_product: "whatsapp",
      to,
      type: "template",
      template: {
        name: template.name,
        language: { code: template.language },
        ...(template.components?.length ? { components: template.components } : {}),
      },
    });
  }

  private async sendBody(to: string, body: Record<string, unknown>): Promise<ChatResponse> {
    const accessToken = this.config.accessToken;
    const phoneNumberId = this.config.phoneNumberId;

    if (!accessToken || !phoneNumberId) {
      return this.failure("WhatsApp access token and phone number id are required", false, true);
    }

    try {
      const response = await fetch(this.graphUrl(phoneNumberId, this.config.apiVersion), {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(this.config.timeoutMs),
      });

      const result = (await response.json().catch(() => ({}))) as WhatsAppApiBody;

      if (!response.ok) {
        const errorCode = result.error?.code;
        const invalidDestination = response.status === 401 || errorCode === 190;
        const retryable =
          !invalidDestination &&
          (RETRYABLE_GRAPH_CODES.has(errorCode ?? 0) || !isPermanentStatus(response.status));

        this.logger.warn(
          `WhatsApp send to ${to} failed with ${errorCode ?? response.status}: ${result.error?.message ?? "unknown"}`,
        );

        return this.failure(
          result.error?.message ?? `WhatsApp API error ${response.status}`,
          retryable,
          invalidDestination,
        );
      }

      return {
        success: true,
        messageId: result.messages?.[0]?.id,
        timestamp: new Date().toISOString(),
        provider: "whatsapp",
      };
    } catch (error) {
      return this.failure(this.errorMessage(error), true);
    }
  }

  private resolveTemplate(payload: ChatPayload): WhatsAppTemplate | undefined {
    const metadata = payload.metadata ?? {};
    const template = metadata.whatsappTemplate ?? metadata.template;

    if (!template || typeof template !== "object") {
      return undefined;
    }

    const candidate = template as Partial<WhatsAppTemplate>;
    if (typeof candidate.name !== "string" || typeof candidate.language !== "string") {
      return undefined;
    }

    return {
      name: candidate.name,
      language: candidate.language,
      components: Array.isArray(candidate.components) ? candidate.components : undefined,
    };
  }

  private graphUrl(phoneNumberId: string, apiVersion: string): string {
    return `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;
  }

  private failure(error: string, retryable: boolean, invalidDestination = false): ChatResponse {
    return {
      success: false,
      error,
      provider: "whatsapp",
      retryable,
      invalidDestination,
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "WhatsApp send failed";
  }
}

export function normalizeToE164Digits(phone: string | undefined): string | undefined {
  if (!phone) {
    return undefined;
  }

  const digits = phone.replace(/[^\d]/g, "");
  return digits || undefined;
}

function isPermanentStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
