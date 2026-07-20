import { Injectable } from '@nestjs/common';
import { AsyncLocalStorage } from 'async_hooks';
import { AsyncMemberContext } from '../interfaces/request-context.interface';

@Injectable()
export class ContextService {
  private static asyncLocalStorage =
    new AsyncLocalStorage<AsyncMemberContext>();

  /**
   * Run a function with member context
   */
  static runWithMemberContext<T>(context: AsyncMemberContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn);
  }

  /**
   * Get current member context from async storage
   */
  static getCurrentMemberContext(): AsyncMemberContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  /**
   * Get current member ID from context
   */
  static getCurrentMemberId(): string | undefined {
    const context = this.getCurrentMemberContext();
    return context?.id;
  }

  /**
   * Get current tenant ID from context
   */
  static getCurrentTenantId(): string | undefined {
    const context = this.getCurrentMemberContext();
    return context?.tenantId;
  }

  /**
   * Get current user ID from context
   */
  static getCurrentUserId(): string | undefined {
    const context = this.getCurrentMemberContext();
    return context?.userId;
  }

  /**
   * Check if current member has permission
   */
  static hasPermission(permission: string): boolean {
    const context = this.getCurrentMemberContext();
    return context?.permissions?.includes(permission) ?? false;
  }

  /**
   * Check if current member has role
   */
  static hasRole(role: string): boolean {
    const context = this.getCurrentMemberContext();
    return context?.role === role;
  }
}
