import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { IsArray, IsIn, IsObject, IsOptional, IsString, MinLength } from "class-validator";

const STEPS_EXAMPLE: Record<string, unknown>[] = [
  { type: "set", values: { greeted: true } },
  { type: "delay", ms: 3_600_000 },
  {
    type: "send",
    to: "{{user.email}}",
    channels: ["email"],
    templateId: "welcome-1",
    variables: { firstName: "Ada" },
    retry: { attempts: 3, delayMs: 5000 },
  },
  {
    type: "wait_for_event",
    event: "approved",
    timeoutMs: 86_400_000,
  },
  {
    type: "condition",
    if: { key: "approved", equals: true },
    then: "step_notify",
    elseStep: 5,
  },
  {
    type: "foreach",
    itemsKey: "users",
    as: "user",
    steps: [{ type: "send", to: "{{user.email}}", channels: ["email"], data: "Hi {{user.name}}" }],
    onError: "skip",
  },
  {
    type: "parallel",
    mode: "all",
    branches: [
      [{ type: "send", to: "{{user.email}}", channels: ["email"], data: "A" }],
      [{ type: "send", to: "ops@example.com", channels: ["email"], data: "B" }],
    ],
  },
];

export class CreateWorkflowDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: ["manual", "event", "schedule"],
    description:
      "manual: runs only via /start. event: runs when POST /signal matches. " +
      "schedule: cron starts a run every `metadata.schedule` interval " +
      "(everyMinutes | everyHours | everyMs | intervalMs, min 60s); `nextRunAt` is computed on write.",
  })
  @IsOptional()
  @IsIn(["manual", "event", "schedule"])
  trigger?: "manual" | "event" | "schedule";

  @ApiPropertyOptional({ enum: ["active", "paused", "archived"] })
  @IsOptional()
  @IsIn(["active", "paused", "archived"])
  status?: "active" | "paused" | "archived";

  @ApiProperty({
    description:
      "Ordered step IR. Supported types: set, delay/wait (ms), wait_for_event (event, timeoutMs?), " +
      "send (to, channels[], templateId?|data?, subject?, variables?, retry?), condition/branch " +
      "(if {key, equals|notEquals|exists} with then/else refs). Step jumps reference either a " +
      "step `id` (preferred, ids are generated at write time) or a numeric index. Internal " +
      "context keys (`_`-prefixed) are engine state and are stripped from API responses and " +
      "from variables sent to providers.",
    example: STEPS_EXAMPLE,
  })
  @IsArray()
  steps: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class UpdateWorkflowDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  description?: string;

  @ApiPropertyOptional({
    enum: ["manual", "event", "schedule"],
    description:
      "manual: runs only via /start. event: runs when POST /signal matches. " +
      "schedule: cron starts a run every `metadata.schedule` interval " +
      "(everyMinutes | everyHours | everyMs | intervalMs, min 60s); `nextRunAt` is computed on write.",
  })
  @IsOptional()
  @IsIn(["manual", "event", "schedule"])
  trigger?: "manual" | "event" | "schedule";

  @ApiPropertyOptional({ enum: ["active", "paused", "archived"] })
  @IsOptional()
  @IsIn(["active", "paused", "archived"])
  status?: "active" | "paused" | "archived";

  @ApiPropertyOptional({
    description:
      "Ordered step IR (see CreateWorkflowDto for the full shape). Sending " +
      "steps replaces the whole array; steps without an `id` get one.",
    example: STEPS_EXAMPLE,
  })
  @IsOptional()
  @IsArray()
  steps?: Record<string, unknown>[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class StartWorkflowRunDto {
  @ApiPropertyOptional({ description: "Initial context merged into the run." })
  @IsOptional()
  @IsObject()
  context?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Start from a specific step index (default 0)." })
  @IsOptional()
  step?: number;
}

export class SignalWorkflowEventDto {
  @ApiProperty({ description: "Event name to signal (resumes runs waiting for it)." })
  @IsString()
  @MinLength(1)
  event: string;

  @ApiPropertyOptional({ description: "Payload merged into run context as `event`." })
  @IsOptional()
  @IsObject()
  payload?: Record<string, unknown>;

  @ApiPropertyOptional({ description: "Limit to a specific workflow id." })
  @IsOptional()
  @IsString()
  workflowId?: string;

  @ApiPropertyOptional({ description: "Limit to a specific run id." })
  @IsOptional()
  @IsString()
  runId?: string;

  @ApiPropertyOptional({ description: "Idempotency key to dedupe repeated signals per run." })
  @IsOptional()
  @IsString()
  idempotencyKey?: string;
}
