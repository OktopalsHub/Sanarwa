import { describe, expect, it } from "vitest";
import { dotGet, publicContext, validateWorkflowSteps } from "../workflow-steps";

const VALID_SEND: Record<string, unknown> = {
  type: "send",
  to: "{{user.email}}",
  channels: ["email"],
  data: "Hello {{user.name}}",
};

describe("validateWorkflowSteps", () => {
  it("assigns ids to steps that lack them and preserves provided ids", () => {
    const result = validateWorkflowSteps([
      { type: "set", values: { a: 1 } },
      { id: "step_fixed", type: "delay", ms: 1000 },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.steps[0].id).toMatch(/^step_/);
    expect(result.steps[1].id).toBe("step_fixed");
  });

  it("rejects unknown step types with an actionable list of valid types", () => {
    const result = validateWorkflowSteps([{ type: "teleport" }]);

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("set");
    expect(result.errors[0]).toContain("send");
    expect(result.steps).toHaveLength(0);
  });

  it("rejects send steps missing to, channels, or a body/templateId", () => {
    const result = validateWorkflowSteps([
      { type: "send", channels: ["email"] },
      { type: "send", to: "u-1", channels: ["fax"] },
      { type: "send", to: "u-1", channels: ["email"] },
    ]);

    expect(result.errors.join("\n")).toContain(".to is required");
    expect(result.errors.join("\n")).toContain("unsupported values: fax");
    expect(result.errors.join("\n")).toContain("either templateId or data");
  });

  it("rejects invalid retry, timeout and condition refs, and unknown branch targets", () => {
    const result = validateWorkflowSteps([
      { type: "delay", ms: -5 },
      { type: "wait_for_event", event: "x", timeoutMs: -1 },
      { type: "condition", if: { key: "a" }, then: "does-not-exist" },
      {
        type: "send",
        to: "u",
        channels: ["email"],
        data: "hi",
        retry: { attempts: 99 },
      },
    ]);

    expect(result.errors.join("\n")).toContain("positive delay");
    expect(result.errors.join("\n")).toContain("timeoutMs must be a positive number");
    expect(result.errors.join("\n")).toContain("then references 'does-not-exist'");
    expect(result.errors.join("\n")).toContain("retry.attempts must be an integer");
  });

  it("accepts a condition jumping to a step id and one jumping by index", () => {
    const result = validateWorkflowSteps([
      { id: "check", type: "condition", if: { key: "approved", equals: true }, then: "notify" },
      { id: "notify", type: "send", to: "u", channels: ["email"], data: "hi" },
      { type: "condition", if: { key: "kind", equals: "vip" }, then: 1 },
    ]);

    expect(result.errors).toEqual([]);
    expect(result.steps[2].type).toBe("condition");
  });

  it("rejects duplicated step ids and caps retry delay", () => {
    const result = validateWorkflowSteps([
      { id: "a", ...VALID_SEND },
      { id: "a", type: "delay", ms: 100 },
    ]);

    expect(result.errors.join("\n")).toContain("duplicated");

    const tooLong = validateWorkflowSteps([
      {
        type: "send",
        to: "u",
        channels: ["email"],
        data: "hi",
        retry: { attempts: 2, delayMs: 10 ** 10 },
      },
    ]);
    expect(tooLong.errors.join("\n")).toContain("retry.delayMs");
  });
});

describe("publicContext", () => {
  it("strips engine-internal `_` keys", () => {
    expect(
      publicContext({ name: "Ada", _retryStep: 3, _stepRetryCount: 2, _signalKeys: ["k"] }),
    ).toEqual({ name: "Ada" });
  });

  it("tolerates missing context", () => {
    expect(publicContext(undefined)).toEqual({});
  });
});

describe("dotGet", () => {
  const context = { user: { name: "Ada", age: 36 }, ok: true };

  it("walks nested paths", () => {
    expect(dotGet(context, "user.name")).toBe("Ada");
    expect(dotGet(context, "user.age")).toBe(36);
    expect(dotGet(context, "ok")).toBe(true);
  });

  it("returns undefined for missing branches", () => {
    expect(dotGet(context, "user.missing.deep")).toBeUndefined();
    expect(dotGet(context, "nope")).toBeUndefined();
  });

  it("refuses prototype-polluting paths", () => {
    expect(dotGet(context, "__proto__.polluted")).toBeUndefined();
    expect(dotGet(context, "constructor.prototype")).toBeUndefined();
    expect(({} as any).polluted).toBeUndefined();
  });
});
