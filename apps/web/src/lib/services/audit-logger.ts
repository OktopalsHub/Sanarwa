import { AuditLogEntry } from '@/lib/types/permissions';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001';

export interface AuditLogData {
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: Record<string, any>;
}

class AuditLogger {
  private baseUrl: string;

  constructor(baseUrl: string = API_BASE_URL) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const url = `${this.baseUrl}${endpoint}`;

    const config: RequestInit = {
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
      credentials: 'include',
      ...options,
    };

    try {
      const response = await fetch(url, config);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Audit log request failed:', error);
      throw error;
    }
  }

  async log(data: AuditLogData): Promise<void> {
    try {
      await this.request<void>('/audit/log', {
        method: 'POST',
        body: JSON.stringify(data),
      });
    } catch (error) {
      // Don't throw audit logging errors to avoid breaking the main flow
      console.error('Failed to log audit entry:', error);
    }
  }

  async getAuditLogs(
    tenantId: string,
    options: {
      page?: number;
      limit?: number;
      userId?: string;
      action?: string;
      resource?: string;
      startDate?: string;
      endDate?: string;
    } = {}
  ): Promise<{
    logs: AuditLogEntry[];
    total: number;
    page: number;
    limit: number;
  }> {
    const searchParams = new URLSearchParams();

    if (options.page) searchParams.set('page', options.page.toString());
    if (options.limit) searchParams.set('limit', options.limit.toString());
    if (options.userId) searchParams.set('userId', options.userId);
    if (options.action) searchParams.set('action', options.action);
    if (options.resource) searchParams.set('resource', options.resource);
    if (options.startDate) searchParams.set('startDate', options.startDate);
    if (options.endDate) searchParams.set('endDate', options.endDate);

    return this.request<{
      logs: AuditLogEntry[];
      total: number;
      page: number;
      limit: number;
    }>(`/tenants/${tenantId}/audit?${searchParams.toString()}`);
  }

  // Convenience methods for common actions
  async logLogin(): Promise<void> {
    return this.log({
      action: 'login',
      resource: 'auth',
    });
  }

  async logLogout(): Promise<void> {
    return this.log({
      action: 'logout',
      resource: 'auth',
    });
  }

  async logTenantSwitch(tenantId: string): Promise<void> {
    return this.log({
      action: 'switch_tenant',
      resource: 'tenant',
      resourceId: tenantId,
    });
  }

  async logPermissionChange(
    userId: string,
    oldRole: string,
    newRole: string
  ): Promise<void> {
    return this.log({
      action: 'permission_change',
      resource: 'user',
      resourceId: userId,
      metadata: {
        oldRole,
        newRole,
      },
    });
  }

  async logMemberInvite(email: string, role: string): Promise<void> {
    return this.log({
      action: 'member_invite',
      resource: 'tenant_member',
      metadata: {
        email,
        role,
      },
    });
  }

  async logMemberRemove(userId: string): Promise<void> {
    return this.log({
      action: 'member_remove',
      resource: 'tenant_member',
      resourceId: userId,
    });
  }

  async logCampaignCreate(campaignId: string): Promise<void> {
    return this.log({
      action: 'create',
      resource: 'campaign',
      resourceId: campaignId,
    });
  }

  async logCampaignUpdate(campaignId: string, changes: Record<string, any>): Promise<void> {
    return this.log({
      action: 'update',
      resource: 'campaign',
      resourceId: campaignId,
      metadata: { changes },
    });
  }

  async logCampaignDelete(campaignId: string): Promise<void> {
    return this.log({
      action: 'delete',
      resource: 'campaign',
      resourceId: campaignId,
    });
  }

  async logWorkflowCreate(workflowId: string): Promise<void> {
    return this.log({
      action: 'create',
      resource: 'workflow',
      resourceId: workflowId,
    });
  }

  async logWorkflowUpdate(workflowId: string, changes: Record<string, any>): Promise<void> {
    return this.log({
      action: 'update',
      resource: 'workflow',
      resourceId: workflowId,
      metadata: { changes },
    });
  }

  async logWorkflowDelete(workflowId: string): Promise<void> {
    return this.log({
      action: 'delete',
      resource: 'workflow',
      resourceId: workflowId,
    });
  }

  async logSettingsUpdate(section: string, changes: Record<string, any>): Promise<void> {
    return this.log({
      action: 'update',
      resource: 'settings',
      resourceId: section,
      metadata: { changes },
    });
  }
}

export const auditLogger = new AuditLogger();