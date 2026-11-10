export interface OperationBinding {
  tool: string;
  method: string;
  path: string;
  specPath: string;
}

/**
 * Every operation the OpenAPI spec publishes, bound to the MCP tool that exposes it
 * and the API path that tool actually calls.
 *
 * `specPath` is what docs/openapi/openapi.json says. `path` is what the SDK sends.
 * `__tests__/drift.test.ts` fails when a spec operation has no tool, when two tools
 * claim the same operation, or when `path` is not a route the API actually serves.
 */
export const OPERATION_BINDINGS: OperationBinding[] = [
  {
    tool: "notification_send",
    method: "POST",
    specPath: "/notifications/send",
    path: "/notifications/send",
  },
  {
    tool: "notification_send_bulk",
    method: "POST",
    specPath: "/notifications/send/bulk",
    path: "/notifications/send/bulk",
  },
  {
    tool: "notification_status",
    method: "GET",
    specPath: "/notifications/status/{trackingId}",
    path: "/notifications/status/:trackingId",
  },
  {
    tool: "notification_analytics",
    method: "GET",
    specPath: "/notifications/analytics",
    path: "/notifications/analytics",
  },
  {
    tool: "notification_health",
    method: "GET",
    specPath: "/notifications/health",
    path: "/notifications/health",
  },
  {
    tool: "push_send",
    method: "POST",
    specPath: "/push",
    path: "/notifications/send",
  },
  {
    tool: "push_send_bulk",
    method: "POST",
    specPath: "/push/bulk",
    path: "/notifications/send/bulk",
  },
  {
    tool: "whatsapp_send",
    method: "POST",
    specPath: "/whatsapp/messages/send",
    path: "/notifications/send",
  },
  {
    tool: "whatsapp_send_template",
    method: "POST",
    specPath: "/whatsapp/messages/template",
    path: "/whatsapp/messages/template",
  },
];
