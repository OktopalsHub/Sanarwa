# Sanarwa

A multi-channel notification and billing engine for managing business communications at scale.

## Overview

Sanarwa helps teams send reliable notifications across multiple channels without writing custom integration code for every single provider. It takes a unified message payload, routes it to the best available service, and automatically tracks delivery statuses and user engagement. You won't have to worry about complicated setups, dropped messages, or payment integrations, letting developers focus entirely on building their core product instead of maintaining delivery infrastructure.

## System Architecture

```mermaid
flowchart LR
  ClientApp["Client App"]
  APIServer["API Server"]
  WorkerQueue["Background Workers"]
  Database[("PostgreSQL")]
  Cache["Redis Cache"]
  ExternalAPI["External APIs"]

  ClientApp --> APIServer
  APIServer --> Database
  APIServer --> Cache
  APIServer --> WorkerQueue
  WorkerQueue --> ExternalAPI
  WorkerQueue --> Database

  style ClientApp fill:#1e1b4b,stroke:#6366f1,stroke-width:2px,color:#fff
  style APIServer fill:#2e1065,stroke:#8b5cf6,stroke-width:2px,color:#fff
  style WorkerQueue fill:#451a03,stroke:#f59e0b,stroke-width:2px,color:#fff
  style Database fill:#0f172a,stroke:#3b82f6,stroke-width:2px,color:#fff
  style Cache fill:#4c0519,stroke:#ef4444,stroke-width:2px,color:#fff
  style ExternalAPI fill:#022c22,stroke:#10b981,stroke-width:2px,color:#fff
```

## Features

### Multi-Channel Delivery

Send messages to your users across email, SMS, push notifications, WhatsApp, and voice calls. The platform normalizes the payloads so you don't have to learn six different vendor APIs.

### Smart Routing and Failover

Provider sends flow through managed provider chains and BYO credentials, with an
ordered `fallback` cascade in the send contract (e.g. `fallback: ["sms", "push"]` or
`fallback: true`): the platform tries the managed provider first, then your BYOP
credential, then the next provider in the chain, and — across channels — the next
requested channel. A per-tenant circuit breaker (`managed-<channel>:<name>`,
`byo-<channel>:<tenant>:<name>`) stops hammering a failing provider. Delivery is
queued (BullMQ 6) with retries, a dead-letter queue, and chaos-tested recovery.

```mermaid
sequenceDiagram
  actor System
  participant Router as "Routing Engine"
  participant Primary as "Primary Provider"
  participant Fallback as "Backup Provider"

  System->>Router: Dispatch Message
  Router->>Primary: Attempt Delivery
  Primary->>Router: Return 429 Rate Limited
  Router->>Fallback: Attempt Backup Delivery
  Fallback->>Router: Return 200 OK
  Router->>System: Confirm Delivery Success
```

### Built-In Token Billing

Includes a complete token-based billing engine. Tenants consume tokens for every message sent, and the system handles automatic wallet top-ups via external payment gateways when balances run low.

```mermaid
sequenceDiagram
  actor Cron as "Scheduled Job"
  participant Billing as "Billing Service"
  participant DB as "Database"
  participant Gateway as "Payment Gateway"

  Cron->>Billing: Check Low Balances
  Billing->>DB: Query Tenant Quotas
  DB->>Billing: Return Low Balance Tenants
  Billing->>Gateway: Charge Saved Card
  Gateway->>Billing: Return Payment Success
  Billing->>DB: Credit Token Balance
```

### Advanced Analytics

Track open rates, click rates, bounce rates, and overall delivery health across all configured providers.

## Usage

To send a multi-channel notification using the API, you can submit a payload with the desired channels and recipient details as shown below:

```bash
curl -X POST http://localhost:3000/api/v1/messaging/send \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-api-key" \
  -d '{
    "channels": ["email", "sms"],
    "recipients": [
      {
        "id": "user-123",
        "email": "customer@example.com",
        "phone": "+1234567890"
      }
    ],
    "subject": "Your order has shipped",
    "content": "Track your package using the link below.",
    "data": {
      "trackingCode": "TRK-987654"
    }
  }'
```

## Technologies Used

- [TypeScript](https://www.typescriptlang.org/)
- [Node.js](https://nodejs.org/)
- [NestJS](https://nestjs.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/)
- [BullMQ](https://docs.bullmq.io/)
- [React](https://reactjs.org/)
- [Docker](https://www.docker.com/)

## API Documentation

The platform exposes a comprehensive REST API. Below are the core endpoints used to interact with the system.

### Environment Variables

Before running the API, you'll need these environment variables configured:

```env
# Server
NODE_ENV=development
PORT=3000
FRONTEND_URL=http://localhost:3001

# Databases
DATABASE_URL=postgresql://username:password@localhost:5432/sanarwa
REDIS_URL=redis://localhost:6379

# Security
JWT_AUTH_SECRET=your-secret-key-min-32-chars
JWT_REFRESH_SECRET=your-refresh-key-min-32-chars
SESSION_SECRET=your-session-secret-key
PROVIDER_ENCRYPTION_KEY=your-32-char-encryption-key

# Provider Credentials
TELNYX_API_KEY=your-telnyx-key
AWS_ACCESS_KEY_ID=your-aws-key
AWS_SECRET_ACCESS_KEY=your-aws-secret
```

### Authentication

#### POST /api/v1/auth/login

**Description**: Authenticates a user and returns session tokens.

**Request**:

```json
{
  "email": "user@example.com",
  "password": "SecurePassword123!"
}
```

**Response**:

```json
{
  "accessToken": "eyJhbGci...",
  "refreshToken": "def456...",
  "expiresIn": 3600,
  "user": {
    "id": "123e4567-e89b-12d3-a456-426614174000",
    "email": "user@example.com",
    "name": "Jane Doe"
  }
}
```

**Errors**:

- 400: Invalid request payload.
- 401: Invalid credentials.

#### POST /api/v1/auth/register

**Description**: Registers a new user account and provisions a default workspace.

**Request**:

```json
{
  "email": "newuser@example.com",
  "password": "SecurePassword123!",
  "name": "Jane Doe"
}
```

**Response**:

```json
{
  "id": "123e4567-e89b-12d3-a456-426614174000",
  "email": "newuser@example.com",
  "name": "Jane Doe",
  "accessToken": "eyJhbGci...",
  "refreshToken": "def456...",
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors**:

- 400: Validation failed.
- 409: Email already exists.

### Messaging

#### POST /api/v1/messaging/send

**Description**: Dispatches a single message to one or more recipients across multiple channels. Requires an API key in the headers.

**Request**:

```json
{
  "channels": ["email", "sms"],
  "recipients": [
    {
      "id": "user-123",
      "email": "customer@example.com",
      "phone": "+1234567890"
    }
  ],
  "subject": "Welcome aboard",
  "content": "Thanks for joining us.",
  "data": {
    "firstName": "Customer"
  },
  "priority": "high"
}
```

**Response**:

```json
{
  "id": "msg_123456789",
  "status": "processing",
  "channels": ["email", "sms"],
  "recipientCount": 1,
  "createdAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors**:

- 400: Invalid message data.
- 401: Invalid or missing API key.
- 403: Insufficient permissions or token balance.

#### GET /api/v1/messaging/:id/status

**Description**: Retrieves the current delivery status of a previously dispatched message.

**Request**:
No body required. Pass the message ID in the URL.

**Response**:

```json
{
  "id": "msg_123456789",
  "status": "delivered",
  "updatedAt": "2024-01-01T00:05:00.000Z",
  "retryCount": 0
}
```

**Errors**:

- 401: Unauthorized.
- 404: Message not found.

### Tenant Management

#### POST /api/v1/tenants

**Description**: Creates a new multi-tenant organization.

**Request**:

```json
{
  "name": "Acme Corp",
  "description": "Enterprise customer account"
}
```

**Response**:

```json
{
  "id": "tenant-uuid-123",
  "name": "Acme Corp",
  "description": "Enterprise customer account",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors**:

- 400: Validation error on input fields.
- 401: Unauthorized.

#### POST /api/v1/tenants/:tenantId/projects

**Description**: Creates a new isolated project under a specific tenant.

**Request**:

```json
{
  "name": "Production Environment",
  "description": "Live traffic project"
}
```

**Response**:

```json
{
  "id": "project-uuid-456",
  "name": "Production Environment",
  "description": "Live traffic project",
  "tenantId": "tenant-uuid-123",
  "status": "active",
  "createdAt": "2024-01-01T00:00:00.000Z",
  "updatedAt": "2024-01-01T00:00:00.000Z"
}
```

**Errors**:

- 400: Invalid input.
- 401: Unauthorized.
- 403: User is not a member of the tenant.

## Author Info

- GitHub: [Sanarwa Repository](https://github.com/sanarwa)

[![Readme was generated by Dokugen](https://img.shields.io/badge/Readme%20was%20generated%20by-Dokugen-brightgreen)](https://dokugen.samueltuoyo.com)
