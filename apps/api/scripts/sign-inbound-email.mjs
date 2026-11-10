#!/usr/bin/env node
import { createHmac } from "node:crypto";

function usage() {
  console.error(
    "Usage: INBOUND_EMAIL_SECRET=<secret> node apps/api/scripts/sign-inbound-email.mjs \\\n" +
      "  --tenantId <id> --messageId <id> --threadId <id> --senderAddress <email> \\\n" +
      "  [--subject <s>] [--textBody <s>] [--epochMs <ms>] [--expiresAt <iso>]\n",
  );
  process.exit(1);
}

const args = process.argv.slice(2);
const opts = {};
for (let i = 0; i < args.length; i++) {
  const a = args[i];
  if (a.startsWith("--")) {
    const key = a.slice(2);
    const val = args[i + 1] && !args[i + 1].startsWith("--") ? args[++i] : "true";
    opts[key] = val;
  }
}

const secret = process.env.INBOUND_EMAIL_SECRET;
if (!secret) {
  console.error("INBOUND_EMAIL_SECRET is required");
  process.exit(1);
}

const tenantId = opts.tenantId;
const messageId = opts.messageId;
const threadId = opts.threadId;
const senderAddress = opts.senderAddress;
if (!tenantId || !messageId || !threadId || !senderAddress) {
  usage();
}

const epochMs = String(opts.epochMs ?? Date.now());
const hmacHex = createHmac("sha256", secret)
  .update(`${tenantId}:${messageId}:${threadId}:${epochMs}`)
  .digest("hex");

const payload = {
  tenantId,
  messageId,
  threadId,
  epochMs,
  hmacHex,
  senderAddress,
  ...(opts.subject ? { subject: opts.subject } : {}),
  ...(opts.textBody ? { textBody: opts.textBody } : {}),
  ...(opts.expiresAt ? { expiresAt: opts.expiresAt } : {}),
};

process.stdout.write(JSON.stringify(payload, null, 2) + "\n");
