import { describe, expect, it, vi, beforeEach } from "vitest";
import { WorkflowService } from "../workflow.service";

const TENANT = "tenant-1";

function makeWorkflow(overrides: Record<string, unknown> = {}) {
  return {
    id: "wf-1",
    tenantId: TENANT,
    name: "Onboarding",
    status: "active",
    steps: [
      { type: "set", values: { greeted: true } },
      { type: "delay", ms: 60_000 },
      {
        type: "send",
        to: "user-1",
        channels: ["email"],

        data: "Hello {{name}}",
        subject: "Hi",
      },
    ],
    metadata: {},
    ...overrides,
  };
}

function makeRun(overrides: Record<string, unknown> = {}) {
  return {
    id: "run-1",
    tenantId: TENANT,
    workflowId: "wf-1",
    status: "running",
    currentStep: 0,
    context: {},
    waitEvent: null,
    waitUntil: null,
    errorMessage: null,
    startedAt: new Date(),
    completedAt: null,
    ...overrides,
  };
}

function build() {
  const workflowRows: any[] = [];
  const runRows: any[] = [];

  const workflowBuilder = () => ({
    update: vi.fn().mockReturnThis(),
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    andWhere: vi.fn().mockReturnThis(),
    setParameter: vi.fn().mockReturnThis(),
    execute: vi.fn().mockResolvedValue({ affected: 1 }),
    getOne: vi.fn().mockResolvedValue(null),
  });

  const workflows = {
    create: vi.fn((v) => ({ id: "wf-1", ...v })),
    save: vi.fn(async (v) => v),
    find: vi.fn(async () => workflowRows),
    findOne: vi.fn(
      async ({ where }: any) =>
        workflowRows.find((w) => w.id === where.id && w.tenantId === where.tenantId) ?? null,
    ),
    remove: vi.fn(async () => undefined),
    createQueryBuilder: vi.fn(() => workflowBuilder()),
  };

  const runs = {
    create: vi.fn((v) => ({ id: "run-1", ...v })),
    save: vi.fn(async (v) => v),
    find: vi.fn(async () => runRows),
    findOne: vi.fn(async ({ where }: any) => runRows.find((r) => r.id === where.id) ?? null),
    createQueryBuilder: vi.fn(() => workflowBuilder()),
  };

  const unifiedSendService = { send: vi.fn().mockResolvedValue({ status: "queued" }) };
  const service = new WorkflowService(
    workflows as never,
    runs as never,
    unifiedSendService as never,
  );
  return { service, workflows, runs, unifiedSendService, workflowRows, runRows };
}

describe("WorkflowService", () => {
  it("runs steps until a delay, then parks the run as waiting", async () => {
    const { service, workflows, runs, workflowRows, runRows } = build();
    const wf = makeWorkflow();
    const run = makeRun({ context: { name: "Ada" } });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);

    const result = await service.startRun(TENANT, "wf-1", { context: { name: "Ada" } });

    expect(result.status).toBe("waiting");
    expect(result.currentStep).toBe(1); // parked on delay step (set advanced past step 0)
    expect(result.waitUntil).toBeInstanceOf(Date);
  });

  it("signals an event to resume a waiting_for_event run", async () => {
    const { service, workflows, runs, unifiedSendService, workflowRows, runRows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "wait_for_event", event: "approved" },
        { type: "send", to: "user-1", channels: ["email"], data: "Go" },
      ],
    });
    const run = makeRun({
      status: "waiting_for_event",
      currentStep: 0,
      waitEvent: "approved",
      context: {},
    });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.find.mockResolvedValue([]); // no event-triggered definitions
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.find.mockResolvedValue([run]);

    const res = await service.signal(TENANT, { event: "approved", payload: { ok: true } });

    expect(res.resumed).toBe(1);
    expect(unifiedSendService.send).toHaveBeenCalled();
    expect(run.status).toBe("completed");
    expect(run.context).toMatchObject({ lastEvent: "approved", event: { ok: true } });
  });
});

describe("WorkflowService (engine semantics)", () => {
  it("interpolates dotted context paths in send fields and strips internal keys", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "set", values: { user: { name: "Ada", email: "ada@example.com" } } },
        {
          type: "send",
          to: "{{user.email}}",
          channels: ["email"],
          data: "Hello {{user.name}}",
          subject: "Hi {{user.name}}",
        },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    expect(unifiedSendService.send).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "ada@example.com",
        subject: "Hi Ada",
        data: "Hello Ada",
      }),
      TENANT,
    );
    const sent = unifiedSendService.send.mock.calls[0][0];
    expect(sent.variables).toMatchObject({
      user: { name: "Ada", email: "ada@example.com" },
      workflowRunId: run.id,
    });
    expect(sent.variables._signalKeys).toBeUndefined();
    expect(sent.variables._retryStep).toBeUndefined();
    expect(sent.variables._execution).toBeUndefined();
  });

  it("does not leak the engine's execution state into provider variables", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const sendStep = {
      type: "send",
      to: "u-1",
      channels: ["email"],
      data: "Go",
      retry: { attempts: 1, delayMs: 100 },
    };
    const wf = makeWorkflow({ steps: [sendStep] });
    const run = makeRun({
      context: { name: "Ada", _execution: { retryStep: 0, stepRetryCount: 0 } },
    });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);
    unifiedSendService.send.mockRejectedValueOnce(new Error("provider down"));

    await service.startRun(TENANT, "wf-1", { context: {} });

    // First attempt parked as waiting for retry
    expect(run.status).toBe("waiting");

    const providerCall = unifiedSendService.send.mock.calls[0][0];
    expect(providerCall.variables).toMatchObject({ name: "Ada" });
    expect(providerCall.variables._retryStep).toBeUndefined();
    expect(providerCall.variables._stepRetryCount).toBeUndefined();
    expect(providerCall.variables._execution).toBeUndefined();
  });

  it("resolves condition jumps by step id, not only by index", async () => {
    const steps = [
      { type: "set", values: { approved: true } },
      {
        id: "check",
        type: "condition",
        if: { key: "approved", equals: true },
        then: "notify",
        else: "else-branch",
      },
      { id: "notify", type: "send", to: "u-1", channels: ["email"], data: "approved" },
      { id: "park", type: "delay", ms: 60_000 },
      { id: "else-branch", type: "send", to: "u-1", channels: ["email"], data: "skipped" },
    ];
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({ steps });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    const sent = unifiedSendService.send.mock.calls.map((call: string[]) => call[0] as any);
    expect(sent.map((call: any) => call.data)).toEqual(["approved"]);
    expect(run.status).toBe("waiting"); // parked on the delay step, else-branch skipped
  });

  it("follows the else branch when the condition does not match", async () => {
    const steps = [
      { type: "set", values: { approved: false } },
      {
        id: "check",
        type: "condition",
        if: { key: "approved", equals: true },
        then: "notify",
        else: "else-branch",
      },
      { id: "notify", type: "send", to: "u-1", channels: ["email"], data: "approved" },
      { id: "park", type: "delay", ms: 60_000 },
      { id: "else-branch", type: "send", to: "u-1", channels: ["email"], data: "skipped" },
    ];
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({ steps });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    const sent = unifiedSendService.send.mock.calls.map((call: string[]) => call[0] as any);
    expect(sent.map((call: any) => call.data)).toContain("skipped");
    expect(sent.map((call: any) => call.data)).not.toContain("approved");
  });

  it("fails the run cleanly when a branch target does not exist", async () => {
    const { service, runs, workflowRows, runRows, workflows } = build();
    const wf = makeWorkflow({
      steps: [{ type: "condition", if: { key: "a", equals: 1 }, then: "missing-target" }],
    });
    const run = makeRun({ context: { a: 1 } });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    expect(run.status).toBe("failed");
    expect(run.errorMessage).toContain("branch target");
  });

  it("rejects invalid workflow payloads at write time with a readable error list", async () => {
    const { service, workflows } = build();
    workflows.create.mockImplementation((v: any) => ({ id: "wf-1", ...v }));
    await expect(
      service.create(TENANT, {
        name: "bad",
        steps: [{ type: "teleport" }, { type: "send", to: "u", channels: ["fax"], data: "hi" }],
      } as never),
    ).rejects.toThrow(/Invalid workflow steps/);
  });

  it("normalizes steps with generated ids on create", async () => {
    const { service, workflows } = build();
    const saved: any[] = [];
    workflows.create.mockImplementation((v: any) => ({ id: "wf-1", ...v }));
    workflows.save.mockImplementation(async (v: any) => {
      saved.push(v);
      return v;
    });

    await service.create(TENANT, {
      name: "ok",
      steps: [{ type: "set", values: { a: 1 } }],
    } as never);

    expect(saved[0].steps[0].id).toMatch(/^step_/);
  });

  it("strips engine-internal keys from run contexts exposed to the API", async () => {
    const { service, runs, workflowRows, runRows, workflows } = build();
    const run = makeRun({
      context: { name: "Ada", _execution: { signalKeys: ["s"], stepRetryCount: 2 } },
    });
    runRows.push(run);
    runs.findOne.mockResolvedValue(run);
    workflows.findOne.mockResolvedValue(makeWorkflow());

    const result = await service.getRun(TENANT, "run-1");

    expect(result.context).toEqual({ name: "Ada" });
  });
});

describe("WorkflowService (cap yield)", () => {
  it("re-parks a run that hit the per-tick step cap instead of leaving it stuck running", async () => {
    const { service, runs, workflowRows, runRows, workflows } = build();
    const wf = makeWorkflow({
      steps: [{ id: "loop", type: "condition", if: { key: "x", equals: 1 }, then: 0, else: 1 }],
    });
    const run = makeRun({ context: { x: 1 } });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    expect(run.status).toBe("waiting");
    expect((run as any).execution?.retryStep).toBe(0);
    expect(run.waitUntil).toBeInstanceOf(Date);
    // Now resume: processDueWaits re-enters the same step, does NOT skip ahead
    await service.processDueWaits();
    expect(run.status).toBe("waiting");
    expect((run as any).execution?.retryStep).toBe(0);
  });
});

describe("WorkflowService (foreach)", () => {
  const users = [
    { email: "ada@example.com", name: "Ada", ok: true },
    { email: "bo@example.com", name: "Bo", ok: false },
  ];

  it("runs the sub-steps once per item and interpolates item variables", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "set", values: { users } },
        {
          type: "foreach",
          itemsKey: "users",
          steps: [
            {
              type: "send",
              to: "{{item.email}}",
              channels: ["email"],
              data: "Hi {{item.name}}",
            },
          ],
        },
        { type: "send", to: "ops@example.com", channels: ["email"], data: "loop done" },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    const calls = unifiedSendService.send.mock.calls.map((call: any[]) => call[0]);
    expect(calls).toHaveLength(3);
    expect(calls[0].to).toBe("ada@example.com");
    expect(calls[0].data).toBe("Hi Ada");
    expect(calls[1].to).toBe("bo@example.com");
    expect(calls[2].to).toBe("ops@example.com");
    expect(calls[2].data).toBe("loop done");
    expect(run.status).toBe("completed");
  });

  it("fails loudly when itemsKey is not an array", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "set", values: { users: "not-an-array" } },
        {
          type: "foreach",
          itemsKey: "users",
          steps: [{ type: "send", to: "u", channels: ["email"], data: "x" }],
        },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    expect(run.status).toBe("failed");
    expect(run.errorMessage).toContain("did not resolve to an array");
    expect(unifiedSendService.send).not.toHaveBeenCalled();
  });

  it("skips the construct on an empty array", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        {
          type: "foreach",
          itemsKey: "users",
          steps: [{ type: "send", to: "u", channels: ["email"], data: "x" }],
        },
        { type: "send", to: "ops@example.com", channels: ["email"], data: "after" },
      ],
    });
    const run = makeRun({ context: { users: [] } });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    expect(unifiedSendService.send).toHaveBeenCalledTimes(1);
    expect(run.status).toBe("completed");
  });

  it("onError=skip skips the failing item and keeps the others", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "set", values: { users } },
        {
          type: "foreach",
          itemsKey: "users",
          onError: "skip",
          steps: [
            { type: "send", to: "{{item.email}}", channels: ["email"], data: "{{item.name}}" },
          ],
        },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);
    unifiedSendService.send
      .mockRejectedValueOnce(new Error("boom"))
      .mockResolvedValue({ status: "queued" });

    await service.startRun(TENANT, "wf-1", { context: {} });

    expect(unifiedSendService.send).toHaveBeenCalledTimes(2);
    expect(run.status).toBe("completed");
  });

  it("onError=fail (default) stops the run when a sub-step fails", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "set", values: { users } },
        {
          type: "foreach",
          itemsKey: "users",
          steps: [
            { type: "send", to: "{{item.email}}", channels: ["email"], data: "{{item.name}}" },
          ],
        },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);
    unifiedSendService.send.mockRejectedValue(new Error("boom"));

    await service.startRun(TENANT, "wf-1", { context: {} });

    expect(run.status).toBe("failed");
    expect(run.errorMessage).toContain("boom");
    expect(unifiedSendService.send).toHaveBeenCalledTimes(1);
  });

  it("keeps condition jumps inside the foreach sub-array", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "set", values: { users } },
        {
          type: "foreach",
          itemsKey: "users",
          steps: [
            {
              id: "check",
              type: "condition",
              if: { key: "item.ok", equals: true },
              then: "notify",
              else: 2,
            },
            { id: "notify", type: "send", to: "{{item.email}}", channels: ["email"], data: "ok" },
            { id: "noop", type: "set", values: { touched: true } },
          ],
        },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    const sent = unifiedSendService.send.mock.calls.map((call: any[]) => call[0]);
    expect(sent.map((call: any) => call.to)).toEqual(["ada@example.com"]);
    expect(run.status).toBe("completed");
  });

  it("wait_for_event inside foreach parks the run and resumes on signal", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "set", values: { users } },
        {
          type: "foreach",
          itemsKey: "users",
          steps: [
            { type: "wait_for_event", event: "approved" },
            { type: "send", to: "{{item.email}}", channels: ["email"], data: "go" },
          ],
        },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });
    expect(run.status).toBe("waiting_for_event");
    expect(unifiedSendService.send).not.toHaveBeenCalled();

    runs.findOne.mockResolvedValue(run);
    runs.find.mockResolvedValue([run]);
    await service.signal(TENANT, { event: "approved", payload: { ok: true } });

    expect(unifiedSendService.send).toHaveBeenCalledWith(
      expect.objectContaining({ to: "ada@example.com" }),
      TENANT,
    );
  });

  it("wait_for_event timeout inside foreach with onError=skip records and continues", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "set", values: { users: [users[0]] } },
        {
          type: "foreach",
          itemsKey: "users",
          onError: "skip",
          steps: [
            { type: "wait_for_event", event: "never", timeoutMs: 1 },
            { type: "send", to: "{{item.email}}", channels: ["email"], data: "go" },
          ],
        },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });
    expect(run.status).toBe("waiting_for_event");

    run.waitUntil = new Date(Date.now() - 1000);
    await service.processDueWaits();

    expect(run.status).toBe("completed");
    expect(unifiedSendService.send).not.toHaveBeenCalled();
  });

  it("re-runs the same sub-step on a send retry without touching the top cursor", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "set", values: { users } },
        {
          type: "foreach",
          itemsKey: "users",
          steps: [
            {
              type: "send",
              to: "{{item.email}}",
              channels: ["email"],
              data: "go",
              retry: { attempts: 1, delayMs: 1 },
            },
          ],
        },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);
    unifiedSendService.send
      .mockRejectedValueOnce(new Error("flaky"))
      .mockResolvedValue({ status: "queued" });

    await service.startRun(TENANT, "wf-1", { context: {} });
    expect(run.status).toBe("waiting");

    runs.find.mockResolvedValue([run]);
    await service.processDueWaits();

    const sends = unifiedSendService.send.mock.calls.map((call: any[]) => call[0]);
    expect(sends[0].to).toBe("ada@example.com");
    expect(sends[1].to).toBe("ada@example.com");
    expect(sends[2].to).toBe("bo@example.com");
    expect(run.status).toBe("completed");
  });
});

describe("WorkflowService (parallel)", () => {
  it("mode=all runs every branch before continuing", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        {
          type: "parallel",
          mode: "all",
          branches: [
            [{ type: "send", to: "a@example.com", channels: ["email"], data: "a" }],
            [{ type: "send", to: "b@example.com", channels: ["email"], data: "b" }],
          ],
        },
        { type: "send", to: "ops@example.com", channels: ["email"], data: "after" },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    const sent = unifiedSendService.send.mock.calls.map((call: any[]) => call[0].to);
    expect(sent).toEqual(["a@example.com", "b@example.com", "ops@example.com"]);
    expect(run.status).toBe("completed");
  });

  it("mode=any short-circuits after the first successful branch", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        {
          type: "parallel",
          mode: "any",
          branches: [
            [{ type: "send", to: "a@example.com", channels: ["email"], data: "a" }],
            [{ type: "send", to: "never@example.com", channels: ["email"], data: "b" }],
          ],
        },
        { type: "send", to: "ops@example.com", channels: ["email"], data: "after" },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    const sent = unifiedSendService.send.mock.calls.map((call: any[]) => call[0].to);
    expect(sent).toEqual(["a@example.com", "ops@example.com"]);
    expect(run.status).toBe("completed");
  });

  it("a failing branch fails the run in mode=all (default policy)", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        {
          type: "parallel",
          mode: "all",
          branches: [
            [{ type: "send", to: "a@example.com", channels: ["email"], data: "a" }],
            [{ type: "send", to: "boom@example.com", channels: ["email"], data: "b" }],
          ],
        },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);
    unifiedSendService.send.mockImplementation(async (req: any) =>
      req.to === "boom@example.com" ? Promise.reject(new Error("boom")) : { status: "queued" },
    );

    await service.startRun(TENANT, "wf-1", { context: {} });

    expect(run.status).toBe("failed");
  });

  it("skip policy records the branch failure and the remaining branch still runs", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        {
          type: "parallel",
          mode: "all",
          onError: "skip",
          branches: [
            [{ type: "send", to: "boom@example.com", channels: ["email"], data: "a" }],
            [{ type: "send", to: "b@example.com", channels: ["email"], data: "b" }],
          ],
        },
        { type: "send", to: "ops@example.com", channels: ["email"], data: "after" },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);
    unifiedSendService.send.mockImplementation(async (req: any) =>
      req.to === "boom@example.com" ? Promise.reject(new Error("boom")) : { status: "queued" },
    );

    await service.startRun(TENANT, "wf-1", { context: {} });

    const sent = unifiedSendService.send.mock.calls.map((call: any[]) => call[0].to);
    expect(sent).toEqual(["boom@example.com", "b@example.com", "ops@example.com"]);
    expect(run.status).toBe("completed");
  });

  it("supports nested foreach constructs", async () => {
    const { service, runs, workflowRows, runRows, unifiedSendService, workflows } = build();
    const wf = makeWorkflow({
      steps: [
        { type: "set", values: { groups: [{ members: ["a", "b"] }, { members: ["c"] }] } },
        {
          type: "foreach",
          itemsKey: "groups",
          as: "group",
          steps: [
            {
              type: "foreach",
              itemsKey: "group.members",
              as: "member",
              steps: [{ type: "send", to: "{{member}}", channels: ["email"], data: "hi" }],
            },
          ],
        },
      ],
    });
    const run = makeRun({ context: {} });
    workflowRows.push(wf);
    runRows.push(run);
    workflows.findOne.mockResolvedValue(wf);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.startRun(TENANT, "wf-1", { context: {} });

    const sent = unifiedSendService.send.mock.calls.map((call: any[]) => call[0].to);
    expect(sent).toEqual(["a", "b", "c"]);
    expect(run.status).toBe("completed");
  });
});

describe("WorkflowService (schedule trigger + schemaVersion)", () => {
  it("normalizes a schedule trigger and stamps schemaVersion=1", async () => {
    const { service, workflows } = build();
    const created: any[] = [];
    workflows.create.mockImplementation((v: any) => ({ id: "wf-1", ...v }));
    workflows.save.mockImplementation(async (v: any) => {
      created.push(v);
      return v;
    });

    await service.create(TENANT, {
      name: "nightly",
      trigger: "schedule",
      steps: [{ type: "set", values: { tick: true } }],
      metadata: { schedule: { everyMinutes: 30 } },
    } as never);

    expect(created).toHaveLength(1);
    expect(created[0].trigger).toBe("schedule");
    expect(created[0].metadata.schemaVersion).toBe(1);
    expect(created[0].metadata.schedule.intervalMs).toBe(1_800_000);
    expect(new Date(created[0].metadata.schedule.nextRunAt).getTime()).toBeGreaterThan(Date.now());
  });

  it("rejects a schedule trigger without a valid interval", async () => {
    const { service } = build();
    await expect(
      service.create(TENANT, {
        name: "broken",
        trigger: "schedule",
        steps: [{ type: "set", values: { tick: true } }],
        metadata: { schedule: {} },
      } as never),
    ).rejects.toThrow(/Invalid workflow schedule/);
  });

  it("rejects schemaVersion newer than the engine", async () => {
    const { service } = build();
    await expect(
      service.create(TENANT, {
        name: "future",
        trigger: "manual",
        steps: [{ type: "set", values: { tick: true } }],
        metadata: { schemaVersion: 99 },
      } as never),
    ).rejects.toThrow(/newer than the engine/);
  });

  it("cron starts a due definition and recomputes nextRunAt", async () => {
    const { service, workflows, runs } = build();
    const nextRunAt = new Date(Date.now() - 60_000).toISOString();
    const workflow = {
      id: "wf-due",
      tenantId: TENANT,
      name: "nightly",
      status: "active",
      trigger: "schedule",
      currentStep: 0,
      steps: [{ type: "set", values: { tick: true } }],
      metadata: { schedule: { intervalMs: 3_600_000, nextRunAt } },
    } as any;
    const run = makeRun({ id: "run-due", context: {} });
    workflows.find.mockResolvedValue([workflow]);
    workflows.findOne.mockResolvedValue(workflow);
    runs.findOne.mockResolvedValue(run);
    runs.create.mockReturnValue(run);
    runs.find.mockResolvedValue([run]);

    await service.processDueSchedules();

    // CAS update is issued against the definition before the run starts.
    expect(workflows.createQueryBuilder).toHaveBeenCalled();
    expect(run.status).toBe("completed");
  });

  it("cron leaves a not-yet-due definition alone", async () => {
    const { service, workflows, runs } = build();
    const nextRunAt = new Date(Date.now() + 3_600_000).toISOString();
    const workflow = {
      id: "wf-future",
      tenantId: TENANT,
      name: "nightly",
      status: "active",
      trigger: "schedule",
      currentStep: 0,
      steps: [{ type: "set", values: { tick: true } }],
      metadata: { schedule: { intervalMs: 3_600_000, nextRunAt } },
    } as any;
    workflows.find.mockResolvedValue([workflow]);

    await service.processDueSchedules();

    expect(workflow.metadata.schedule.nextRunAt).toBe(nextRunAt);
    expect(runs.create).not.toHaveBeenCalled();
  });
});

describe("WorkflowService (crash recovery)", () => {
  it("re-parks interrupted 'running' runs on module init", async () => {
    const { service, runs } = build();
    const run = makeRun({ status: "running", context: {} });
    runs.find = vi.fn().mockResolvedValue([run]);
    runs.update = vi.fn().mockResolvedValue({ affected: 2 });

    await service.onModuleInit();

    expect(runs.update).toHaveBeenCalledTimes(1);
    const [where, patch] = runs.update.mock.calls[0];
    expect(where).toEqual({ status: "running" });
    expect(patch.status).toBe("waiting");
    expect(new Date(patch.waitUntil as Date).getTime()).toBeGreaterThan(Date.now() - 10_000);
  });
});

describe("WorkflowService (signal auto-start idempotency)", () => {
  it("starts an event-triggered definition at most once per idempotency key", async () => {
    const { service, workflows, runs, workflowRows, runRows } = build();
    const def = {
      id: "wf-event",
      tenantId: TENANT,
      name: "onboard",
      status: "active",
      trigger: "event",
      steps: [{ type: "send", to: "u-1", channels: ["email"], data: "hi" }],
      metadata: { event: "user.created" },
    } as any;
    workflowRows.push(def);
    workflows.find.mockResolvedValue([def]);
    workflows.findOne.mockResolvedValue(def);
    runs.find.mockResolvedValue([]);
    runs.findOne.mockResolvedValue(null);
    const created: any[] = [];
    const qb: any = {
      where: vi.fn().mockReturnThis(),
      andWhere: vi.fn().mockReturnThis(),
      getOne: vi.fn(),
    };
    qb.getOne.mockResolvedValueOnce(null).mockImplementation(async () => created[0] ?? null);
    runs.createQueryBuilder.mockReturnValue(qb);
    runs.create.mockImplementation((v: any) => {
      const row = { id: `run-${created.length + 1}`, ...v };
      created.push(row);
      runRows.push(row);
      return row;
    });

    await service.signal(TENANT, {
      event: "user.created",
      payload: { userId: "u-1" },
      idempotencyKey: "evt-abc-123",
    });

    expect(created).toHaveLength(1);
    expect(created[0].execution?.signalKeys).toEqual(["auto:evt-abc-123"]);

    runs.findOne.mockResolvedValue(created[0]); // second signal: marker hit
    qb.getOne.mockReset().mockResolvedValue(created[0]);
    await service.signal(TENANT, {
      event: "user.created",
      payload: { userId: "u-1" },
      idempotencyKey: "evt-abc-123",
    });

    expect(created).toHaveLength(1);
  });
});
