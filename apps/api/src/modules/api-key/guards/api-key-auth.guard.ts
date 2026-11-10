import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from "@nestjs/common";
import { ApiKeyVerificationService } from "../api-key-verification.service";

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(private readonly verifier: ApiKeyVerificationService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException("Missing API key");
    }

    const ipAddress = this.getClientIp(request);
    const requiredPermissions = this.getRequiredPermissions(request);

    const principal = await this.verifier.verify({
      apiKey,
      ipAddress,
      requiredPermissions,
    });

    request.apiKey = principal;
    return true;
  }

  private extractApiKey(request: any): string | null {
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      return authHeader.substring(7);
    }
    if (request.headers["x-api-key"]) {
      return request.headers["x-api-key"];
    }
    return null;
  }

  private getClientIp(request: any): string {
    return (
      request.ip || request.socket?.remoteAddress || request.connection?.remoteAddress || "unknown"
    );
  }

  private getRequiredPermissions(request: any): string[] {
    const path = request.path;
    const method = request.method;

    const permissionMap: Record<string, string[]> = {
      "POST /notifications": ["notifications:send"],
      "GET /notifications": ["notifications:read"],
      "POST /templates": ["templates:create"],
      "GET /templates": ["templates:read"],
      "PUT /templates": ["templates:update"],
      "DELETE /templates": ["templates:delete"],
      "POST /messages": ["notifications:send"],
      "GET /messages": ["notifications:read"],
      "POST /webhooks": ["webhooks:manage"],
      "GET /webhooks": ["webhooks:read"],
    };

    for (const [route, permissions] of Object.entries(permissionMap)) {
      const [routeMethod, routePath] = route.split(" ");
      if (method === routeMethod && path.startsWith(routePath)) {
        return permissions;
      }
    }

    return [];
  }
}
