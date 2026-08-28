import {
  ApiKey,
  ApiKeyAction,
  ApiKeyActivity,
  ApiKeyAlert,
  ApiKeyAlertType,
  ApiKeyBulkOperation,
  ApiKeyBulkOperationResult,
  ApiKeyPermission,
  ApiKeyQueryParams,
  ApiKeyRotation,
  ApiKeySecuritySettings,
  ApiKeyStats,
  ApiKeyStatus,
  ApiKeyTemplate,
  ApiKeyType,
  ApiKeyUsage,
  ApiKeyWithSecret,
  CreateApiKeyRequest,
  UpdateApiKeyRequest,
} from "../types/api-key";
import { ApiClientConsumer } from "../internal/api-client-consumer";
import { ApiKeyAdminClient } from "./api-key-admin";

export class ApiKeyHelpersClient extends ApiKeyAdminClient {
  // Utility Methods

  /**
   * Validate API key data before creating/updating
   * @param data API key data
   * @returns Validation result
   */
  validateApiKeyData(data: CreateApiKeyRequest | UpdateApiKeyRequest): {
    isValid: boolean;
    errors: string[];
  } {
    const errors: string[] = [];

    // Validate name
    if ("name" in data && data.name) {
      if (data.name.length < 2) {
        errors.push("API key name must be at least 2 characters long");
      }
      if (data.name.length > 100) {
        errors.push("API key name must be less than 100 characters");
      }
      if (!/^[a-zA-Z0-9\s\-_]+$/.test(data.name)) {
        errors.push(
          "API key name can only contain letters, numbers, spaces, hyphens, and underscores",
        );
      }
    }

    // Validate rate limit
    if ("rateLimit" in data && data.rateLimit !== undefined) {
      if (data.rateLimit < 1 || data.rateLimit > 10000) {
        errors.push("Rate limit must be between 1 and 10000 requests per minute");
      }
    }

    // Validate expiry date
    if ("expiresAt" in data && data.expiresAt) {
      const now = new Date();
      if (data.expiresAt <= now) {
        errors.push("Expiry date must be in the future");
      }

      const maxExpiry = new Date();
      maxExpiry.setFullYear(maxExpiry.getFullYear() + 5); // Max 5 years
      if (data.expiresAt > maxExpiry) {
        errors.push("Expiry date cannot be more than 5 years in the future");
      }
    }

    // Validate IP whitelist
    if ("ipWhitelist" in data && data.ipWhitelist) {
      const ipRegex =
        /^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)(?:\/(?:[0-9]|[1-2][0-9]|3[0-2]))?$/;

      for (const ip of data.ipWhitelist) {
        if (!ipRegex.test(ip)) {
          errors.push(`Invalid IP address or CIDR notation: ${ip}`);
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Format API key for display in UI
   * @param apiKey API key to format
   * @returns Formatted API key data
   */
  formatApiKeyForDisplay(apiKey: ApiKey): {
    name: string;
    keyPrefix: string;
    type: string;
    status: string;
    statusColor: string;
    expiryStatus: string;
    expiryColor: string;
    lastUsed: string;
    usageCount: string;
    rateLimit: string;
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

    const getStatusColor = (status: ApiKeyStatus) => {
      switch (status) {
        case ApiKeyStatus.ACTIVE:
          return "green";
        case ApiKeyStatus.INACTIVE:
          return "yellow";
        case ApiKeyStatus.REVOKED:
          return "red";
        default:
          return "gray";
      }
    };

    const getExpiryStatus = () => {
      if (!apiKey.expiresAt) return "No expiry";

      const now = new Date();
      const expiryDate = new Date(apiKey.expiresAt);
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs <= 0) return "Expired";
      if (diffDays <= 7) return `Expires in ${diffDays} days`;
      if (diffDays <= 30) return `Expires in ${Math.ceil(diffDays / 7)} weeks`;
      return `Expires ${expiryDate.toLocaleDateString()}`;
    };

    const getExpiryColor = () => {
      if (!apiKey.expiresAt) return "gray";

      const now = new Date();
      const expiryDate = new Date(apiKey.expiresAt);
      const diffMs = expiryDate.getTime() - now.getTime();
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMs <= 0) return "red";
      if (diffDays <= 7) return "red";
      if (diffDays <= 30) return "yellow";
      return "green";
    };

    return {
      name: apiKey.name,
      keyPrefix: `${apiKey.keyPrefix}...`,
      type: apiKey.type.replace("_", " ").toUpperCase(),
      status: apiKey.status.charAt(0).toUpperCase() + apiKey.status.slice(1),
      statusColor: getStatusColor(apiKey.status),
      expiryStatus: getExpiryStatus(),
      expiryColor: getExpiryColor(),
      lastUsed: formatDate(apiKey.lastUsedAt),
      usageCount: apiKey.usageCount.toLocaleString(),
      rateLimit: apiKey.rateLimit ? `${apiKey.rateLimit}/min` : "No limit",
    };
  }

  /**
   * Generate secure API key name suggestion
   * @param type API key type
   * @param projectName Optional project name
   * @returns Suggested API key name
   */
  generateApiKeyName(type: ApiKeyType, projectName?: string): string {
    const timestamp = new Date().toISOString().slice(0, 10);
    const typeLabel = type.replace("_", " ").toLowerCase();

    if (projectName) {
      return `${projectName} ${typeLabel} key (${timestamp})`;
    }

    return `${typeLabel} key (${timestamp})`;
  }

  /**
   * Check if API key is expiring soon
   * @param apiKey API key to check
   * @param warningDays Days before expiry to warn (default: 30)
   * @returns True if expiring soon
   */
  isExpiringSoon(apiKey: ApiKey, warningDays: number = 30): boolean {
    if (!apiKey.expiresAt) return false;

    const now = new Date();
    const expiryDate = new Date(apiKey.expiresAt);
    const diffMs = expiryDate.getTime() - now.getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

    return diffDays <= warningDays && diffDays > 0;
  }

  /**
   * Calculate API key security score
   * @param apiKey API key to evaluate
   * @returns Security score (0-100)
   */
  calculateSecurityScore(apiKey: ApiKey): {
    score: number;
    factors: Array<{
      factor: string;
      score: number;
      weight: number;
      recommendation?: string;
    }>;
  } {
    const factors = [
      {
        factor: "Has expiry date",
        score: apiKey.expiresAt ? 100 : 0,
        weight: 20,
        recommendation: !apiKey.expiresAt ? "Set an expiry date for better security" : undefined,
      },
      {
        factor: "IP whitelist configured",
        score: apiKey.ipWhitelist && apiKey.ipWhitelist.length > 0 ? 100 : 0,
        weight: 25,
        recommendation: !apiKey.ipWhitelist?.length
          ? "Configure IP whitelist to restrict access"
          : undefined,
      },
      {
        factor: "Rate limit configured",
        score: apiKey.rateLimit ? 100 : 0,
        weight: 15,
        recommendation: !apiKey.rateLimit ? "Set a rate limit to prevent abuse" : undefined,
      },
      {
        factor: "Limited permissions",
        score: apiKey.permissions && apiKey.permissions.length < 10 ? 100 : 50,
        weight: 20,
        recommendation: !apiKey.permissions?.length
          ? "Limit permissions to minimum required"
          : undefined,
      },
      {
        factor: "Recent usage",
        score:
          apiKey.lastUsedAt &&
          new Date(apiKey.lastUsedAt) > new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
            ? 100
            : 0,
        weight: 10,
        recommendation: !apiKey.lastUsedAt ? "Consider revoking unused API keys" : undefined,
      },
      {
        factor: "Not expired",
        score: !apiKey.isExpired ? 100 : 0,
        weight: 10,
        recommendation: apiKey.isExpired ? "Regenerate or remove expired API key" : undefined,
      },
    ];

    const totalScore = factors.reduce(
      (sum, factor) => sum + (factor.score * factor.weight) / 100,
      0,
    );
    const maxScore = factors.reduce((sum, factor) => sum + factor.weight, 0);

    return {
      score: Math.round((totalScore / maxScore) * 100),
      factors,
    };
  }
}
