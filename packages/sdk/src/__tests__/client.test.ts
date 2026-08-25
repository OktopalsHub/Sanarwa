import { Sanarwa } from "../client";
import { beforeEach, describe, expect, test, vi } from "vitest";

vi.mock("axios", () => {
  const create = vi.fn(() => ({
    post: vi.fn(),
    get: vi.fn(),
    patch: vi.fn(),
    interceptors: {
      response: {
        use: vi.fn(),
      },
    },
  }));

  return {
    default: { create },
    create,
  };
});

describe("Sanarwa Client", () => {
  let client: Sanarwa;

  beforeEach(() => {
    client = new Sanarwa({
      key: "test-api-key",
    });
  });

  test("should initialize with correct configuration", () => {
    expect(client).toBeInstanceOf(Sanarwa);
    expect(client.email).toBeDefined();
    expect(client.sms).toBeDefined();
    expect(client.voice).toBeDefined();
    expect(client.inapp).toBeDefined();
    expect(client.push).toBeDefined();
    expect(client.whatsapp).toBeDefined();
  });

  test("should have all component methods", () => {
    expect(typeof client.email.send).toBe("function");
    expect(typeof client.email.bulkSend).toBe("function");
    expect(typeof client.email.getHistory).toBe("function");

    expect(typeof client.sms.send).toBe("function");
    expect(typeof client.sms.bulkSend).toBe("function");
    expect(typeof client.sms.getHistory).toBe("function");

    expect(typeof client.voice.send).toBe("function");
    expect(typeof client.voice.getHistory).toBe("function");

    expect(typeof client.inapp.send).toBe("function");
    expect(typeof client.inapp.bulkSend).toBe("function");
    expect(typeof client.inapp.getStatus).toBe("function");

    expect(typeof client.push.send).toBe("function");
    expect(typeof client.push.bulkSend).toBe("function");
    expect(typeof client.push.getStatus).toBe("function");

    expect(typeof client.whatsapp.send).toBe("function");
    expect(typeof client.whatsapp.bulkSend).toBe("function");
  });

  test("should have client methods", () => {
    expect(typeof client.getNotificationStatus).toBe("function");
    expect(typeof client.scheduleNotification).toBe("function");
    expect(typeof client.templates).toBeDefined();
    expect(typeof client.analytics).toBeDefined();
  });
});
