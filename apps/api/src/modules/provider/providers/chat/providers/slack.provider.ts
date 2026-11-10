import { Injectable, Logger } from "@nestjs/common";
import { ChatPayload, ChatResponse, IChatProvider } from "../chat-provider.interface";

const WEB_API_URL = "https://slack.com/api/chat.postMessage";
const INCOMING_WEBHOOK_HOSTS = new Set(["hooks.slack.com", "hooks.slack-gov.com"]);
const DEFAULT_FALLBACK_TEXT = "New notification";
const DEFAULT_TIMEOUT_MS = 10_000;

const INVALID_DESTINATION_ERRORS = new Set([
  "channel_not_found",
  "is_archived",
  "channel_is_archived",
  "user_not_found",
  "account_inactive",
  "not_in_channel",
]);

const RETRYABLE_ERRORS = new Set([
  "ratelimited",
  "rate_limited",
  "internal_error",
  "fatal_error",
  "service_unavailable",
  "request_timeout",
  "team_added_to_org",
]);

const INVALID_WEBHOOK_BODIES = new Set(["channel_not_found", "channel_is_archived", "no_service"]);

export interface SlackProviderConfig {
  botToken?: string;
  token?: string;
  webhookUrl?: string;
  defaultChannel?: string;
  appId?: string;
  clientId?: string;
  clientSecret?: string;
  timeoutMs?: number;
}

interface SlackApiBody {
  ok: boolean;
  ts?: string;
  channel?: string;
  error?: string;
}

@Injectable()
export class SlackProvider implements IChatProvider {
  private readonly logger = new Logger(SlackProvider.name);
  private readonly botToken?: string;
  private readonly webhookUrl?: string;
  private readonly defaultChannel?: string;
  private readonly appId?: string;
  private readonly timeoutMs: number;

  constructor(config: SlackProviderConfig = {}) {
    this.botToken = config.botToken ?? config.token;
    this.webhookUrl = config.webhookUrl;
    this.defaultChannel = config.defaultChannel;
    this.appId = config.appId;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;

    if ((config.clientId || config.clientSecret) && !this.botToken) {
      this.logger.warn(
        "Slack received clientId/clientSecret without botToken; the OAuth install flow must exchange them for a token before sends work",
      );
    }
  }

  async sendMessage(payload: ChatPayload): Promise<ChatResponse> {
    const destination = payload.channel || this.defaultChannel || this.webhookUrl;
    if (!destination) {
      return this.failure(
        "No destination (Slack channel/user ID, or webhook URL) on payload",
        false,
        true,
      );
    }

    const text = payload.message || payload.subject || DEFAULT_FALLBACK_TEXT;
    const blocks = Array.isArray(payload.blocks) ? payload.blocks : undefined;
    const attachments = this.buildAttachments(payload);

    if (this.isIncomingWebhook(destination)) {
      return this.sendViaIncomingWebhook(destination, text, blocks, attachments);
    }

    if (!this.botToken) {
      return this.failure(
        "Destination is a Slack channel/user ID but no botToken is configured",
        false,
        true,
      );
    }

    return this.sendViaWebApi(destination, text, blocks, attachments);
  }

  async validateConfig(config?: unknown): Promise<boolean> {
    const candidate = (config ?? {}) as SlackProviderConfig;
    const token = candidate.botToken ?? candidate.token ?? this.botToken;
    const webhookUrl = candidate.webhookUrl ?? this.webhookUrl;
    return Boolean(token || webhookUrl);
  }

  getProviderName(): string {
    return "slack";
  }

  private async sendViaWebApi(
    channel: string,
    text: string,
    blocks: unknown[] | undefined,
    attachments: unknown[] | undefined,
  ): Promise<ChatResponse> {
    try {
      const response = await fetch(WEB_API_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.botToken}`,
          "Content-Type": "application/json; charset=utf-8",
        },
        body: JSON.stringify({
          channel,
          text,
          ...(blocks ? { blocks } : {}),
          ...(attachments ? { attachments } : {}),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const body = (await response.json()) as SlackApiBody;

      if (!body.ok) {
        const invalidDestination = INVALID_DESTINATION_ERRORS.has(body.error ?? "");
        const retryable =
          !body.error ||
          RETRYABLE_ERRORS.has(body.error) ||
          response.status === 429 ||
          response.status >= 500;

        this.logger.warn(
          `Slack chat.postMessage failed for app ${this.appId ?? "default"}: ${body.error ?? response.status}`,
        );

        return this.failure(
          body.error ?? `Slack API error ${response.status}`,
          retryable,
          invalidDestination,
        );
      }

      const messageId = body.ts ? `${body.channel ?? channel}:${body.ts}` : undefined;
      return this.success(messageId);
    } catch (error) {
      return this.failure(this.errorMessage(error), true);
    }
  }

  private async sendViaIncomingWebhook(
    url: string,
    text: string,
    blocks: unknown[] | undefined,
    attachments: unknown[] | undefined,
  ): Promise<ChatResponse> {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json; charset=utf-8" },
        body: JSON.stringify({
          text,
          ...(blocks ? { blocks } : {}),
          ...(attachments ? { attachments } : {}),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const body = (await response.text()).trim();

      if (!response.ok || body !== "ok") {
        const invalidDestination = INVALID_WEBHOOK_BODIES.has(body);
        const retryable = !invalidDestination && !isPermanentStatus(response.status);

        this.logger.warn(
          `Slack incoming webhook failed for app ${this.appId ?? "default"}: ${body || response.status}`,
        );

        return this.failure(body || `HTTP ${response.status}`, retryable, invalidDestination);
      }

      return this.success(undefined);
    } catch (error) {
      return this.failure(this.errorMessage(error), true);
    }
  }

  private buildAttachments(payload: ChatPayload): unknown[] | undefined {
    if (!payload.attachments?.length) {
      return undefined;
    }

    return payload.attachments.map((attachment) => ({
      ...(attachment.type === "image" ? { image_url: attachment.url } : {}),
      ...(attachment.filename ? { title: attachment.filename } : {}),
      ...(attachment.type !== "image" ? { title_link: attachment.url } : {}),
    }));
  }

  private isIncomingWebhook(destination: string): boolean {
    try {
      const url = new URL(destination);
      return url.protocol === "https:" && INCOMING_WEBHOOK_HOSTS.has(url.hostname.toLowerCase());
    } catch {
      return false;
    }
  }

  private success(messageId: string | undefined): ChatResponse {
    return {
      success: true,
      messageId,
      timestamp: new Date().toISOString(),
      provider: "slack",
    };
  }

  private failure(error: string, retryable: boolean, invalidDestination = false): ChatResponse {
    return {
      success: false,
      error,
      provider: "slack",
      retryable,
      invalidDestination,
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Slack send failed";
  }
}

function isPermanentStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
