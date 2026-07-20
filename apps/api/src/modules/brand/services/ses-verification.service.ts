import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SESClient,
  VerifyDomainIdentityCommand,
  GetIdentityVerificationAttributesCommand,
  GetIdentityDkimAttributesCommand,
  VerifyDomainDkimCommand,
  DeleteIdentityCommand,
  ListIdentitiesCommand,
  GetIdentityPoliciesCommand,
  PutIdentityPolicyCommand,
} from '@aws-sdk/client-ses';

export interface SESVerificationResult {
  verified: boolean;
  verificationToken?: string;
  dkimTokens?: string[];
  error?: string;
  status?: 'Pending' | 'Success' | 'Failed' | 'TemporaryFailure' | 'NotStarted';
}

export interface SESDKIMResult {
  enabled: boolean;
  verified: boolean;
  dkimTokens?: string[];
  error?: string;
}

export interface SESIdentityInfo {
  identity: string;
  type: 'Domain' | 'EmailAddress';
  verificationStatus: string;
  dkimEnabled: boolean;
  dkimVerified: boolean;
  dkimTokens?: string[];
}

@Injectable()
export class SESVerificationService {
  private readonly logger = new Logger(SESVerificationService.name);
  private readonly sesClient: SESClient;

  constructor(private readonly configService: ConfigService) {
    const awsRegion = this.configService.get<string>('AWS_REGION') || 'us-east-1';
    const awsAccessKeyId = this.configService.get<string>('AWS_ACCESS_KEY_ID');
    const awsSecretAccessKey = this.configService.get<string>('AWS_SECRET_ACCESS_KEY');

    if (!awsAccessKeyId || !awsSecretAccessKey) {
      this.logger.warn('AWS credentials not configured. SES client will use default credential chain.');
      this.sesClient = new SESClient({ region: awsRegion });
    } else {
      this.sesClient = new SESClient({
        region: awsRegion,
        credentials: {
          accessKeyId: awsAccessKeyId,
          secretAccessKey: awsSecretAccessKey,
        },
      });
    }
  }

  /**
   * Start domain verification process with AWS SES
   * Returns verification token that user needs to add to DNS
   */
  async startDomainVerification(domain: string): Promise<SESVerificationResult> {
    try {
      this.logger.log(`Starting SES domain verification for: ${domain}`);

      const command = new VerifyDomainIdentityCommand({
        Domain: domain,
      });

      const response = await this.sesClient.send(command);

      this.logger.log(`SES domain verification started for ${domain}, token: ${response.VerificationToken}`);

      return {
        verified: false, // Verification is pending
        verificationToken: response.VerificationToken,
        status: 'Pending',
      };
    } catch (error) {
      this.logger.error(`Failed to start SES domain verification for ${domain}:`, error);
      return {
        verified: false,
        error: error.message,
        status: 'Failed',
      };
    }
  }

  /**
   * Check domain verification status with AWS SES
   */
  async checkDomainVerificationStatus(domain: string): Promise<SESVerificationResult> {
    try {
      this.logger.log(`Checking SES domain verification status for: ${domain}`);

      const command = new GetIdentityVerificationAttributesCommand({
        Identities: [domain],
      });

      const response = await this.sesClient.send(command);
      const attributes = response.VerificationAttributes?.[domain];

      if (!attributes) {
        return {
          verified: false,
          error: 'Domain not found in SES identities',
          status: 'NotStarted',
        };
      }

      const isVerified = attributes.VerificationStatus === 'Success';

      this.logger.log(`SES domain verification status for ${domain}: ${attributes.VerificationStatus}`);

      return {
        verified: isVerified,
        verificationToken: attributes.VerificationToken,
        status: attributes.VerificationStatus as any,
      };
    } catch (error) {
      this.logger.error(`Failed to check SES domain verification status for ${domain}:`, error);
      return {
        verified: false,
        error: error.message,
        status: 'Failed',
      };
    }
  }

  /**
   * Enable DKIM for a verified domain
   */
  async enableDKIM(domain: string): Promise<SESDKIMResult> {
    try {
      this.logger.log(`Enabling DKIM for domain: ${domain}`);

      // Use VerifyDomainDkimCommand to enable DKIM and get tokens
      const command = new VerifyDomainDkimCommand({
        Domain: domain,
      });

      const response = await this.sesClient.send(command);

      this.logger.log(`DKIM enabled for ${domain}, tokens: ${response.DkimTokens?.length || 0}`);

      return {
        enabled: true,
        verified: false, // Will be verified after DNS records are added
        dkimTokens: response.DkimTokens,
      };
    } catch (error) {
      this.logger.error(`Failed to enable DKIM for ${domain}:`, error);
      return {
        enabled: false,
        verified: false,
        error: error.message,
      };
    }
  }

  /**
   * Check DKIM status for a domain
   */
  async checkDKIMStatus(domain: string): Promise<SESDKIMResult> {
    try {
      this.logger.log(`Checking DKIM status for domain: ${domain}`);

      const command = new GetIdentityDkimAttributesCommand({
        Identities: [domain],
      });

      const response = await this.sesClient.send(command);
      const dkimAttributes = response.DkimAttributes?.[domain];

      if (!dkimAttributes) {
        return {
          enabled: false,
          verified: false,
          error: 'Domain not found or DKIM not configured',
        };
      }

      return {
        enabled: dkimAttributes.DkimEnabled || false,
        verified: dkimAttributes.DkimVerificationStatus === 'Success',
        dkimTokens: dkimAttributes.DkimTokens,
      };
    } catch (error) {
      this.logger.error(`Failed to check DKIM status for ${domain}:`, error);
      return {
        enabled: false,
        verified: false,
        error: error.message,
      };
    }
  }

  /**
   * Verify domain DKIM by checking DNS records
   */
  async verifyDomainDKIM(domain: string): Promise<SESDKIMResult> {
    try {
      this.logger.log(`Verifying DKIM for domain: ${domain}`);

      const command = new VerifyDomainDkimCommand({
        Domain: domain,
      });

      const response = await this.sesClient.send(command);

      this.logger.log(`DKIM verification initiated for ${domain}, tokens: ${response.DkimTokens?.length || 0}`);

      return {
        enabled: true,
        verified: false, // Verification is pending
        dkimTokens: response.DkimTokens,
      };
    } catch (error) {
      this.logger.error(`Failed to verify DKIM for ${domain}:`, error);
      return {
        enabled: false,
        verified: false,
        error: error.message,
      };
    }
  }

  /**
   * Get all verified identities (domains and email addresses)
   */
  async getVerifiedIdentities(): Promise<SESIdentityInfo[]> {
    try {
      this.logger.log('Retrieving all SES verified identities');

      const listCommand = new ListIdentitiesCommand({});
      const listResponse = await this.sesClient.send(listCommand);

      if (!listResponse.Identities || listResponse.Identities.length === 0) {
        return [];
      }

      // Get verification attributes for all identities
      const verificationCommand = new GetIdentityVerificationAttributesCommand({
        Identities: listResponse.Identities,
      });

      const verificationResponse = await this.sesClient.send(verificationCommand);

      // Get DKIM attributes for all identities
      const dkimCommand = new GetIdentityDkimAttributesCommand({
        Identities: listResponse.Identities,
      });

      const dkimResponse = await this.sesClient.send(dkimCommand);

      const identities: SESIdentityInfo[] = listResponse.Identities.map((identity) => {
        const verificationAttrs = verificationResponse.VerificationAttributes?.[identity];
        const dkimAttrs = dkimResponse.DkimAttributes?.[identity];

        return {
          identity,
          type: identity.includes('@') ? 'EmailAddress' : 'Domain',
          verificationStatus: verificationAttrs?.VerificationStatus || 'NotStarted',
          dkimEnabled: dkimAttrs?.DkimEnabled || false,
          dkimVerified: dkimAttrs?.DkimVerificationStatus === 'Success',
          dkimTokens: dkimAttrs?.DkimTokens,
        };
      });

      this.logger.log(`Retrieved ${identities.length} SES identities`);
      return identities;
    } catch (error) {
      this.logger.error('Failed to retrieve SES identities:', error);
      return [];
    }
  }

  /**
   * Remove domain from SES (cleanup)
   */
  async removeDomain(domain: string): Promise<boolean> {
    try {
      this.logger.log(`Removing domain from SES: ${domain}`);

      const command = new DeleteIdentityCommand({
        Identity: domain,
      });

      await this.sesClient.send(command);

      this.logger.log(`Successfully removed domain from SES: ${domain}`);
      return true;
    } catch (error) {
      this.logger.error(`Failed to remove domain from SES ${domain}:`, error);
      return false;
    }
  }

  /**
   * Generate DNS instructions for domain verification
   */
  generateDomainVerificationInstructions(domain: string, verificationToken: string): {
    domain: string;
    verificationToken: string;
    instructions: {
      recordType: string;
      name: string;
      value: string;
      description: string;
    };
  } {
    return {
      domain,
      verificationToken,
      instructions: {
        recordType: 'TXT',
        name: `_amazonses.${domain}`,
        value: verificationToken,
        description: 'Add this TXT record to your DNS to verify domain ownership with Amazon SES',
      },
    };
  }

  /**
   * Generate DNS instructions for DKIM setup
   */
  generateDKIMInstructions(domain: string, dkimTokens: string[]): {
    domain: string;
    instructions: Array<{
      recordType: string;
      name: string;
      value: string;
      description: string;
    }>;
  } {
    const instructions = dkimTokens.map((token, index) => ({
      recordType: 'CNAME',
      name: `${token}._domainkey.${domain}`,
      value: `${token}.dkim.amazonses.com`,
      description: `DKIM CNAME record ${index + 1} of ${dkimTokens.length}`,
    }));

    return {
      domain,
      instructions,
    };
  }

  /**
   * Validate that SES is properly configured
   */
  async validateSESConfiguration(): Promise<{
    configured: boolean;
    region?: string;
    error?: string;
  }> {
    try {
      // Try to list identities to test SES connectivity
      const command = new ListIdentitiesCommand({});
      await this.sesClient.send(command);

      return {
        configured: true,
        region: this.configService.get<string>('AWS_REGION') || 'us-east-1',
      };
    } catch (error) {
      this.logger.error('SES configuration validation failed:', error);
      return {
        configured: false,
        error: error.message,
      };
    }
  }

  /**
   * Check if domain can send emails (is verified and not in sandbox)
   */
  async canSendEmails(domain: string): Promise<{
    canSend: boolean;
    reason?: string;
    verificationStatus?: string;
  }> {
    try {
      const verificationResult = await this.checkDomainVerificationStatus(domain);

      if (!verificationResult.verified) {
        return {
          canSend: false,
          reason: 'Domain not verified with SES',
          verificationStatus: verificationResult.status,
        };
      }

      // Additional checks could be added here for sandbox mode, sending limits, etc.

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
}