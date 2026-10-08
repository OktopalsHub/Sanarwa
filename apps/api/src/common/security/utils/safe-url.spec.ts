import { describe, expect, it } from "vitest";
import { assertSafeWebhookUrl } from "./safe-url";

describe("assertSafeWebhookUrl", () => {
  it("accepts public http and https URLs", async () => {
    await expect(assertSafeWebhookUrl("https://example.com/webhook")).resolves.toBeUndefined();
  });

  it("rejects local and private addresses", async () => {
    await expect(assertSafeWebhookUrl("http://127.0.0.1/webhook")).rejects.toThrow(
      "blocked host",
    );
    await expect(assertSafeWebhookUrl("http://10.0.0.5/webhook")).rejects.toThrow(
      "blocked host",
    );
    await expect(assertSafeWebhookUrl("http://localhost/webhook")).rejects.toThrow(
      "blocked host",
    );
  });

  it("rejects non-http protocols", async () => {
    await expect(assertSafeWebhookUrl("file:///etc/passwd")).rejects.toThrow(
      "http or https",
    );
  });
});
