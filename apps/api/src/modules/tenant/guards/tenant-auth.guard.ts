import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";

@Injectable()
export class TenantAuthGuard implements CanActivate {
  constructor() {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    // Tenant-level API authentication is not supported in the current architecture
    // Authentication is handled at the project level through API keys
    // Use the ApiKeyAuthGuard instead for project-level authentication
    throw new UnauthorizedException(
      "Tenant-level API authentication is not supported. Use project-level API keys instead.",
    );
  }
}
