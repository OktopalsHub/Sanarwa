import { describe, expect, it } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { Sanarwa } from "@sanarwa/sdk";

import { createServer } from "../server.js";
import { OPERATION_BINDINGS } from "../manifest.js";

const stubClient = {
  transport: {
    send: async (req: { channel?: string }) => ({
      id: "ntf_1",
      trackingId: "trk_1",
      status: "queued",
      channel: req.channel ?? "email",
      to: "x",
    }),
    sendBulk: async () => ({ batchId: "batch_1", status: "queued", results: [] }),
    analytics: async () => ({ sent: 3 }),
  },
  whatsapp: {
    sendTemplate: async () => ({ messagingProduct: "whatsapp", id: "wamid.1" }),
  },
  getNotificationStatus: async () => ({ status: "delivered" }),
  getHealth: async () => ({ status: "healthy" }),
} as unknown as Sanarwa;

async function connect() {
  const server = createServer(stubClient);
  const client = new Client({ name: "test", version: "1.0.0" });
  const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
  return client;
}

describe("mcp server", () => {
  it("advertises every tool in the manifest", async () => {
    const client = await connect();
    const { tools } = await client.listTools();

    expect(tools.map((t) => t.name).sort()).toEqual(OPERATION_BINDINGS.map((b) => b.tool).sort());
  });

  it("gives every tool a description and an input schema", async () => {
    const client = await connect();
    const { tools } = await client.listTools();

    for (const tool of tools) {
      expect(tool.description, `${tool.name} needs a description`).toBeTruthy();
      expect(tool.inputSchema, `${tool.name} needs an input schema`).toBeTruthy();
    }
  });

  it("sends a notification as the flat transport contract", async () => {
    let seen: unknown;
    const client = await connect();
    const server = createServer({
      ...stubClient,
      transport: {
        ...stubClient.transport,
        send: async (req: unknown) => {
          seen = req;
          return { id: "ntf_1", status: "queued" };
        },
      },
    } as unknown as Sanarwa);

    const mcp = new Client({ name: "t", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), mcp.connect(ct)]);

    await mcp.callTool({
      name: "notification_send",
      arguments: { to: "user@example.com", channel: "email", data: "hi" },
    });

    expect(seen).toMatchObject({ to: "user@example.com", channel: "email", data: "hi" });
  });

  it("maps push title and body onto the transport message", async () => {
    let seen: unknown;
    const server = createServer({
      ...stubClient,
      transport: {
        ...stubClient.transport,
        send: async (req: unknown) => {
          seen = req;
          return { id: "ntf_2", status: "queued" };
        },
      },
    } as unknown as Sanarwa);

    const mcp = new Client({ name: "t", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), mcp.connect(ct)]);

    await mcp.callTool({
      name: "push_send",
      arguments: { to: "fcm:token", subject: "New", data: "You have mail" },
    });

    expect(seen).toMatchObject({
      to: "fcm:token",
      channel: "push",
      subject: "New",
      data: "You have mail",
    });
  });

  it("passes whatsapp template parameters through unchanged", async () => {
    let seen: unknown;
    const server = createServer({
      ...stubClient,
      whatsapp: {
        sendTemplate: async (req: unknown) => {
          seen = req;
          return { id: "wamid.1" };
        },
      },
    } as unknown as Sanarwa);

    const mcp = new Client({ name: "t", version: "1" });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), mcp.connect(ct)]);

    await mcp.callTool({
      name: "whatsapp_send_template",
      arguments: {
        to: "+1234567890",
        templateName: "order_update",
        parameters: [{ type: "text", text: "A-42" }],
      },
    });

    expect(seen).toMatchObject({
      to: "+1234567890",
      templateName: "order_update",
      languageCode: "en",
      parameters: [{ type: "text", text: "A-42" }],
    });
  });

  it("rejects a send missing required fields", async () => {
    const client = await connect();

    const result = await client.callTool({
      name: "notification_send",
      arguments: { channel: "email" },
    });

    expect(result.isError).toBe(true);
  });

  it("reports an API failure as a tool error rather than throwing", async () => {
    const server = createServer({
      ...stubClient,
      getNotificationStatus: async () => {
        throw new Error("tracking id not found");
      },
    } as unknown as Sanarwa);

    const client = new Client({ name: "test", version: "1.0.0" });
    const [ct, st] = InMemoryTransport.createLinkedPair();
    await Promise.all([server.connect(st), client.connect(ct)]);

    const result = await client.callTool({
      name: "notification_status",
      arguments: { trackingId: "trk_missing" },
    });

    expect(result.isError).toBe(true);
    expect(JSON.stringify(result.content)).toContain("tracking id not found");
  });
});
