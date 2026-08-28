"use client";

import { Button } from "@/components/ui/button";
import { useState } from "react";

export const SEND_SNIPPET = `curl -X POST https://api.sanarwa.dev/v1/messages \\
  -H "Authorization: Bearer $SANARWA_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "channel": "email",
    "from": "PayLink <receipts@paylink.ng>",
    "to": "amaka@halo.ng",
    "subject": "Receipt for ₦45,000",
    "html": "<p>Payment received. Thank you, Amaka.</p>"
  }'`;

export function SendSnippet() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(SEND_SNIPPET);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="relative">
      <pre className="overflow-x-auto rounded-md border bg-muted/40 p-4 text-xs leading-relaxed">
        <code>{SEND_SNIPPET}</code>
      </pre>
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="absolute right-2 top-2"
        onClick={copy}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}
