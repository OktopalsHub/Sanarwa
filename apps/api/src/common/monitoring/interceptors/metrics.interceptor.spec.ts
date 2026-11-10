import { CallHandler, ExecutionContext } from "@nestjs/common";
import { of, throwError } from "rxjs";
import { describe, expect, it, vi } from "vitest";
import { MetricsInterceptor } from "./metrics.interceptor";

const UUID = "123e4567-e89b-12d3-a456-426614174000";

function makeContext(request: Record<string, unknown>, statusCode = 200) {
  const response = { statusCode, on: vi.fn() };
  const context = {
    getType: () => "http",
    switchToHttp: () => ({
      getRequest: () => ({
        method: "GET",
        url: `/api/v1/widgets/${UUID}`,
        headers: {},
        ...request,
      }),
      getResponse: () => response,
    }),
  } as unknown as ExecutionContext;
  return { context, response };
}

const makeHandler = (): CallHandler => ({ handle: () => of("ok") }) as unknown as CallHandler;

function build() {
  const metrics = {
    incrementHttpInProgress: vi.fn(),
    decrementHttpInProgress: vi.fn(),
    incrementHttpRequests: vi.fn(),
    observeHttpDuration: vi.fn(),
  };
  const interceptor = new MetricsInterceptor(metrics as never);
  return { interceptor, metrics };
}

describe("MetricsInterceptor", () => {
  it("records request metrics on completion", async () => {
    const { interceptor, metrics } = build();
    const { context } = makeContext({
      route: { path: "/api/v1/widgets/:id" },
      user: { tenantId: "tenant-1" },
    });

    await new Promise((resolve) => {
      interceptor.intercept(context, makeHandler()).subscribe({ complete: resolve });
    });

    expect(metrics.incrementHttpInProgress).toHaveBeenCalledWith("GET", "/api/v1/widgets/:id");
    expect(metrics.incrementHttpRequests).toHaveBeenCalledWith(
      "GET",
      "/api/v1/widgets/:id",
      200,
      "tenant-1",
    );
    expect(metrics.observeHttpDuration).toHaveBeenCalledWith(
      "GET",
      "/api/v1/widgets/:id",
      200,
      expect.any(Number),
    );
    expect(metrics.decrementHttpInProgress).toHaveBeenCalledWith("GET", "/api/v1/widgets/:id");
  });

  it("normalizes uuid and numeric path segments when no route is present", async () => {
    const { interceptor, metrics } = build();
    const { context } = makeContext({ route: undefined, url: `/api/v1/widgets/${UUID}/7` });

    await new Promise((resolve) => {
      interceptor.intercept(context, makeHandler()).subscribe({ complete: resolve });
    });

    expect(metrics.incrementHttpRequests).toHaveBeenCalledWith(
      "GET",
      "/api/v1/widgets/:id/:id",
      200,
      undefined,
    );
  });

  it("increments with 500 and rethrows when the handler errors", async () => {
    const { interceptor, metrics } = build();
    const failingHandler = {
      handle: () => throwError(() => new Error("boom")),
    } as unknown as CallHandler;
    const { context, response } = makeContext({ route: { path: "/api/v1/widgets" } }, 201);

    await expect(
      new Promise((resolve, reject) => {
        interceptor.intercept(context, failingHandler).subscribe({ error: reject });
      }),
    ).rejects.toThrow("boom");

    expect(metrics.incrementHttpRequests).toHaveBeenCalledWith(
      "GET",
      "/api/v1/widgets",
      201,
      undefined,
    );
    expect(metrics.decrementHttpInProgress).toHaveBeenCalled();
  });

  it("ignores non-http contexts", async () => {
    const { interceptor, metrics } = build();
    const rpcContext = {
      getType: () => "rpc",
      switchToHttp: () => {
        throw new Error("must not be called");
      },
    } as unknown as ExecutionContext;

    const next: CallHandler = { handle: () => of("ok") };
    await expect(
      new Promise((resolve) =>
        interceptor.intercept(rpcContext, next).subscribe({ complete: resolve }),
      ),
    ).resolves.toBeUndefined();
    expect(metrics.incrementHttpInProgress).not.toHaveBeenCalled();
  });
});
