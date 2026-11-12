import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Reflector } from "@nestjs/core";
import { ROLES_KEY } from "../decorators/roles.decorator";

/**
 * Enforces `@Roles()` / `@RequireRoles()`. Every role name in this codebase is
 * a platform-level role, so a route that declares any of them is restricted to
 * the verified emails in `PLATFORM_ADMIN_EMAILS`. With the variable unset or
 * empty nobody passes: it fails closed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly config: ConfigService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      return true;
    }

    const required = this.reflector.getAllAndOverride<string[] | undefined>(ROLES_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!required || required.length === 0) {
      return true;
    }

    const user = context.switchToHttp().getRequest().user as
      | { email?: string | null; emailVerified?: boolean }
      | undefined;
    const email = user?.email?.trim().toLowerCase();

    if (!email || user?.emailVerified !== true || !this.platformAdmins().has(email)) {
      throw new ForbiddenException("Platform administrator access required");
    }

    return true;
  }

  private platformAdmins(): Set<string> {
    const raw = this.config.get<string>("PLATFORM_ADMIN_EMAILS") ?? "";
    return new Set(
      raw
        .split(",")
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    );
  }
}
