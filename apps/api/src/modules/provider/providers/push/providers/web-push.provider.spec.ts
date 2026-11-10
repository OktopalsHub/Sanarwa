import { WebPushProvider } from "./web-push.provider";

vi.mock("web-push", () => ({
  sendNotification: vi.fn(async () => ({ statusCode: 201 })),
}));

describe("WebPushProvider", () => {
  let provider: WebPushProvider;
  let subscriptions: { getByEndpoint: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    subscriptions = {
      getByEndpoint: vi.fn(async () => ({
        endpoint: "https://push.example.com/e",
        keys: { p256dh: "key", auth: "auth" },
      })),
    };
    provider = new WebPushProvider(
      {
        get: vi.fn((key: string) =>
          key === "VAPID_PUBLIC_KEY"
            ? "public"
            : key === "VAPID_PRIVATE_KEY"
              ? "private"
              : "mailto:ops@example.com",
        ),
      } as any,
      subscriptions as any,
    );
  });

  it("reports failure when VAPID keys are missing", async () => {
    const unconfigured = new WebPushProvider(
      { get: vi.fn(() => undefined) } as any,
      subscriptions as any,
    );
    await expect(unconfigured.validateConfig()).resolves.toBe(false);
    const result = await unconfigured.sendPushNotification({
      deviceTokens: "https://push.example.com/e",
      title: "t",
      body: "b",
    });
    expect(result.success).toBe(false);
  });

  it("returns failedTokens for unknown endpoints so they get pruned", async () => {
    subscriptions.getByEndpoint.mockResolvedValue(null);
    const result = await provider.sendPushNotification({
      deviceTokens: "https://push.example.com/e",
      title: "t",
      body: "b",
    });
    expect(result.failedTokens).toEqual(["https://push.example.com/e"]);
  });

  it("sends to registered endpoints", async () => {
    const webpush = await import("web-push");
    const result = await provider.sendPushNotification({
      deviceTokens: "https://push.example.com/e",
      title: "hello",
      body: "world",
      actions: [{ id: "view", title: "View" }],
    });
    expect(result.success).toBe(true);
    expect(result.successCount).toBe(1);
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      expect.objectContaining({ endpoint: "https://push.example.com/e" }),
      expect.stringContaining("hello"),
      expect.objectContaining({
        vapidDetails: expect.objectContaining({ publicKey: "public" }),
      }),
    );
  });
});
