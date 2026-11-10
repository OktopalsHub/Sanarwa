import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { TelegramProvider } from "./telegram.provider";

const fetchMock = vi.fn();
const TOKEN = "123456789:abcdefghijklmnop";

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

describe("TelegramProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends to the configured bot and chat id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, result: { message_id: 42 } }));

    const result = await new TelegramProvider({ botToken: TOKEN }).sendMessage({
      channel: "-100123",
      subject: "Deploy",
      message: "All green",
    });

    expect(result).toMatchObject({
      success: true,
      messageId: "42",
      provider: "telegram",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`https://api.telegram.org/bot${TOKEN}/sendMessage`);
    expect(JSON.parse(init.body)).toMatchObject({
      chat_id: "-100123",
      text: "Deploy\n\nAll green",
    });
  });

  it("falls back to the configured default chat id", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: true, result: { message_id: 1 } }));

    await new TelegramProvider({ botToken: TOKEN, defaultChatId: "-200" }).sendMessage({
      channel: "",
      message: "hello",
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body).chat_id).toBe("-200");
  });

  it("marks a blocked bot as an invalid destination", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({
        ok: false,
        error_code: 403,
        description: "Forbidden: bot was blocked by the user",
      }),
    );

    const result = await new TelegramProvider({ botToken: TOKEN }).sendMessage({
      channel: "-100123",
      message: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.invalidDestination).toBe(true);
    expect(result.retryable).toBe(false);
  });

  it("requires a bot token", async () => {
    const result = await new TelegramProvider().sendMessage({
      channel: "-100123",
      message: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.invalidDestination).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates configuration with the bot token only", async () => {
    expect(await new TelegramProvider().validateConfig()).toBe(false);
    expect(await new TelegramProvider({ botToken: TOKEN }).validateConfig()).toBe(true);
  });
});
