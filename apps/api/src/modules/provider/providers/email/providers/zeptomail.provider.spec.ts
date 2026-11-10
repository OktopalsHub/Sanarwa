import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ZeptoMailProvider } from "./zeptomail.provider";

const fetchMock = vi.fn();

function createProvider(overrides: Record<string, unknown> = {}) {
  return new ZeptoMailProvider({
    providerId: "zeptomail",
    name: "ZeptoMail",
    isActive: true,
    priority: 1,
    config: {
      apiKey: "test-key",
      apiUrl: "https://api.zeptomail.com/v1.1/email",
      fromEmail: "noreply@example.com",
      fromName: "Sanarwa",
      ...overrides,
    },
  });
}

describe("ZeptoMailProvider", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", fetchMock);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("sends an email through the ZeptoMail API", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      json: async () => ({ request_id: "req-123" }),
    });

    const result = await createProvider().sendEmail({
      to: ["recipient@example.com"],
      subject: "Hello",
      html: "<p>Hello</p>",
      text: "Hello",
    });

    expect(result.status).toBe("sent");
    expect(result.messageId).toBe("req-123");
    expect(result.providerId).toBe("zeptomail");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.zeptomail.com/v1.1/email");
    expect(init.headers.Authorization).toBe("Zoho-enczapikey test-key");

    const body = JSON.parse(init.body);
    expect(body.from).toEqual({ address: "noreply@example.com", name: "Sanarwa" });
    expect(body.to).toEqual([{ email_address: { address: "recipient@example.com" } }]);
    expect(body.subject).toBe("Hello");
    expect(body.htmlbody).toBe("<p>Hello</p>");
    expect(body.textbody).toBe("Hello");
  });

  it("returns a failed result when the API rejects the message", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      statusText: "Bad Request",
      json: async () => ({ error: { message: "Invalid recipient" } }),
    });

    const result = await createProvider().sendEmail({
      to: "recipient@example.com",
      subject: "Hello",
      text: "Hello",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toContain("Invalid recipient");
  });

  it("splits a display-name sender into address and name", async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ request_id: "req-456" }),
    });

    await createProvider().sendEmail({
      to: "recipient@example.com",
      from: "Acme <hello@acme.test>",
      subject: "Hello",
      text: "Hello",
    });

    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.from).toEqual({ address: "hello@acme.test", name: "Acme" });
  });

  it("validates required configuration", async () => {
    const result = await createProvider({ apiKey: "", fromEmail: "" }).validateConfig({
      apiKey: "",
      fromEmail: "",
    });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("API key is required");
    expect(result.errors).toContain("From email is required");
  });
});
