import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeToE164Digits, WhatsAppProvider } from "./whatsapp.provider";

const fetchMock = vi.fn();

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  };
}

function createProvider(overrides: Record<string, unknown> = {}) {
  return new WhatsAppProvider({
    accessToken: "token",
    phoneNumberId: "1234567890123456",
    apiVersion: "v21.0",
    ...overrides,
  });
}

describe("WhatsAppProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends a text message to the Graph API", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ messaging_product: "whatsapp", messages: [{ id: "wamid.1" }] }),
    );

    const result = await createProvider().sendMessage({
      channel: "+234 800-000-0000",
      subject: "Receipt",
      message: "Paid",
    });

    expect(result).toMatchObject({
      success: true,
      messageId: "wamid.1",
      provider: "whatsapp",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://graph.facebook.com/v21.0/1234567890123456/messages");
    expect(init.headers.Authorization).toBe("Bearer token");
    expect(JSON.parse(init.body)).toMatchObject({
      messaging_product: "whatsapp",
      to: "2348000000000",
      type: "text",
      text: { body: "Receipt\n\nPaid" },
    });
  });

  it("uses a template when metadata supplies one", async () => {
    fetchMock.mockResolvedValue(jsonResponse({ messages: [{ id: "wamid.2" }] }));

    await createProvider().sendMessage({
      channel: "+2348000000000",
      message: "",
      metadata: {
        whatsappTemplate: {
          name: "order_update",
          language: "en_US",
          components: [{ type: "body", parameters: [{ type: "text", text: "A123" }] }],
        },
      },
    });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({
      type: "template",
      template: {
        name: "order_update",
        language: { code: "en_US" },
        components: [{ type: "body", parameters: [{ type: "text", text: "A123" }] }],
      },
    });
  });

  it("marks an expired token as an invalid destination", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: "Invalid OAuth access token", code: 190 } }, 401),
    );

    const result = await createProvider().sendMessage({
      channel: "+2348000000000",
      message: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.invalidDestination).toBe(true);
    expect(result.retryable).toBe(false);
  });

  it("retries rate limited requests", async () => {
    fetchMock.mockResolvedValue(
      jsonResponse({ error: { message: "rate limited", code: 130429 } }, 429),
    );

    const result = await createProvider().sendMessage({
      channel: "+2348000000000",
      message: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.retryable).toBe(true);
  });

  it("fails locally when credentials are missing", async () => {
    const result = await new WhatsAppProvider().sendMessage({
      channel: "+2348000000000",
      message: "hello",
    });

    expect(result.success).toBe(false);
    expect(result.invalidDestination).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("checks credentials against the phone number endpoint", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "1234567890123456" }));

    expect(await createProvider().verifyCredentials()).toBe(true);
    expect(fetchMock.mock.calls[0][0]).toContain(
      "/1234567890123456?fields=id,display_phone_number",
    );
  });

  it("normalises phone numbers to digits", () => {
    expect(normalizeToE164Digits("+234 800-000-0000")).toBe("2348000000000");
    expect(normalizeToE164Digits("")).toBeUndefined();
    expect(normalizeToE164Digits(undefined)).toBeUndefined();
  });
});
