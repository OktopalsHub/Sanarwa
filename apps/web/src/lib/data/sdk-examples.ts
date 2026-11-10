export const sdkExamples = {
  javascript: [
    {
      id: "js-send-email",
      title: "Send an email notification",
      description: "Send one email through the SDK and read back the tracking id.",
      language: "javascript",
      code: `import { Sanarwa } from '@sanarwa/sdk';

const client = new Sanarwa(process.env.SANARWA_API_KEY!);

const result = await client.email.send({
  to: 'user@example.com',
  channel: 'email',
  subject: 'Welcome to Sanarwa',
  message: 'Thanks for signing up.',
});

console.log(result.trackingId);`,
    },
    {
      id: "js-send-sms",
      title: "Send an SMS notification",
      description: "The channel component pins the channel, so the body stays flat.",
      language: "javascript",
      code: `import { Sanarwa } from '@sanarwa/sdk';

const client = new Sanarwa(process.env.SANARWA_API_KEY!);

await client.sms.send({
  to: '+15551234567',
  channel: 'sms',
  message: 'Your code is 4821',
});`,
    },
    {
      id: "js-send-bulk",
      title: "Send in bulk",
      description: "Queue up to 1000 notifications in one batch and poll the batch id.",
      language: "javascript",
      code: `import { Sanarwa } from '@sanarwa/sdk';

const client = new Sanarwa(process.env.SANARWA_API_KEY!);

const batch = await client.transport.sendBulk(
  [
    { to: 'a@example.com', channel: 'email', message: 'First' },
    { to: 'b@example.com', channel: 'email', message: 'Second' },
  ],
  'batch_001',
);

console.log(batch.batchId, batch.status);`,
    },
    {
      id: "js-schedule",
      title: "Schedule a send",
      description: "Scheduling is a field on the request, not a separate endpoint.",
      language: "javascript",
      code: `import { Sanarwa } from '@sanarwa/sdk';

const client = new Sanarwa(process.env.SANARWA_API_KEY!);

await client.transport.send({
  to: 'user@example.com',
  channel: 'email',
  message: 'Scheduled message',
  scheduledAt: '2026-12-01T09:00:00Z',
});`,
    },
    {
      id: "js-status",
      title: "Check delivery status",
      description: "Poll the tracking id returned when the notification was queued.",
      language: "javascript",
      code: `import { Sanarwa } from '@sanarwa/sdk';

const client = new Sanarwa(process.env.SANARWA_API_KEY!);

const status = await client.getNotificationStatus('trk_abc123');

console.log(status.status); // pending | sent | delivered | failed`,
    },
    {
      id: "js-raw-http",
      title: "Call the REST API directly",
      description: "Any language can POST to /api/v1. Same endpoint, same payload.",
      language: "javascript",
      code: `const response = await fetch('https://api.sanarwa.com/api/v1/notifications/send', {
  method: 'POST',
  headers: {
    'X-API-Key': process.env.SANARWA_API_KEY!,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    to: 'user@example.com',
    channel: 'email',
    data: 'Thanks for signing up.',
  }),
});`,
    },
  ],
};

export const apiEndpoints = [
  {
    id: "send-notification",
    method: "POST" as const,
    path: "/notifications/send",
    description: "Send one notification on any channel (POST /api/v1/notifications/send)",
    parameters: [
      {
        name: "to",
        type: "string",
        in: "body" as const,
        required: true,
        description: "Recipient: email address, phone number, or device token",
        example: "user@example.com",
      },
      {
        name: "channel",
        type: "string",
        in: "body" as const,
        required: true,
        description: "email, sms, push, whatsapp, webhook or in_app",
        example: "email",
      },
      {
        name: "data",
        type: "string",
        in: "body" as const,
        required: false,
        description: "Plain-text body of the notification (or set templateId)",
        example: "Thanks for signing up.",
      },
      {
        name: "channels",
        type: "array",
        in: "body" as const,
        required: false,
        description: "Fan out to several channels with one request (omit channel)",
        example: ["email", "push"],
      },
      {
        name: "variables",
        type: "object",
        in: "body" as const,
        required: true,
        description: "Template variables / event payload (use {} if none)",
        example: { name: "Amaka" },
      },
      {
        name: "subject",
        type: "string",
        in: "body" as const,
        required: false,
        description: "Subject for email, title for push",
        example: "Welcome",
      },
      {
        name: "templateId",
        type: "string",
        in: "body" as const,
        required: false,
        description: "Render a stored template instead of a literal body",
        example: "welcome-email",
      },
      {
        name: "brandId",
        type: "string",
        in: "body" as const,
        required: false,
        description: "Apply a stored brand layout to the message",
        example: "brand_12345",
      },
      {
        name: "priority",
        type: "string",
        in: "body" as const,
        required: false,
        description: "low, normal or high",
        example: "normal",
      },
      {
        name: "scheduledAt",
        type: "string",
        in: "body" as const,
        required: false,
        description: "ISO 8601 time to deliver instead of immediately",
        example: "2026-12-01T09:00:00Z",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["to", "channel", "variables"],
        properties: {
          to: { type: "string" },
          channel: {
            type: "string",
            enum: ["email", "sms", "push", "whatsapp", "webhook", "in_app", "voice", "chat"],
          },
          channels: { type: "array", items: { type: "string" } },
          data: { type: "string" },
          subject: { type: "string" },
          templateId: { type: "string" },
          variables: { type: "object" },
          priority: { type: "string", enum: ["low", "normal", "high", "urgent"] },
          scheduledAt: { type: "string" },
        },
      },
      example: {
        to: "user@example.com",
        channel: "email",
        variables: {},
        data: "Thanks for signing up.",
      },
    },
    responses: [
      {
        status: 201,
        description: "Notification queued for delivery",
        example: {
          messageId: "msg_9f1c2e8d",
          status: "queued",
          deliveries: [{ channel: "email", status: "queued" }],
        },
      },
      {
        status: 400,
        description: "Bad request",
        example: { error: "BadRequest", message: "channel is required" },
      },
    ],
  },
  {
    id: "send-bulk",
    method: "POST" as const,
    path: "/notifications/send/bulk",
    description:
      "Queue up to 1000 notifications in one batch (POST /api/v1/notifications/send/bulk)",
    parameters: [
      {
        name: "notifications",
        type: "array",
        in: "body" as const,
        required: true,
        description:
          "Array of send objects, each with to/recipients, channel/channels, data(body), variables",
        example: [{ to: "a@example.com", channel: "email", variables: {}, data: "First" }],
      },
      {
        name: "batchId",
        type: "string",
        in: "body" as const,
        required: false,
        description: "Caller-supplied batch id so the batch can be polled later",
        example: "batch_001",
      },
    ],
    requestBody: {
      contentType: "application/json",
      schema: {
        type: "object",
        required: ["notifications"],
        properties: {
          notifications: { type: "array", items: { type: "object" } },
          batchId: { type: "string" },
        },
      },
      example: {
        notifications: [
          { to: "a@example.com", channel: "email", message: "First" },
          { to: "b@example.com", channel: "sms", message: "Second" },
        ],
      },
    },
    responses: [
      {
        status: 201,
        description: "Batch queued for delivery",
        example: { batchId: "batch_001", status: "queued", results: [] },
      },
      {
        status: 400,
        description: "Bad request",
        example: { error: "BadRequest", message: "notifications must not be empty" },
      },
    ],
  },
  {
    id: "delivery-status",
    method: "GET" as const,
    path: "/notifications/status/{trackingId}",
    description:
      "Look up delivery status by tracking id (GET /api/v1/notifications/status/{trackingId})",
    parameters: [
      {
        name: "trackingId",
        type: "string",
        in: "path" as const,
        required: true,
        description: "Tracking id returned when the notification was queued",
        example: "trk_abc123",
      },
    ],
    responses: [
      {
        status: 200,
        description: "Delivery status",
        example: { trackingId: "trk_abc123", channel: "email", status: "delivered" },
      },
      {
        status: 404,
        description: "Not found",
        example: { error: "Not found", message: "Notification not found" },
      },
    ],
  },
  {
    id: "transport-analytics",
    method: "GET" as const,
    path: "/notifications/analytics",
    description: "Delivery metrics for a date range (GET /api/v1/notifications/analytics)",
    parameters: [
      {
        name: "startDate",
        type: "string",
        in: "query" as const,
        required: false,
        description: "Inclusive start of the range, ISO 8601",
        example: "2026-01-01",
      },
      {
        name: "endDate",
        type: "string",
        in: "query" as const,
        required: false,
        description: "Inclusive end of the range, ISO 8601",
        example: "2026-12-31",
      },
      {
        name: "channel",
        type: "string",
        in: "query" as const,
        required: false,
        description: "Restrict metrics to one channel",
        example: "email",
      },
    ],
    responses: [
      { status: 200, description: "Analytics", example: { sent: 128, delivered: 120, failed: 8 } },
    ],
  },
  {
    id: "transport-health",
    method: "GET" as const,
    path: "/notifications/health",
    description: "Check API and per-transport service health (GET /api/v1/notifications/health)",
    parameters: [],
    responses: [
      {
        status: 200,
        description: "Service health",
        example: {
          status: "healthy",
          timestamp: "2026-01-01T00:00:00.000Z",
          services: { email: "operational", sms: "operational", push: "operational" },
        },
      },
    ],
  },
];
