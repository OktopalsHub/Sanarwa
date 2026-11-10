import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SMTPProvider } from "./smtp.provider";

const { sendMail, verify } = vi.hoisted(() => ({
  sendMail: vi.fn(),
  verify: vi.fn(),
}));

vi.mock("nodemailer", () => ({
  createTransport: vi.fn(() => ({ sendMail, verify })),
}));

function createProvider(overrides: Record<string, unknown> = {}) {
  return new SMTPProvider({
    providerId: "smtp",
    name: "SMTP",
    isActive: true,
    priority: 1,
    config: {
      host: "smtp.example.com",
      port: 587,
      secure: false,
      username: "user",
      password: "pass",
      fromEmail: "noreply@example.com",
      fromName: "Sanarwa",
      ...overrides,
    },
  });
}

describe("SMTPProvider", () => {
  beforeEach(() => {
    sendMail.mockReset();
    verify.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("sends an email through the SMTP transport", async () => {
    sendMail.mockResolvedValue({ messageId: "smtp-1", accepted: ["to@example.com"], rejected: [] });

    const result = await createProvider().sendEmail({
      to: "to@example.com",
      subject: "Hello",
      html: "<p>Hello</p>",
    });

    expect(result.status).toBe("sent");
    expect(result.messageId).toBe("smtp-1");
    expect(result.providerId).toBe("smtp");
    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Sanarwa" <noreply@example.com>',
        to: "to@example.com",
        subject: "Hello",
        html: "<p>Hello</p>",
      }),
    );
  });

  it("returns a failed result when the transport rejects the message", async () => {
    sendMail.mockRejectedValue(new Error("Connection refused"));

    const result = await createProvider().sendEmail({
      to: "to@example.com",
      subject: "Hello",
      text: "Hello",
    });

    expect(result.status).toBe("failed");
    expect(result.error).toBe("Connection refused");
  });

  it("validates required configuration", async () => {
    const result = await createProvider().validateConfig({ host: "", fromEmail: "not-an-email" });

    expect(result.isValid).toBe(false);
    expect(result.errors).toContain("SMTP host is required");
    expect(result.errors).toContain("Invalid from email format");
  });
});
