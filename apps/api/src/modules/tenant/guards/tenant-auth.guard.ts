import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    throw new UnauthorizedException(
      "Tenant-level API authentication is not supported. Use project-level API keys instead.",
    );
  }
}
