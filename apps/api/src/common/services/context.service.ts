import { Injectable } from "@nestjs/common";
import { AsyncLocalStorage } from "async_hooks";
import { AsyncMemberContext } from "../interfaces/request-context.interface";

@Injectable()
export class ContextService {
  private static asyncLocalStorage = new AsyncLocalStorage<AsyncMemberContext>();

  static runWithMemberContext<T>(context: AsyncMemberContext, fn: () => T): T {
    return this.asyncLocalStorage.run(context, fn);
  }

  static getCurrentMemberContext(): AsyncMemberContext | undefined {
    return this.asyncLocalStorage.getStore();
  }

  static getCurrentMemberId(): string | undefined {
    const context = this.getCurrentMemberContext();
    return context?.id;
  }

  static getCurrentTenantId(): string | undefined {
    const context = this.getCurrentMemberContext();
    return context?.tenantId;
  }

  static getCurrentUserId(): string | undefined {
    const context = this.getCurrentMemberContext();
    return context?.userId;
  }

  static hasPermission(permission: string): boolean {
    const context = this.getCurrentMemberContext();
    return context?.permissions?.includes(permission) ?? false;
  }

  static hasRole(role: string): boolean {
    const context = this.getCurrentMemberContext();
    return context?.role === role;
  }
}
