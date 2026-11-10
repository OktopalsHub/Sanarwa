import { createServer as createHttpServer } from "node:http";
import type { IncomingMessage, ServerResponse } from "node:http";
import { randomUUID } from "node:crypto";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";

import { ConfigError, resolveConfig, type ResolvedConfig } from "./config.js";
import { createClient, createServer } from "./server.js";

const SESSION_HEADER = "mcp-session-id";

export async function main(argv = process.argv.slice(2)): Promise<void> {
  const mode = pickMode(argv, process.env.SANARWA_MCP_TRANSPORT);

  let config: ResolvedConfig;
  try {
    config = resolveConfig(process.env);
  } catch (error) {
    if (error instanceof ConfigError) {
      process.stderr.write(
        `Configuration error: ${error.message}\n\n` +
          `Set SANARWA_API_KEY (and optionally SANARWA_BASE_URL, SANARWA_MCP_PORT, SANARWA_MCP_HOST).\n`,
      );
      process.exit(2);
    }
    throw error;
  }

  if (mode === "stdio") {
    await runStdio(config);
    return;
  }

  await runHttp(config);
}

function pickMode(argv: string[], envValue: string | undefined): "stdio" | "http" {
  const flag = argv.find((a) => a === "--http" || a === "--stdio");
  if (flag === "--http") return "http";
  if (flag === "--stdio") return "stdio";

  const fromEnv = envValue?.toLowerCase();
  if (fromEnv === "http" || fromEnv === "streamable-http") return "http";
  return "stdio";
}

async function runStdio(config: ResolvedConfig): Promise<void> {
  const server = createServer(createClient(config));
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write("sanarwa-mcp listening on stdio\n");
}

async function runHttp(config: ResolvedConfig): Promise<void> {
  const sessions = new Map<string, ReturnType<typeof createServer>>();

  const server = createHttpServer(async (req: IncomingMessage, res: ServerResponse) => {
    if (
      req.method === "GET" &&
      new URL(req.url ?? "/", "http://localhost").pathname === "/health"
    ) {
      res.writeHead(200, { "content-type": "application/json" });
      res.end(JSON.stringify({ status: "ok", baseUrl: config.baseUrl }));
      return;
    }

    const sessionId = req.headers[SESSION_HEADER] as string | undefined;
    const existing = sessionId ? sessions.get(sessionId) : undefined;

    if (existing) {
      const transport = (existing as unknown as { __transport?: StreamableHTTPServerTransport })
        .__transport;
      if (transport) {
        await transport.handleRequest(req, res, await readBody(req));
        return;
      }
    }

    if (!req.headers["content-type"]?.includes("application/json")) {
      res.writeHead(415, { "content-type": "application/json" });
      res.end(JSON.stringify({ error: "Expected application/json" }));
      return;
    }

    const mcpServer = createServer(createClient(config));
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (id: string) => {
        sessions.set(id, mcpServer);
      },
    });

    transport.onclose = () => {
      if (transport.sessionId) sessions.delete(transport.sessionId);
    };

    (mcpServer as unknown as { __transport?: StreamableHTTPServerTransport }).__transport =
      transport;

    await mcpServer.connect(transport);
    await transport.handleRequest(req, res, await readBody(req));
  });

  server.listen(config.port, config.host, () => {
    process.stderr.write(`sanarwa-mcp listening on http://${config.host}:${config.port}/mcp\n`);
  });
}

async function readBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) chunks.push(chunk as Buffer);
  if (chunks.length === 0) return undefined;
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return undefined;
  }
}

const invokedDirectly =
  process.argv[1]?.includes("sanarwa-mcp") || process.argv[1]?.includes("index.js");

if (invokedDirectly) {
  main().catch((error) => {
    process.stderr.write(`fatal: ${error instanceof Error ? error.stack : String(error)}\n`);
    process.exit(1);
  });
}
