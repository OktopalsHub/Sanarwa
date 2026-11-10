import { Injectable, Logger } from "@nestjs/common";
import { ChatPayload, ChatResponse, IChatProvider } from "../chat-provider.interface";

const TELEGRAM_API_HOST = "https://api.telegram.org";
const DEFAULT_TIMEOUT_MS = 10_000;

export type TelegramParseMode = "HTML" | "MarkdownV2" | "Markdown";

export interface TelegramProviderConfig {
  botToken?: string;
  parseMode?: TelegramParseMode;
  defaultChatId?: string;
  timeoutMs?: number;
}

interface TelegramApiBody {
  ok: boolean;
  result?: { message_id: number };
  error_code?: number;
  description?: string;
}

@Injectable()
export class TelegramProvider implements IChatProvider {
  private readonly logger = new Logger(TelegramProvider.name);
  private readonly botToken?: string;
  private readonly parseMode?: string;
  private readonly defaultChatId?: string;
  private readonly timeoutMs: number;

  constructor(config: TelegramProviderConfig = {}) {
    this.botToken = config.botToken;
    this.parseMode = config.parseMode;
    this.defaultChatId = config.defaultChatId;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  async sendMessage(payload: ChatPayload): Promise<ChatResponse> {
    const chatId = payload.channel || this.defaultChatId;
    if (!chatId) {
      return this.failure("No destination (Telegram chat id) on payload", false, true);
    }

    if (!this.botToken) {
      return this.failure("No Telegram bot token configured", false, true);
    }

    const text = [payload.subject, payload.message]
      .filter((part): part is string => typeof part === "string" && part.length > 0)
      .join("\n\n");

    if (!text) {
      return this.failure("No message text on payload", false, true);
    }

    const metadata = payload.metadata ?? {};
    const parseMode = typeof metadata.parseMode === "string" ? metadata.parseMode : this.parseMode;

    try {
      const response = await fetch(`${TELEGRAM_API_HOST}/bot${this.botToken}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chat_id: chatId,
          text,
          ...(parseMode ? { parse_mode: parseMode } : {}),
          ...(metadata.disableWebPagePreview
            ? { link_preview_options: { is_disabled: true } }
            : {}),
          ...(metadata.disableNotification ? { disable_notification: true } : {}),
        }),
        signal: AbortSignal.timeout(this.timeoutMs),
      });

      const body = (await response.json()) as TelegramApiBody;

      if (!body.ok) {
        const invalidDestination =
          body.error_code === 403 ||
          (body.error_code === 400 &&
            /chat not found|user is deactivated|bot was blocked/i.test(body.description ?? ""));
        const retryable =
          !invalidDestination && !isPermanentStatus(body.error_code ?? response.status);

        this.logger.warn(
          `Telegram send failed with ${body.error_code ?? response.status}: ${body.description ?? "unknown"}`,
        );

        return this.failure(
          body.description ?? `Telegram API error ${body.error_code ?? response.status}`,
          retryable,
          invalidDestination,
        );
      }

      return {
        success: true,
        messageId: body.result?.message_id ? String(body.result.message_id) : undefined,
        timestamp: new Date().toISOString(),
        provider: "telegram",
      };
    } catch (error) {
      return this.failure(this.errorMessage(error), true);
    }
  }

  async validateConfig(config?: unknown): Promise<boolean> {
    const candidate = (config ?? {}) as TelegramProviderConfig;
    return Boolean(candidate.botToken ?? this.botToken);
  }

  getProviderName(): string {
    return "telegram";
  }

  private failure(error: string, retryable: boolean, invalidDestination = false): ChatResponse {
    return {
      success: false,
      error,
      provider: "telegram",
      retryable,
      invalidDestination,
    };
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "Telegram send failed";
  }
}

function isPermanentStatus(status: number): boolean {
  return status >= 400 && status < 500 && status !== 408 && status !== 429;
}
