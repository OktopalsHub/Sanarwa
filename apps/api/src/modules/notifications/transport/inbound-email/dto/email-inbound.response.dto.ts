export class EmailInboundResponseDto {
  status: "received" | "suppressed" | "rejected";
  threadId?: string;
  messageId?: string;
  reason?: string;
  error?: string;
}
