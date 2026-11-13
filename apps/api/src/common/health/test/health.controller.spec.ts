import { describe, expect, it, vi } from "vitest";
import { HttpStatus } from "@nestjs/common";
import { HealthController } from "../health.controller";

function setup(options: { database?: "ok" | "fail" | "hang"; redis?: "ok" | "fail" } = {}) {
  const dataSource = {
    query: vi.fn(() => {
      if (options.database === "fail") return Promise.reject(new Error("db down"));
      if (options.database === "hang") return new Promise(() => {});
      return Promise.resolve([{ "?column?": 1 }]);
    }),
  };
  const redis = {
    ping: vi.fn(() =>
      options.redis === "fail" ? Promise.reject(new Error("redis down")) : Promise.resolve("PONG"),
    ),
  };
  const res = { status: vi.fn() };
  const controller = new HealthController(dataSource as never, redis as never);
  return { controller, res };
}

describe("HealthController", () => {
  it("reports ok with 200 when both dependencies answer", async () => {
    const { controller, res } = setup();

    const body = await controller.health(res as never);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.OK);
    expect(body).toEqual({ status: "ok", checks: { database: "up", redis: "up" } });
  });

  it("reports 503 when the database fails", async () => {
    const { controller, res } = setup({ database: "fail" });

    const body = await controller.health(res as never);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(body.checks).toEqual({ database: "down", redis: "up" });
  });

  it("reports 503 when redis fails", async () => {
    const { controller, res } = setup({ redis: "fail" });

    const body = await controller.health(res as never);

    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
    expect(body.checks).toEqual({ database: "up", redis: "down" });
  });

  it("gives up on a hung dependency instead of hanging the probe", async () => {
    vi.useFakeTimers();
    const { controller, res } = setup({ database: "hang" });

    const pending = controller.health(res as never);
    await vi.advanceTimersByTimeAsync(2500);
    const body = await pending;
    vi.useRealTimers();

    expect(body.checks.database).toBe("down");
    expect(res.status).toHaveBeenCalledWith(HttpStatus.SERVICE_UNAVAILABLE);
  });
});
