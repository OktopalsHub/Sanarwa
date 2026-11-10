import { IsDateString, IsOptional, IsString, MaxLength } from "class-validator";

export class EmailInboundDto {
  /** Tenant identifier (from the signed token) */
  @IsString()
  tenantId: string;

  /** Envelope message ID (dedupe guard) */
  @IsString()
  @MaxLength(512)
  messageId: string;

  /** Thread identifier (links replies to a conversation) */
  @IsString()
  @MaxLength(512)
  threadId: string;

  /** Epoch milliseconds when the token was signed */
  @IsString()
  epochMs: string;

  /** HMAC-SHA256 hex of the token string (tenant:msgId:threadId:epoch) */
  @IsString()
  @MaxLength(128)
  hmacHex: string;

  /** Sender address (checked against suppression, never stored in plaintext) */
  @IsString()
  @MaxLength(320)
  senderAddress: string;

  /** Sender address hash (ignored — the address is the suppression key) */
  @IsOptional()
  @IsString()
  @MaxLength(512)
  senderHash?: string;

  /** Email subject line */
  @IsOptional()
  @IsString()
  @MaxLength(998)
  subject?: string;

  /** Plain-text body (stripped of signatures, quotes, disclaimers) */
  @IsOptional()
  @IsString()
  @MaxLength(200_000)
  textBody?: string;

  /** Optional expiresAt for the inbox item (ISO string, 30d default) */
  @IsOptional()
  @IsDateString()
  expiresAt?: string;

  /**
   * Deprecated: previously the HMAC secret was echoed by the caller, which
   * made every request forgeable. It is accepted so old payloads still parse,
   * but it is ignored — the API verifies against INBOUND_EMAIL_SECRET only.
   */
  @IsOptional()
  @IsString()
  tokenSecret?: string;
}
