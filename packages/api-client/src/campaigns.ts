import type {
  AudienceSegment,
  Campaign,
  CommunicationChannel,
  CreateCampaignRequest,
  UpdateCampaignRequest
} from './types/campaign';
import { apiClient } from './client';

export interface CampaignListParams {
  page?: number;
  limit?: number;
  status?: string;
  type?: string;
  search?: string;
  sortBy?: 'name' | 'createdAt' | 'updatedAt' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface CampaignListResponse {
  campaigns: Campaign[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export const campaignApi = {
  // Campaign CRUD operations
  async getCampaigns(params: CampaignListParams = {}): Promise<CampaignListResponse> {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined) {
        searchParams.append(key, value.toString());
      }
    });

    return apiClient.get<CampaignListResponse>(`/tenants/:tenantId/campaigns?${searchParams.toString()}`);
  },

  async getCampaign(id: string): Promise<Campaign> {
    return apiClient.get<Campaign>(`/tenants/:tenantId/campaigns/${id}`);
  },

  async createCampaign(data: CreateCampaignRequest): Promise<Campaign> {
    return apiClient.post<Campaign>('/tenants/:tenantId/campaigns', data);
  },

  async updateCampaign(data: UpdateCampaignRequest): Promise<Campaign> {
    const { id, ...updateData } = data;
    return apiClient.patch<Campaign>(`/tenants/:tenantId/campaigns/${id}`, updateData);
  },

  async deleteCampaign(id: string): Promise<void> {
    return apiClient.delete<void>(`/tenants/:tenantId/campaigns/${id}`);
  },

  async duplicateCampaign(id: string, name: string): Promise<Campaign> {
    return apiClient.post<Campaign>(`/campaigns/${id}/duplicate`, { name });
  },

  // Campaign control operations
  async startCampaign(id: string): Promise<Campaign> {
    return apiClient.post<Campaign>(`/campaigns/${id}/start`);
  },

  async pauseCampaign(id: string): Promise<Campaign> {
    return apiClient.post<Campaign>(`/campaigns/${id}/pause`);
  },

  async resumeCampaign(id: string): Promise<Campaign> {
    return apiClient.post<Campaign>(`/campaigns/${id}/resume`);
  },

  async stopCampaign(id: string): Promise<Campaign> {
    return apiClient.post<Campaign>(`/campaigns/${id}/stop`);
  },

  // Campaign analytics
  async getCampaignAnalytics(id: string, dateRange?: { start: Date; end: Date }) {
    const params = new URLSearchParams();
    if (dateRange) {
      params.append('start', dateRange.start.toISOString());
      params.append('end', dateRange.end.toISOString());
    }

    return apiClient.get(`/campaigns/${id}/analytics?${params.toString()}`);
  },

  // Audience management
  async getAudienceSegments(): Promise<AudienceSegment[]> {
    return apiClient.get<AudienceSegment[]>('/audience/segments');
  },

  async getAudienceSegment(id: string): Promise<AudienceSegment> {
    return apiClient.get<AudienceSegment>(`/audience/segments/${id}`);
  },

  async estimateAudienceSize(filters: any[]): Promise<{ size: number }> {
    return apiClient.post<{ size: number }>('/audience/estimate', { filters });
  },

  // Template management (simplified for campaigns)
  async getTemplates(channel?: CommunicationChannel): Promise<any[]> {
    const params = channel ? `?channel=${channel}` : '';
    return apiClient.get<any[]>(`/templates${params}`);
  },

  async getTemplate(id: string): Promise<any> {
    return apiClient.get<any>(`/templates/${id}`);
  },

  // Campaign preview and testing
  async previewCampaign(id: string, recipientEmail?: string) {
    const params = recipientEmail ? `?email=${recipientEmail}` : '';
    return apiClient.post(`/campaigns/${id}/preview${params}`);
  },

  async sendTestCampaign(id: string, testEmails: string[]) {
    return apiClient.post(`/campaigns/${id}/test`, { emails: testEmails });
  },
};