import {
  CreateProviderRequest,
  Provider,
  ProviderFailoverConfig,
  ProviderHealthCheck,
  ProviderMetrics,
  ProviderQueryParams,
  ProviderTestData,
  ProviderTestResult,
  ProviderType,
  UpdateProviderRequest,
} from "../types/provider";
import { ApiClientConsumer } from "../internal/api-client-consumer";
import { ProviderFailoverClient } from "./provider-failover";

export class ProviderHelpersClient extends ProviderFailoverClient {
  // Utility Methods

  /**
   * Validate provider configuration data before creating/updating
   * @param data Provider configuration data
   * @returns Validation result with errors if any
   */
  validateProviderConfig(data: CreateProviderRequest | UpdateProviderRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate name
    if ("name" in data && data.name) {
      if (data.name.length < 2) {
        errors.push("Provider name must be at least 2 characters long");
      }
      if (data.name.length > 100) {
        errors.push("Provider name must be less than 100 characters");
      }
    }

    // Validate priority
    if ("priority" in data && data.priority !== undefined) {
      if (data.priority < 0 || data.priority > 100) {
        errors.push("Priority must be between 0 and 100");
      }
    }

    // Validate configuration
    if ("config" in data && data.config) {
      const configErrors = this.validateProviderCredentials(data.config);
      errors.push(...configErrors);
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Validate provider credentials based on provider type
   * @param config Provider configuration
   * @returns Array of validation errors
   */
  private validateProviderCredentials(config: any): string[] {
    const errors: string[] = [];

    if (!config.credentials) {
      errors.push("Provider credentials are required");
      return errors;
    }

    const { credentials } = config;

    switch (credentials.type) {
      case "aws_ses":
        if (!credentials.config.region) errors.push("AWS SES region is required");
        if (!credentials.config.accessKeyId) errors.push("AWS SES access key ID is required");
        if (!credentials.config.secretAccessKey)
          errors.push("AWS SES secret access key is required");
        if (!credentials.config.fromEmail) errors.push("AWS SES from email is required");
        break;

      case "sendgrid":
        if (!credentials.config.apiKey) errors.push("SendGrid API key is required");
        if (!credentials.config.fromEmail) errors.push("SendGrid from email is required");
        break;

      case "twilio":
        if (!credentials.config.accountSid) errors.push("Twilio account SID is required");
        if (!credentials.config.authToken) errors.push("Twilio auth token is required");
        if (!credentials.config.fromNumber) errors.push("Twilio from number is required");
        break;

      case "firebase":
        if (!credentials.config.projectId) errors.push("Firebase project ID is required");
        if (!credentials.config.privateKey) errors.push("Firebase private key is required");
        if (!credentials.config.clientEmail) errors.push("Firebase client email is required");
        break;

      // Add more provider type validations as needed
    }

    return errors;
  }

  /**
   * Get recommended provider for a specific channel based on performance
   * @param channel Provider type/channel
   * @returns Recommended provider ID and reasoning
   */
  async getRecommendedProvider(channel: ProviderType): Promise<{
    providerId: string;
    providerName: string;
    reason: string;
    confidence: number;
    alternatives: Array<{
      providerId: string;
      providerName: string;
      reason: string;
    }>;
  }> {
    return this.apiClient.get(`/provider-configs/recommendations/${channel}`);
  }

  /**
   * Check if a provider supports a specific feature
   * @param providerId Provider ID
   * @param feature Feature to check
   * @returns True if feature is supported
   */
  async checkProviderFeatureSupport(
    providerId: string,
    feature: string,
  ): Promise<{
    supported: boolean;
    details?: string;
    alternatives?: string[];
  }> {
    return this.apiClient.get(`/provider-configs/${providerId}/features/${feature}`);
  }

  /**
   * Get provider configuration template for a specific type
   * @param type Provider type
   * @param subtype Provider subtype
   * @returns Configuration template with required fields
   */
  getProviderConfigTemplate(
    type: ProviderType,
    subtype: string,
  ): {
    requiredFields: string[];
    optionalFields: string[];
    example: any;
    documentation?: string;
  } {
    // This is a client-side helper method
    const templates: Record<string, any> = {
      "email.aws_ses": {
        requiredFields: ["region", "accessKeyId", "secretAccessKey", "fromEmail"],
        optionalFields: ["fromName", "replyToEmail", "configurationSet"],
        example: {
          region: "us-east-1",
          accessKeyId: "YOUR_ACCESS_KEY_ID",
          secretAccessKey: "YOUR_SECRET_ACCESS_KEY",
          fromEmail: "noreply@yourdomain.com",
          fromName: "Your App Name",
        },
        documentation: "https://docs.aws.amazon.com/ses/",
      },
      "email.sendgrid": {
        requiredFields: ["apiKey", "fromEmail"],
        optionalFields: ["fromName", "replyToEmail", "templateId"],
        example: {
          apiKey: "SG.YOUR_API_KEY",
          fromEmail: "noreply@yourdomain.com",
          fromName: "Your App Name",
        },
        documentation: "https://docs.sendgrid.com/",
      },
      "sms.twilio": {
        requiredFields: ["accountSid", "authToken", "fromNumber"],
        optionalFields: ["messagingServiceSid"],
        example: {
          accountSid: "AC_YOUR_ACCOUNT_SID",
          authToken: "YOUR_AUTH_TOKEN",
          fromNumber: "+1234567890",
        },
        documentation: "https://www.twilio.com/docs/",
      },
      // Add more templates as needed
    };

    const key = `${type}.${subtype}`;
    return (
      templates[key] || {
        requiredFields: [],
        optionalFields: [],
        example: {},
      }
    );
  }

  /**
   * Format provider for display in UI
   * @param provider Provider to format
   * @returns Formatted provider data for display
   */
  formatProviderForDisplay(provider: Provider): {
    name: string;
    type: string;
    status: string;
    health: string;
    successRate: string;
    lastUsed: string;
    isDefault: boolean;
    statusColor: string;
    healthColor: string;
  } {
    const formatDate = (date?: Date) => {
      if (!date) return "Never";
      const now = new Date();
      const diffMs = now.getTime() - new Date(date).getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return "Today";
      if (diffDays === 1) return "Yesterday";
      if (diffDays < 7) return `${diffDays} days ago`;
      return new Date(date).toLocaleDateString();
    };

    const getStatusColor = (status: string) => {
      switch (status) {
        case "active":
          return "green";
        case "inactive":
          return "gray";
        case "testing":
          return "yellow";
        case "error":
          return "red";
        case "maintenance":
          return "orange";
        default:
          return "gray";
      }
    };

    const getHealthColor = (health: string) => {
      switch (health) {
        case "healthy":
          return "green";
        case "degraded":
          return "yellow";
        case "unhealthy":
          return "red";
        case "unknown":
          return "gray";
        default:
          return "gray";
      }
    };

    return {
      name: provider.name,
      type: `${provider.type} (${provider.subtype})`,
      status: provider.status,
      health: provider.healthStatus,
      successRate: `${(provider.successRate * 100).toFixed(1)}%`,
      lastUsed: formatDate(provider.lastUsed),
      isDefault: provider.isDefault,
      statusColor: getStatusColor(provider.status),
      healthColor: getHealthColor(provider.healthStatus),
    };
  }
}
