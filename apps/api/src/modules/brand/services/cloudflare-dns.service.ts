import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

export interface CloudflareDNSRecord {
  id?: string;
  type: string;
  name: string;
  content: string;
  ttl?: number;
  priority?: number;
  proxied?: boolean;
}

export interface CloudflareZone {
  id: string;
  name: string;
  status: string;
}

interface CloudflareError {
  code: number;
  message: string;
}

interface CloudflareAPIResponse<T> {
  result: T;
  success: boolean;
  errors: CloudflareError[];
  messages: any[];
}

@Injectable()
export class CloudflareDNSService {
  private readonly logger = new Logger(CloudflareDNSService.name);
  private readonly baseUrl = "https://api.cloudflare.com/client/v4";

  constructor(private readonly configService: ConfigService) {}

  /**
   * Get zone ID for a domain
   */
  async getZoneId(domain: string, apiToken: string): Promise<string | null> {
    try {
      this.logger.log(`Getting zone ID for domain: ${domain}`);

      const response = await fetch(`${this.baseUrl}/zones?name=${domain}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as CloudflareAPIResponse<CloudflareZone[]>;

      if (!response.ok) {
        throw new Error(
          `Cloudflare API error: ${data.errors?.[0]?.message || response.statusText}`,
        );
      }

      if (!data.result || data.result.length === 0) {
        return null;
      }

      const zone = data.result[0];
      this.logger.log(`Found zone ID for ${domain}: ${zone.id}`);
      return zone.id;
    } catch (error) {
      this.logger.error(`Failed to get zone ID for ${domain}:`, error);
      return null;
    }
  }

  /**
   * Add DNS record to Cloudflare
   */
  async addDNSRecord(
    zoneId: string,
    record: CloudflareDNSRecord,
    apiToken: string,
  ): Promise<string | null> {
    try {
      this.logger.log(`Adding DNS record to zone ${zoneId}: ${record.type} ${record.name}`);

      const payload = {
        type: record.type,
        name: record.name,
        content: record.content,
        ttl: record.ttl || 300,
        priority: record.priority,
        proxied: record.proxied || false,
      };

      const response = await fetch(`${this.baseUrl}/zones/${zoneId}/dns_records`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const data = (await response.json()) as CloudflareAPIResponse<CloudflareDNSRecord>;

      if (!response.ok) {
        throw new Error(
          `Cloudflare API error: ${data.errors?.[0]?.message || response.statusText}`,
        );
      }

      this.logger.log(`DNS record added successfully: ${data.result.id}`);
      return data.result.id || null;
    } catch (error) {
      this.logger.error(`Failed to add DNS record:`, error);
      return null;
    }
  }

  /**
   * Add multiple DNS records to Cloudflare
   */
  async addDNSRecords(
    zoneId: string,
    records: CloudflareDNSRecord[],
    apiToken: string,
  ): Promise<{
    successful: CloudflareDNSRecord[];
    failed: Array<{ record: CloudflareDNSRecord; error: string }>;
  }> {
    const successful: CloudflareDNSRecord[] = [];
    const failed: Array<{ record: CloudflareDNSRecord; error: string }> = [];

    for (const record of records) {
      try {
        const recordId = await this.addDNSRecord(zoneId, record, apiToken);
        if (recordId) {
          successful.push({ ...record, id: recordId });
        } else {
          failed.push({ record, error: "Failed to add record" });
        }
      } catch (error) {
        failed.push({ record, error: error.message });
      }
    }

    return { successful, failed };
  }

  /**
   * Check if DNS record exists
   */
  async dnsRecordExists(
    zoneId: string,
    record: CloudflareDNSRecord,
    apiToken: string,
  ): Promise<boolean> {
    try {
      const response = await fetch(
        `${this.baseUrl}/zones/${zoneId}/dns_records?type=${record.type}&name=${record.name}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${apiToken}`,
            "Content-Type": "application/json",
          },
        },
      );

      const data = (await response.json()) as CloudflareAPIResponse<CloudflareDNSRecord[]>;

      if (!response.ok) {
        return false;
      }

      // Check if any existing record matches
      return data.result.some(
        (existing: any) =>
          existing.type === record.type &&
          existing.name === record.name &&
          existing.content === record.content,
      );
    } catch (error) {
      this.logger.error(`Failed to check DNS record existence:`, error);
      return false;
    }
  }

  /**
   * Validate Cloudflare API token
   */
  async validateAPIToken(apiToken: string): Promise<{
    valid: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/user/tokens/verify`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiToken}`,
          "Content-Type": "application/json",
        },
      });

      const data = (await response.json()) as CloudflareAPIResponse<any>;

      if (!response.ok) {
        return {
          valid: false,
          error: data.errors?.[0]?.message || "Invalid API token",
        };
      }

      return {
        valid: true,
      };
    } catch (error) {
      this.logger.error("Cloudflare API token validation failed:", error);
      return {
        valid: false,
        error: error.message,
      };
    }
  }

  /**
   * Convert Resend DNS records to Cloudflare format
   */
  convertResendRecordsToCloudflare(
    resendRecords: Array<{
      record: string;
      name: string;
      type: string;
      value: string;
      priority?: number;
    }>,
  ): CloudflareDNSRecord[] {
    return resendRecords.map((record) => ({
      type: record.type,
      name: record.name,
      content: record.value,
      priority: record.priority,
      ttl: 300, // 5 minutes
      proxied: false, // Don't proxy verification records
    }));
  }
}
