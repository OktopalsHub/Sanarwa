import { Injectable, Logger } from "@nestjs/common";
import { ChatPayload, ChatResponse, IChatProvider } from "../chat-provider.interface";

const ALLOWED_DISCORD_HOSTS = new Set([
  "discord.com",
  "discordapp.com",
  "ptb.discord.com",
  "canary.discord.com",
]);
const DEFAULT_TIMEOUT_MS = 10_000;

export interface DiscordProviderConfig {
  webhookUrl?: string;
  username?: string;
  avatarUrl?: string;
  timeoutMs?: number;
}

@Injectable()
export class DiscordProvider implements IChatProvider {
  private readonly logger = new Logger(DiscordProvider.name);
  private readonly webhookUrl?: string;
  private readonly username?: string;
  private readonly avatarUrl?: string;
  private readonly timeoutMs: number;

  constructor(config: DiscordProviderConfig = {}) {
    this.webhookUrl = config.webhookUrl;
    this.username = config.username;
    this.avatarUrl = config.avatarUrl;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async sendMessage(payload: ChatPayload): Promise<ChatResponse> {
    const destination = payload.channel || this.webhookUrl;
    if (!destination) {
      return this.failure("No destination (Discord webhook URL) on payload", false, true);
    }

    const content = this.buildContent(payload);
    const metadata = payload.metadata ?? {};
    const username =
      typeof metadata.username === "string" && metadata.username
        ? metadata.username
        : this.username;
    const avatarUrl =
      typeof metadata.avatarUrl === "string" && metadata.avatarUrl
        ? metadata.avatarUrl
        : this.avatarUrl;
    const embeds = this.buildEmbeds(payload);

    try {
      const url = new URL(destination);
      if (!isValidDiscordWebhookUrl(url)) {
        this.logger.warn("Rejected Discord destination that is not a webhook URL");
        return this.failure(
          "Invalid Discord webhook URL: destination must be an https://discord.com/api/webhooks/ URL",
          false,
          true,
        );
      }

      url.searchParams.set("wait", "true");

      const response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content,
          ...(username ? { username } : {}),
          ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
          ...(embeds ? { embeds } : {}),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        const invalidDestination = response.status === 401 || response.status === 404;
        const retryable = !invalidDestination && !isPermanentStatus(response.status);

        this.logger.warn(`Discord webhook failed with ${response.status}`);

        return this.failure(
          `Discord webhook error ${response.status}: ${errorBody}`,
          retryable,
          invalidDestination,
        );
      }

      const body = (await response.json().catch(() => null)) as { id?: string } | null;
      return {
        success: true,
        messageId: body?.id,
        timestamp: new Date().toISOString(),
        provider: "discord",
      };
    } catch (error) {
      return this.failure(this.errorMessage(error), true);
    }
  }

  async validateConfig(config?: unknown): Promise<boolean> {
    const candidate = (config ?? {}) as DiscordProviderConfig;
    const webhookUrl = candidate.webhookUrl ?? this.webhookUrl;
    if (!webhookUrl) {
      return false;
    }

    try {
      return isValidDiscordWebhookUrl(new URL(webhookUrl));
    } catch {
      return false;
    }
  }

  getProviderName(): string {
    return "discord";
  }

  private buildContent(payload: ChatPayload): string {
    const body = payload.message;
    const subject = payload.subject;
    return [subject ? `**${subject}**` : undefined, body]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join("\n");
  }

  private buildEmbeds(payload: ChatPayload): unknown[] | undefined {
    if (Array.isArray(payload.embeds)) {
      return payload.embeds;
    }

    if (!payload.attachments?.length) {
      return undefined;
    }

    return payload.attachments.map((attachment) => ({
      ...(attachment.type === "image" ? { image: { url: attachment.url } } : {}),
      ...(attachment.filename ? { title: attachment.filename } : {}),
      ...(attachment.type !== "image" ? { url: attachment.url } : {}),
    }));
  }

  private failure(error: string, retryable: boolean, invalidDestination = false): ChatResponse {
    return {
      success: false,
      error,
      provider: "discord",
      retryable,
      invalidDestination,
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Discord send failed";
  }
}

function isValidDiscordWebhookUrl(url: URL): boolean {
  return (
    url.protocol === "https:" &&
    ALLOWED_DISCORD_HOSTS.has(url.hostname.toLowerCase()) &&
    url.pathname.startsWith("/api/webhooks/")
  );
}

function isPermanentStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
