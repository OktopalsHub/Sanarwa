export interface ErrorContext {
  context?: string;
  user?: {
    id?: string;
    email?: string;
    tenantId?: string;
  };
  extra?: Record<string, unknown>;
  tags?: Record<string, string>;
  level?: "error" | "warning" | "info" | "debug";
}

let currentUser: ErrorContext["user"] = undefined;
const scopedContext: Record<string, unknown> = {};

export function setUser(user: ErrorContext["user"]) {
  currentUser = user;
}

export function setContext(key: string, value: Record<string, unknown>) {
  scopedContext[key] = value;
}

export function reportError(error: Error | string, context?: ErrorContext): string {
  const id = `err_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const message = typeof error === "string" ? error : error.message;

  if (process.env.NODE_ENV !== "production") {
    console.error(`[monitoring] ${id} ${message}`, {
      context: context?.context,
      level: context?.level ?? "error",
      user: context?.user ?? currentUser,
      extra: context?.extra,
      tags: context?.tags,
      scopes: scopedContext,
      error,
    });
  }

  return id;
}
