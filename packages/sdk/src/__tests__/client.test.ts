import { beforeEach, describe, expect, test, vi } from "vitest";

const http = vi.hoisted(() => ({
  post: vi.fn(),
  get: vi.fn(),
  patch: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  create: vi.fn(),
  interceptor: null as ((e: unknown) => unknown) | null,
}));

vi.mock("axios", () => ({
  default: {
    create: http.create.mockImplementation(() => ({
      post: http.post,
      get: http.get,
      patch: http.patch,
      put: http.put,
      delete: http.delete,
      interceptors: {
        response: {
          use: vi.fn((_ok: unknown, onError: (e: unknown) => unknown) => {
            http.interceptor = onError;
          }),
        },
      },
    })),
  },
}));

import { Sanarwa } from "../client";

describe("Sanarwa client", () => {
  let client: Sanarwa;

  beforeEach(() => {
    vi.clearAllMocks();
    http.post.mockResolvedValue({ data: { id: "ntf_1", status: "queued" } });
    http.get.mockResolvedValue({ data: {} });
    http.patch.mockResolvedValue({ data: {} });
    client = new Sanarwa({ key: "k" });
  });

  test("uses the /api/v1 base url the api actually serves", () => {
    new Sanarwa("k");
    expect(http.create).toHaveBeenCalledWith(
      expect.objectContaining({ baseURL: "https://api.sanarwa.com/api/v1" }),
    );
  });

  test("exposes every channel component plus transport", () => {
    for (const key of [
      "email",
      "sms",
      "voice",
      "inapp",
      "push",
      "whatsapp",
      "analytics",
      "templates",
      "notificationCenter",
      "transport",
    ]) {
      expect(client[key as keyof Sanarwa], key).toBeDefined();
    }
  });

  test("email.send posts the flat transport contract", async () => {
    await client.email.send({ to: "a@b.com", channel: "email", message: "hi" });

    expect(http.post).toHaveBeenCalledWith("/notifications/send", {
      to: "a@b.com",
      channel: "email",
      message: "hi",
    });
  });

  test("a channel component pins the channel rather than trusting the caller", async () => {
    await client.sms.send({ to: "+1", channel: "email", message: "hi" });

    expect(http.post.mock.calls[0][1]).toMatchObject({ channel: "sms" });
  });

  test("bulk send posts to /notifications/send/bulk and pins every channel", async () => {
    await client.email.bulkSend({
      notifications: [
        { to: "a@b.com", channel: "sms", message: "one" },
        { to: "c@d.com", channel: "sms", message: "two" },
      ],
    });

    expect(http.post.mock.calls[0][0]).toBe("/notifications/send/bulk");
    for (const n of http.post.mock.calls[0][1].notifications) {
      expect(n.channel).toBe("email");
    }
  });

  test("whatsapp.sendTemplate hits the template route with the controller dto", async () => {
    await client.whatsapp.sendTemplate({
      to: "+1",
      templateName: "order_update",
      parameters: [{ type: "text", text: "A-42" }],
    });

    expect(http.post).toHaveBeenCalledWith("/whatsapp/messages/template", {
      to: "+1",
      templateName: "order_update",
      languageCode: "en",
      parameters: [{ type: "text", text: "A-42" }],
    });
  });

  test("template versions are tenant scoped", async () => {
    await client.templates.getVersions("tenant-1", "tpl-1");
    expect(http.get).toHaveBeenCalledWith("/tenants/tenant-1/templates/tpl-1/versions");
  });

  test("notification centre is tenant scoped", async () => {
    await client.notificationCenter.getFeed("tenant-1", "sub-1");
    expect(http.get).toHaveBeenCalledWith("/tenants/tenant-1/notifications/center/feed/sub-1", {
      params: undefined,
    });
  });

  test("status and health use the transport routes", async () => {
    await client.getNotificationStatus("trk_1");
    await client.getHealth();

    expect(http.get.mock.calls[0][0]).toBe("/notifications/status/trk_1");
    expect(http.get.mock.calls[1][0]).toBe("/notifications/health");
  });

  test("the response interceptor turns an api error into a readable message", () => {
    expect(() =>
      http.interceptor?.({ response: { data: { error: "bad", message: "nope" } } }),
    ).toThrow("bad: nope");
  });

  test("the response interceptor rethrows a network failure unchanged", () => {
    const original = new Error("socket hang up");
    expect(() => http.interceptor?.(original)).toThrow(original);
  });
});
