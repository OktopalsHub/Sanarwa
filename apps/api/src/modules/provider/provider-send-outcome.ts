export type ProviderSendOutcome =
  | {
      readonly status: "sent";
      readonly externalId?: string;
      readonly providerId?: string;
      readonly failedTokens?: string[];
    }
  | {
      readonly status: "failed";
      readonly reason: string;
      readonly providerId?: string;
      readonly retryable?: boolean;
      readonly failedTokens?: string[];
    };

export interface ProviderSendShapes {
  success?: boolean;
  status?: unknown;
  messageId?: unknown;
  MessageId?: unknown;
  error?: unknown;
  retryable?: unknown;
  failedTokens?: unknown;
}

const FAILED_EMAIL_STATUSES = new Set(["failed", "error", "rejected"]);

export function toProviderSendOutcome(result: unknown): ProviderSendOutcome {
  if (result === null || result === undefined) {
    return { status: "failed", reason: "provider returned no result" };
  }

  const shape = result as ProviderSendShapes;
  const externalId = pickIdentifier(shape);

  if (typeof shape.status === "string") {
    if (FAILED_EMAIL_STATUSES.has(shape.status)) {
      return { status: "failed", reason: extractReason(shape) };
    }
    return { status: "sent", externalId };
  }

  if (typeof shape.success === "boolean") {
    if (!shape.success) {
      return {
        status: "failed",
        reason: extractReason(shape),
        ...(typeof shape.retryable === "boolean" ? { retryable: shape.retryable } : {}),
        ...(pickFailedTokens(shape) ? { failedTokens: pickFailedTokens(shape) } : {}),
      };
    }
    return {
      status: "sent",
      externalId,
      ...(pickFailedTokens(shape) ? { failedTokens: pickFailedTokens(shape) } : {}),
    };
  }

  if (externalId) {
    return { status: "sent", externalId };
  }

  return { status: "failed", reason: "unrecognized provider result shape" };
}

function pickFailedTokens(shape: ProviderSendShapes): string[] | undefined {
  const tokens = shape.failedTokens;
  if (!Array.isArray(tokens)) {
    return undefined;
  }
  const cleaned = tokens.filter(
    (token): token is string => typeof token === "string" && token.length > 0,
  );
  return cleaned.length > 0 ? cleaned : undefined;
}

function pickIdentifier(shape: ProviderSendShapes): string | undefined {
  const candidates = [shape.messageId, shape.MessageId];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.length > 0) {
      return candidate;
    }
  }
  return undefined;
}

function extractReason(shape: ProviderSendShapes): string {
  if (typeof shape.error === "string" && shape.error.length > 0) {
    return shape.error;
  }
  return "provider reported failure";
}
