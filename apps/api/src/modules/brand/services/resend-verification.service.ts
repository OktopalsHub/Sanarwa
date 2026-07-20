import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface ResendVerificationResult {
  verified: boolean;
  domainId?: string;
  dnsRecords?: Array<{
    record: string;
    name: string;
    type: string;
    value: string;
    priority?: number;
  }>;
  error?: string;
  status?: 'not_started' | 'pending' | 'verified' | 'failed';
}

export interface ResendDomainInfo {
  id: string;
  name: string;
  status: 'not_started' | 'pending' | 'verified' | 'failed';
  created_at: string;
  records: Array<{
    record: string;
    name: string;
    type: string;
    value: string;
    priority?: number;
  }>;
}

interface ResendError {
  message: string;
}

interface ResendCreateDomainResponse {
  id: string;
  records: Array<{
    record: string;
    name: string;
    type: string;
    value: string;
    priority?: number;
  }>;
}

interface ResendListDomainsResponse {
  data: ResendDomainInfo[];
}

@Injectable()
export class ResendVerificationService {
  private readonly logger = new Logger(ResendVerificationService.name);
  private readonly baseUrl = 'https://api.resend.com';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Add domain to Resend for verification
   */
  async addDomain(domain: string, apiKey: string): Promise<ResendVerificationResult> {
    try {
      this.logger.log(`Adding domain to Resend: ${domain}`);

      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name: domain }),
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ResendError;
        throw new Error(`Resend API error: ${errorData.message || response.statusText}`);
      }

      const successData = data as ResendCreateDomainResponse;

      this.logger.log(`Domain added to Resend: ${domain}, ID: ${successData.id}`);

      return {
        verified: false,
        domainId: successData.id,
        dnsRecords: successData.records || [],
        status: 'pending',
      };
    } catch (error) {
      this.logger.error(`Failed to add domain to Resend ${domain}:`, error);
      return {
        verified: false,
        error: error.message,
        status: 'failed',
      };
    }
  }

  /**
   * Check domain verification status with Resend
   */
  async checkDomainVerificationStatus(domain: string, apiKey: string): Promise<ResendVerificationResult> {
    try {
      this.logger.log(`Checking Resend domain verification status for: ${domain}`);

      // First get all domains
      const domainsResponse = await fetch(`${this.baseUrl}/domains`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const domainsData = await domainsResponse.json();

      if (!domainsResponse.ok) {
        const errorData = domainsData as ResendError;
        throw new Error(`Resend API error: ${errorData.message || domainsResponse.statusText}`);
      }

      const successData = domainsData as ResendListDomainsResponse;

      // Find the domain
      const domainInfo = successData.data?.find((d: ResendDomainInfo) => d.name === domain);

      if (!domainInfo) {
        return {
          verified: false,
          error: 'Domain not found in Resend',
          status: 'not_started',
        };
      }

      const isVerified = domainInfo.status === 'verified';

      this.logger.log(`Resend domain verification status for ${domain}: ${domainInfo.status}`);

      return {
        verified: isVerified,
        domainId: domainInfo.id,
        dnsRecords: domainInfo.records || [],
        status: domainInfo.status,
      };
    } catch (error) {
      this.logger.error(`Failed to check Resend domain verification status for ${domain}:`, error);
      return {
        verified: false,
        error: error.message,
        status: 'failed',
      };
    }
  }

  /**
   * Get domain details from Resend
   */
  async getDomainDetails(domainId: string, apiKey: string): Promise<ResendDomainInfo | null> {
    try {
      const response = await fetch(`${this.baseUrl}/domains/${domainId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      const data = await response.json();

      if (!response.ok) {
        const errorData = data as ResendError;
        throw new Error(`Resend API error: ${errorData.message || response.statusText}`);
      }

      return data as ResendDomainInfo;
    } catch (error) {
      this.logger.error(`Failed to get domain details for ${domainId}:`, error);
      return null;
    }
  }

  /**
   * Remove domain from Resend
   */
  async removeDomain(domainId: string, apiKey: string): Promise<boolean> {
    try {
      this.logger.log(`Removing domain from Resend: ${domainId}`);

      const response = await fetch(`${this.baseUrl}/domains/${domainId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        const data = await response.json();
        const errorData = data as ResendError;
        throw new Error(`Resend API error: ${errorData.message || response.statusText}`);
      }

      this.logger.log(`Successfully removed domain from Resend: ${domainId}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove domain from Resend ${domainId}:`, error);
      return false;
    }
  }

  /**
   * Validate Resend API key
   */
  async validateResendConfiguration(apiKey: string): Promise<{
    configured: boolean;
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}/domains`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      });

      if (!response.ok) {
        throw new Error(`API validation failed: ${response.statusText}`);
      }

      return {
        configured: true,
      };
    } catch (error) {
      this.logger.error('Resend configuration validation failed:', error);
      return {
        configured: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if domain can send emails through Resend
   */
  async canSendEmails(domain: string, apiKey: string): Promise<{
    canSend: boolean;
    reason?: string;
    verificationStatus?: string;
  }> {
    try {
      const verificationResult = await this.checkDomainVerificationStatus(domain, apiKey);

      if (!verificationResult.verified) {
        return {
          canSend: false,
          reason: 'Domain not verified with Resend',
          verificationStatus: verificationResult.status,
        };
      }

      return {
        canSend: true,
        verificationStatus: verificationResult.status,
      };
    } catch (error) {
      return {
        canSend: false,
        reason: `Error checking domain status: ${error.message}`,
      };
    }
  }

  /**
   * Generate DNS instructions for domain verification
   */
  generateDomainVerificationInstructions(domain: string, dnsRecords: Array<{
    record: string;
    name: string;
    type: string;
    value: string;
    priority?: number;
  }>): {
    domain: string;
    instructions: Array<{
      recordType: string;
      name: string;
      value: string;
      description: string;
      priority?: number;
    }>;
  } {
    const instructions = dnsRecords.map(record => ({
      recordType: record.type,
      name: record.name,
      value: record.value,
      description: `Add this ${record.type} record for Resend domain verification`,
      priority: record.priority,
    }));

    return {
      domain,
      instructions,
    };
  }
}