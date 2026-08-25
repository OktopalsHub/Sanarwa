import { Injectable } from "@nestjs/common";
import { NotificationChannel } from "../../../common/enums/notification-channel.enum";
import { ProviderCostModel } from "../interfaces/byop.interface";

export interface ProviderTemplate {
  id: string;
  name: string;
  providerId: string;
  channel: NotificationChannel;
  isPopular?: boolean;
  difficulty?: "easy" | "medium" | "hard";
  costModel?: ProviderCostModel;
}

@Injectable()
export class ProviderTemplateService {
  getTemplates(_channel?: NotificationChannel): ProviderTemplate[] {
    return [];
  }

  searchTemplates(_search: string, _channel?: NotificationChannel): ProviderTemplate[] {
    return [];
  }

  getPopularTemplates(_channel?: NotificationChannel): ProviderTemplate[] {
    return [];
  }

  getTemplate(_templateId: string): ProviderTemplate | null {
    return null;
  }

  validateConfiguration(_templateId: string, _config: Record<string, unknown>) {
    return { isValid: false, errors: ["Provider templates are not available"] };
  }

  getConfigurationHints(_templateId: string) {
    return [];
  }

  getRecommendedTemplates(_requirements: unknown): ProviderTemplate[] {
    return [];
  }
}
