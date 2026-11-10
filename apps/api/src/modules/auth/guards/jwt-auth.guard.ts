import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { PUBLIC_KEY } from "../decorators/public.decorator";
import { auth } from "../better-auth";

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private reflector: Reflector) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (context.getType() !== "http") {
      return true;
    }

    const isPublic = this.reflector.getAllAndOverride<boolean>(PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest();

    let session: Awaited<ReturnType<typeof auth.api.getSession>> = null;
    try {
      session = await auth.api.getSession({ headers: request.headers });
    } catch {
      session = null;
    }

    if (!session?.user) {
      throw new UnauthorizedException("Not authenticated");
    }

    const user = session.user as { id: string; email?: string | null };
    request.auth = {
      principalId: user.id,
      tokenType: "session",
      issuedAt: new Date(
        (session.session as { createdAt?: Date } | undefined)?.createdAt ?? Date.now(),
      ),
      expiresAt: (session.session as { expiresAt?: Date } | undefined)?.expiresAt ?? null,
      activeOrganizationId:
        (session.session as { activeOrganizationId?: string } | undefined)?.activeOrganizationId ??
        null,
    };
    request.user = {
      id: user.id,
      sub: user.id,
      email: user.email,
      provider: "session",
    };
    return true;
  }
}
