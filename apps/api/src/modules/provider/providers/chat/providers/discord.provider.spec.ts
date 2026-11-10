import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DiscordProvider } from "./discord.provider";

const fetchMock = vi.fn();
const WEBHOOK = "https://discord.com/api/webhooks/123456789/token";

describe("DiscordProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("posts the subject and body to the webhook with wait=true", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "discord-message-1" }),
    });

    const result = await new DiscordProvider({ webhookUrl: WEBHOOK }).sendMessage({
      channel: WEBHOOK,
      subject: "Deploy",
      message: "All green",
    });

    expect(result).toMatchObject({
      success: true,
      messageId: "discord-message-1",
      provider: "discord",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toBe(`${WEBHOOK}?wait=true`);
    expect(JSON.parse(init.body)).toMatchObject({ content: "**Deploy**\nAll green" });
  });

  it("rejects a destination that is not a Discord webhook", async () => {
    const result = await new DiscordProvider().sendMessage({
      channel: "https://example.com/api/webhooks/1/x",
      message: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.invalidDestination).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("treats 401 and 404 as invalid destinations", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 404,
      text: async () => "Unknown Webhook",
    });

    const result = await new DiscordProvider({ webhookUrl: WEBHOOK }).sendMessage({
      channel: WEBHOOK,
      message: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.invalidDestination).toBe(true);
    expect(result.retryable).toBe(false);
  });

  it("retries server errors", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "unavailable",
    });

    const result = await new DiscordProvider({ webhookUrl: WEBHOOK }).sendMessage({
      channel: WEBHOOK,
      message: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it("validates the webhook host", async () => {
    expect(await new DiscordProvider().validateConfig()).toBe(false);
    expect(await new DiscordProvider({ webhookUrl: WEBHOOK }).validateConfig()).toBe(true);
    expect(
      await new DiscordProvider({
        webhookUrl: "https://example.com/api/webhooks/1/x",
      }).validateConfig(),
    ).toBe(false);
  });
});
