import { describe, expect, it } from "vitest";
import { ExecutionContext, ForbiddenException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { RolesGuard } from "../guards/roles.guard";
import { Roles } from "../decorators/roles.decorator";

class Open {
  handler() {}
}

class Restricted {
  @Roles("admin")
  handler() {}
}

function contextFor(
  target: new () => object,
  user?: { email?: string; emailVerified?: boolean },
): ExecutionContext {
  return {
    getType: () => "http",
    getHandler: () => target.prototype.handler,
    getClass: () => target,
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guard(admins?: string) {
  const config = { get: () => admins } as unknown as ConfigService;
  return new RolesGuard(new Reflector(), config);
}

describe("RolesGuard", () => {
  it("lets routes without a role requirement through", () => {
    expect(guard().canActivate(contextFor(Open))).toBe(true);
  });

  it("allows a verified platform admin, ignoring case and spacing", () => {
    const allowed = guard(" Ops@Example.com , other@example.com ");

    const result = allowed.canActivate(
      contextFor(Restricted, { email: "ops@example.com", emailVerified: true }),
    );

    expect(result).toBe(true);
  });

  it("rejects an ordinary signed-in user", () => {
    const denied = () =>
      guard("ops@example.com").canActivate(
        contextFor(Restricted, { email: "user@example.com", emailVerified: true }),
      );

    expect(denied).toThrow(ForbiddenException);
  });

  it("rejects an allowlisted email that is not verified", () => {
    const denied = () =>
      guard("ops@example.com").canActivate(
        contextFor(Restricted, { email: "ops@example.com", emailVerified: false }),
      );

    expect(denied).toThrow(ForbiddenException);
  });

  it("fails closed when no admins are configured", () => {
    const denied = () =>
      guard(undefined).canActivate(
        contextFor(Restricted, { email: "ops@example.com", emailVerified: true }),
      );

    expect(denied).toThrow(ForbiddenException);
  });

  it("rejects a request with no user", () => {
    expect(() => guard("ops@example.com").canActivate(contextFor(Restricted))).toThrow(
      ForbiddenException,
    );
  });
});
