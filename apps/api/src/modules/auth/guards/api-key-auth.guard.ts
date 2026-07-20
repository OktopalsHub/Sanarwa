import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
  ForbiddenException,
  BadRequestException,
  Optional,
} from '@nestjs/common';
import { ApiKeyService } from '../../api-key/api-key.service';
import { TokenManagementService } from '../../token-management/services/token-management.service';

@Injectable()
export class ApiKeyAuthGuard implements CanActivate {
  constructor(
    private apiKeyService: ApiKeyService,
    @Optional() private tokenManagementService?: TokenManagementService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiKey = this.extractApiKey(request);

    if (!apiKey) {
      throw new UnauthorizedException('Missing API key');
    }

    // Get client IP address
    const ipAddress = this.getClientIp(request);

    // Validate API key
    const validatedKey = await this.apiKeyService.validateApiKey(
      apiKey,
      undefined,
      ipAddress,
    );

    if (!validatedKey) {
      throw new UnauthorizedException('Invalid or inactive API key');
    }

    // Check if key is expired
    if (validatedKey.isExpired) {
      throw new ForbiddenException('API key has expired');
    }

    // Check if key is revoked
    if (validatedKey.status === 'revoked') {
      throw new ForbiddenException('API key has been revoked');
    }

    // Check IP whitelist
    if (validatedKey.ipWhitelist && validatedKey.ipWhitelist.length > 0) {
      if (!validatedKey.ipWhitelist.includes(ipAddress)) {
        throw new ForbiddenException(
          `IP address ${ipAddress} is not whitelisted for this API key`,
        );
      }
    }

    // Check rate limits
    await this.checkRateLimits(validatedKey.id, validatedKey);

    // Check token quota
    if (validatedKey.tenantId) {
      await this.checkTokenQuota(validatedKey.tenantId);
    }

    // Check permissions
    const requiredPermissions = this.getRequiredPermissions(request);
    if (requiredPermissions.length > 0) {
      this.checkPermissions(validatedKey.permissions, requiredPermissions);
    }

    // Attach API key info to request
    request.apiKey = {
      id: validatedKey.id,
      keyPrefix: validatedKey.keyPrefix,
      projectId: validatedKey.projectId,
      tenantId: validatedKey.tenantId,
      permissions: validatedKey.permissions,
      environment: validatedKey.environment,
    };

    return true;
  }

  /**
   * Extract API key from request headers
   */
  private extractApiKey(request: any): string | null {
    // Check Authorization header first (Bearer token)
    const authHeader = request.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      return authHeader.substring(7);
    }

    // Check X-API-Key header
    if (request.headers['x-api-key']) {
      return request.headers['x-api-key'];
    }

    // Check query parameter (less secure, use with caution)
    if (request.query && request.query.api_key) {
      return request.query.api_key;
    }

    return null;
  }

  /**
   * Get client IP address
   */
  private getClientIp(request: any): string {
    return (
      request.headers['x-forwarded-for']?.split(',')[0].trim() ||
      request.headers['x-real-ip'] ||
      request.connection.remoteAddress ||
      request.socket.remoteAddress ||
      request.ip ||
      'unknown'
    );
  }

  /**
   * Check rate limits for API key
   */
  private async checkRateLimits(
    apiKeyId: string,
    apiKey: any,
  ): Promise<void> {
    // TODO: Implement rate limiting with Redis
    // For now, just check the configured limits exist
    if (!apiKey.rateLimitPerMinute || !apiKey.rateLimitPerHour || !apiKey.rateLimitPerDay) {
      throw new BadRequestException('API key rate limits not configured');
    }
  }

  /**
   * Check token quota for tenant
   */
  private async checkTokenQuota(tenantId: string): Promise<void> {
    // Skip if TokenManagementService is not available
    if (!this.tokenManagementService) {
      return;
    }

    try {
      const balance = await this.tokenManagementService.getBalance(tenantId);

      if (balance.availableTokens <= 0) {
        throw new ForbiddenException(
          'Insufficient token balance. Please purchase more tokens.',
        );
      }

      // Warn if tokens are running low (less than 10% available)
      if (balance.availableTokens < balance.totalTokens * 0.1) {
        // Log warning but don't block
        console.warn(
          `Low token balance for tenant ${tenantId}: ${balance.availableTokens}/${balance.totalTokens}`,
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      throw new BadRequestException('Failed to check token quota');
    }
  }

  /**
   * Get required permissions for the current route
   */
  private getRequiredPermissions(request: any): string[] {
    // Extract from route metadata or request path
    const path = request.path;
    const method = request.method;

    // Map routes to required permissions
    const permissionMap: Record<string, string[]> = {
      'POST /notifications': ['notifications:send'],
      'GET /notifications': ['notifications:read'],
      'POST /templates': ['templates:create'],
      'GET /templates': ['templates:read'],
      'PUT /templates': ['templates:update'],
      'DELETE /templates': ['templates:delete'],
      'POST /messages': ['messages:send'],
      'GET /messages': ['messages:read'],
      'POST /webhooks': ['webhooks:manage'],
      'GET /webhooks': ['webhooks:read'],
    };

    // Check for matching route
    for (const [route, permissions] of Object.entries(permissionMap)) {
      const [routeMethod, routePath] = route.split(' ');
      if (method === routeMethod && path.startsWith(routePath)) {
        return permissions;
      }
    }

    return [];
  }

  /**
   * Check if API key has required permissions
   */
  private checkPermissions(
    keyPermissions: string[],
    requiredPermissions: string[],
  ): void {
    const hasAllPermissions = requiredPermissions.every((required) =>
      keyPermissions.includes(required) || keyPermissions.includes('*'),
    );

    if (!hasAllPermissions) {
      const missingPermissions = requiredPermissions.filter(
        (required) => !keyPermissions.includes(required),
      );
      throw new ForbiddenException(
        `Missing permissions: ${missingPermissions.join(', ')}`,
      );
    }
  }
}
