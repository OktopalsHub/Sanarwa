import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SlackProvider } from "./slack.provider";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

describe("SlackProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("posts to chat.postMessage with the bot token", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ ok: true, ts: "1700000000.000100", channel: "C123" }),
    );

    const result = await new SlackProvider({ botToken: "xoxb-token" }).sendMessage({
      channel: "C123",
      message: "Deploy finished",
      blocks: [{ type: "section" }],
    });

    expect(result).toMatchObject({
      success: true,
      messageId: "C123:1700000000.000100",
      provider: "slack",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://slack.com/api/chat.postMessage");
    expect(init.headers.Authorization).toBe("Bearer xoxb-token");

    const body = JSON.parse(init.body);
    expect(body).toMatchObject({
      channel: "C123",
      text: "Deploy finished",
      blocks: [{ type: "section" }],
    });
  });

  it("classifies unknown channels as invalid destinations", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ ok: false, error: "channel_not_found" }));

    const result = await new SlackProvider({ botToken: "xoxb-token" }).sendMessage({
      channel: "#missing",
      message: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.invalidDestination).toBe(true);
    expect(result.retryable).toBe(false);
  });

  it("sends through an incoming webhook without a bot token", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      text: async () => "ok",
    });

    const result = await new SlackProvider().sendMessage({
      channel: "https://hooks.slack.com/services/T/B/X",
      message: "hello",
    });

    expect(result).toMatchObject({ success: true, provider: "slack" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://hooks.slack.com/services/T/B/X");
    expect(JSON.parse(init.body)).toMatchObject({ text: "hello" });
  });

  it("refuses a channel id when no bot token is configured", async () => {
    const result = await new SlackProvider().sendMessage({
      channel: "C123",
      message: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.invalidDestination).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("validates that a token or webhook is configured", async () => {
    expect(await new SlackProvider().validateConfig()).toBe(false);
    expect(
      await new SlackProvider({
        webhookUrl: "https://hooks.slack.com/services/T/B/X",
      }).validateConfig(),
    ).toBe(true);
  });
});
