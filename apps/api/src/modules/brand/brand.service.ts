import { BadRequestException, Injectable, NotFoundException, Logger, Inject } from '@nestjs/common';
import { getPaginationSummary } from '../../common/dto/pagination.dto';
import { IPaginatedData } from '../../common/interfaces';
import { BaseRepository } from '../../database/repositories/base.repository';
import { BRAND_REPO } from './brand.tokens';
import { CreateBrandDto } from './dtos/create-brand.dto';
import { UpdateBrandDto } from './dtos/update-brand.dto';
import { Brand } from './entities/brand.entity';
import { DnsVerificationService } from './services/dns-verification.service';
import { SESVerificationService } from './services/ses-verification.service';
import { ResendVerificationService } from './services/resend-verification.service';
import { CloudflareDNSService } from './services/cloudflare-dns.service';


@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(
    @Inject(BRAND_REPO)
    private readonly brandRepository: BaseRepository<Brand>,
    private readonly dnsVerificationService: DnsVerificationService,
    private readonly sesVerificationService: SESVerificationService,
    private readonly resendVerificationService: ResendVerificationService,
    private readonly cloudflareDNSService: CloudflareDNSService,
  ) { }

  async createBrand(
    tenantId: string,
    createDto: CreateBrandDto,
    createdById: string,
  ): Promise<Brand> {
    return this.brandRepository.create({
      ...createDto,
      tenant: {
        id: tenantId
      },
      ...(createdById && { createdBy: { id: createdById } }),
    });
  }

  async getBrands(
    tenantId: string,
    query?: any,
  ): Promise<IPaginatedData<Partial<Brand>>> {
    const page = query?.page || 1;
    const limit = query?.limit || 10;

    const queryBuilder = this.brandRepository
      .createQueryBuilder('brand')
      .select([
        'brand.id',
        'brand.name',
        'brand.description',
        'brand.domain',
        'brand.status',
        'brand.logo',
        'brand.primaryColor',
        'brand.secondaryColor',
        'brand.defaultFromEmail',
        'brand.defaultFromName',
      ])
      .where('brand.tenantId = :tenantId', { tenantId });

    // Apply filters
    if (query?.search) {
      queryBuilder.andWhere(
        '(brand.name ILIKE :search OR brand.description ILIKE :search)',
        { search: `%${query.search}%` }
      );
    }

    if (query?.status) {
      queryBuilder.andWhere('brand.status = :status', { status: query.status });
    }

    // Apply sorting
    const sortField = query?.sortBy || 'createdAt';
    const sortOrder = query?.sortOrder || 'DESC';
    queryBuilder.orderBy(`brand.${sortField}`, sortOrder);

    // Apply pagination
    queryBuilder.skip((page - 1) * limit).take(limit);

    const [brands, total] = await queryBuilder.getManyAndCount();

    // Transform to only include necessary fields
    const sanitizedBrands = brands.map((brand) => ({
      id: brand.id,
      name: brand.name,
      description: brand.description,
      domain: brand.domain,
      status: brand.status,
      logo: brand.logo,
      primaryColor: brand.primaryColor,
      secondaryColor: brand.secondaryColor,
      defaultFromEmail: brand.defaultFromEmail,
      defaultFromName: brand.defaultFromName,
      createdAt: brand.createdAt,
      updatedAt: brand.updatedAt,
    }));

    return getPaginationSummary(
      sanitizedBrands,
      total,
      { page, limit },
      'brands',
    );
  }

  async getBrandById(tenantId: string, id: string): Promise<Brand> {
    const brand = await this.brandRepository.findById(id, false, { tenant: { id: tenantId } });

    if (!brand) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return brand;
  }

  async updateBrand(
    tenantId: string,
    id: string,
    updateDto: UpdateBrandDto,
  ): Promise<Brand> {
    await this.getBrandById(tenantId, id); // Verify exists

    const updated = await this.brandRepository.update(id, updateDto);
    if (!updated) {
      throw new NotFoundException(`Brand with ID ${id} not found`);
    }

    return updated;
  }

  async removeBrand(tenantId: string, id: string): Promise<void> {
    await this.getBrandById(tenantId, id); // Verify exists
    await this.brandRepository.delete(id);
  }

  /**
   * Get SES domain verification instructions
   */
  async getSESDomainVerificationInstructions(
    tenantId: string,
    id: string,
    domain?: string,
  ): Promise<{
    domain: string;
    verificationToken: string;
    instructions: {
      recordType: string;
      name: string;
      value: string;
      description: string;
    };
    domainHealth?: {
      hasMX: boolean;
      hasA: boolean;
      hasAAAA: boolean;
    };
    sesStatus?: {
      configured: boolean;
      region?: string;
      error?: string;
    };
  }> {
    const brand = await this.getBrandById(tenantId, id);
    const targetDomain = domain || brand.domain;

    if (!targetDomain) {
      throw new BadRequestException('Domain must be specified either in the request or brand configuration');
    }

    // Validate SES configuration
    const sesStatus = await this.sesVerificationService.validateSESConfiguration();
    if (!sesStatus.configured) {
      throw new BadRequestException(`SES is not properly configured: ${sesStatus.error}`);
    }

    // Check if domain is already being verified or verified
    let verificationResult = await this.sesVerificationService.checkDomainVerificationStatus(targetDomain);
    
    // If domain is not in SES, start verification process
    if (verificationResult.status === 'NotStarted') {
      verificationResult = await this.sesVerificationService.startDomainVerification(targetDomain);
      
      if (!verificationResult.verificationToken) {
        throw new BadRequestException(`Failed to start SES domain verification: ${verificationResult.error}`);
      }

      // Save SES verification info to brand
      const updateData: Partial<Brand> = {
        domain: targetDomain,
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            primary: targetDomain,
            sesVerificationToken: verificationResult.verificationToken,
            sesVerificationStatus: verificationResult.status,
            lastSESVerificationAttempt: new Date(),
          },
        },
      };
      await this.brandRepository.update(id, updateData);
    }

    // Generate DNS instructions
    const instructions = this.sesVerificationService.generateDomainVerificationInstructions(
      targetDomain,
      verificationResult.verificationToken!
    );

    // Check domain health
    const domainHealth = await this.dnsVerificationService.checkDomainHealth(targetDomain);

    return {
      domain: targetDomain,
      verificationToken: verificationResult.verificationToken!,
      instructions: instructions.instructions,
      domainHealth,
      sesStatus,
    };
  }

  /**
   * Get domain verification instructions without attempting verification (legacy method)
   */
  async getDomainVerificationInstructions(
    tenantId: string,
    id: string,
    domain?: string,
  ): Promise<{
    domain: string;
    verificationToken: string;
    instructions: {
      recordType: string;
      name: string;
      value: string;
    };
    domainHealth?: {
      hasMX: boolean;
      hasA: boolean;
      hasAAAA: boolean;
    };
  }> {
    const brand = await this.getBrandById(tenantId, id);
    const targetDomain = domain || brand.domain;

    if (!targetDomain) {
      throw new BadRequestException('Domain must be specified either in the request or brand configuration');
    }

    // Generate or retrieve verification token
    let verificationToken = brand.whiteLabelConfig?.domains?.verificationToken;
    if (!verificationToken) {
      verificationToken = this.dnsVerificationService.generateVerificationToken(targetDomain, id);

      // Save the token to the brand
      const updateData: Partial<Brand> = {
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            verificationToken,
          },
        },
      };
      await this.brandRepository.update(id, updateData);
    }

    // Check domain health
    const domainHealth = await this.dnsVerificationService.checkDomainHealth(targetDomain);

    return {
      domain: targetDomain,
      verificationToken: verificationToken!,
      instructions: {
        recordType: 'TXT',
        name: `_verification.${targetDomain}`,
        value: verificationToken!,
      },
      domainHealth,
    };
  }

  /**
   * Verify domain with AWS SES
   */
  async verifySESDomain(
    tenantId: string,
    id: string,
    domain: string,
  ): Promise<Brand> {
    const brand = await this.getBrandById(tenantId, id);

    // Validate prerequisites for domain verification
    this.validateDomainVerificationPrerequisites(brand, domain);

    // Check SES verification status
    const verificationResult = await this.sesVerificationService.checkDomainVerificationStatus(domain);

    if (!verificationResult.verified) {
      // Update brand with current status
      const updateData: Partial<Brand> = {
        domain,
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            primary: domain,
            sesVerified: false,
            sesVerificationStatus: verificationResult.status,
            sesVerificationToken: verificationResult.verificationToken,
            lastSESVerificationAttempt: new Date(),
            sesVerificationError: verificationResult.error,
          },
        },
      };

      await this.brandRepository.update(id, updateData);

      throw new BadRequestException(
        `SES domain verification failed. Status: ${verificationResult.status}. ` +
        `Please add the following TXT record to your DNS:\n` +
        `Name: _amazonses.${domain}\n` +
        `Value: ${verificationResult.verificationToken}\n` +
        `Error: ${verificationResult.error || 'Domain not verified with SES'}`
      );
    }

    // Domain verified successfully with SES
    const updateData: Partial<Brand> = {
      domain,
      whiteLabelConfig: {
        ...brand.whiteLabelConfig,
        domains: {
          ...brand.whiteLabelConfig?.domains,
          primary: domain,
          sesVerified: true,
          sesVerifiedAt: new Date(),
          sesVerificationStatus: verificationResult.status,
          sesVerificationToken: verificationResult.verificationToken,
        },
      },
    };

    const updated = await this.brandRepository.update(id, updateData);
    return updated || brand;
  }

  /**
   * Setup DKIM with AWS SES
   */
  async setupSESDKIM(tenantId: string, id: string): Promise<{
    brand: Brand;
    dkimInstructions: {
      domain: string;
      instructions: Array<{
        recordType: string;
        name: string;
        value: string;
        description: string;
      }>;
    };
  }> {
    const brand = await this.getBrandById(tenantId, id);

    // Validate prerequisites
    this.validateEmailVerificationPrerequisites(brand, 'DKIM');

    // Check if domain is verified with SES first
    if (!brand.whiteLabelConfig?.domains?.sesVerified) {
      throw new BadRequestException(
        'Domain must be verified with SES before setting up DKIM. Please verify your domain first.'
      );
    }

    // Enable DKIM with SES
    const dkimResult = await this.sesVerificationService.enableDKIM(brand.domain!);

    if (!dkimResult.enabled || !dkimResult.dkimTokens) {
      throw new BadRequestException(
        `Failed to enable DKIM with SES: ${dkimResult.error}`
      );
    }

    // Update brand with DKIM info
    const updateData: Partial<Brand> = {
      whiteLabelConfig: {
        ...brand.whiteLabelConfig,
        dkim: {
          ...brand.whiteLabelConfig.dkim,
          sesEnabled: true,
          sesVerified: dkimResult.verified,
          sesDkimTokens: dkimResult.dkimTokens,
          lastSESDkimAttempt: new Date(),
        },
      },
    };

    const updated = await this.brandRepository.update(id, updateData);

    // Generate DKIM DNS instructions
    const dkimInstructions = this.sesVerificationService.generateDKIMInstructions(
      brand.domain!,
      dkimResult.dkimTokens
    );

    return {
      brand: updated || brand,
      dkimInstructions,
    };
  }

  /**
   * Check SES DKIM verification status
   */
  async checkSESDKIMStatus(tenantId: string, id: string): Promise<{
    brand: Brand;
    dkimStatus: {
      enabled: boolean;
      verified: boolean;
      dkimTokens?: string[];
      error?: string;
    };
  }> {
    const brand = await this.getBrandById(tenantId, id);

    if (!brand.domain) {
      throw new BadRequestException('Domain must be set before checking DKIM status');
    }

    // Check DKIM status with SES
    const dkimStatus = await this.sesVerificationService.checkDKIMStatus(brand.domain);

    // Update brand with current DKIM status
    if (dkimStatus.enabled) {
      const updateData: Partial<Brand> = {
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          dkim: {
            ...brand.whiteLabelConfig?.dkim,
            sesEnabled: dkimStatus.enabled,
            sesVerified: dkimStatus.verified,
            sesDkimTokens: dkimStatus.dkimTokens,
            ...(dkimStatus.verified && { sesVerifiedAt: new Date() }),
          },
        },
      };

      const updated = await this.brandRepository.update(id, updateData);
      return {
        brand: updated || brand,
        dkimStatus,
      };
    }

    return {
      brand,
      dkimStatus,
    };
  }

  /**
   * Check if domain can send emails through SES
   */
  async checkSESEmailCapability(tenantId: string, id: string): Promise<{
    canSend: boolean;
    reason?: string;
    verificationStatus?: string;
    dkimStatus?: {
      enabled: boolean;
      verified: boolean;
    };
    recommendations?: string[];
  }> {
    const brand = await this.getBrandById(tenantId, id);

    if (!brand.domain) {
      return {
        canSend: false,
        reason: 'No domain configured',
        recommendations: ['Set a domain in your brand configuration'],
      };
    }

    // Check SES email capability
    const emailCapability = await this.sesVerificationService.canSendEmails(brand.domain);
    
    if (!emailCapability.canSend) {
      return {
        canSend: false,
        reason: emailCapability.reason,
        verificationStatus: emailCapability.verificationStatus,
        recommendations: [
          'Verify your domain with SES',
          'Add the required TXT record to your DNS',
          'Wait for DNS propagation (up to 72 hours)',
        ],
      };
    }

    // Check DKIM status for better deliverability
    const dkimStatus = await this.sesVerificationService.checkDKIMStatus(brand.domain);
    
    const recommendations: string[] = [];
    if (!dkimStatus.enabled) {
      recommendations.push('Enable DKIM for better email deliverability');
    } else if (!dkimStatus.verified) {
      recommendations.push('Complete DKIM setup by adding CNAME records to DNS');
    }

    return {
      canSend: true,
      verificationStatus: emailCapability.verificationStatus,
      dkimStatus: {
        enabled: dkimStatus.enabled,
        verified: dkimStatus.verified,
      },
      recommendations: recommendations.length > 0 ? recommendations : ['Your domain is ready for sending emails!'],
    };
  }

  async verifyDomain(
    tenantId: string,
    id: string,
    domain: string,
    cloudflareApiToken?: string,
  ): Promise<Brand> {
    const brand = await this.getBrandById(tenantId, id);

    // Validate prerequisites for domain verification
    this.validateDomainVerificationPrerequisites(brand, domain);

    // Generate verification token if not already present
    let verificationToken = brand.whiteLabelConfig?.domains?.verificationToken;
    if (!verificationToken) {
      verificationToken = this.dnsVerificationService.generateVerificationToken(domain, id);
    }

    // If Cloudflare API token provided, attempt auto-setup
    let cloudflareSetupResult: any = null;
    if (cloudflareApiToken) {
      try {
        // Validate Cloudflare token
        const cfValidation = await this.cloudflareDNSService.validateAPIToken(cloudflareApiToken);
        if (!cfValidation.valid) {
          cloudflareSetupResult = {
            attempted: true,
            successful: false,
            error: `Invalid Cloudflare API token: ${cfValidation.error}`,
          };
        } else {
          // Get zone ID
          const zoneId = await this.cloudflareDNSService.getZoneId(domain, cloudflareApiToken);
          if (!zoneId) {
            cloudflareSetupResult = {
              attempted: true,
              successful: false,
              error: `Could not find Cloudflare zone for domain: ${domain}`,
            };
          } else {
            // Add the verification TXT record automatically
            const cfRecord = {
              type: 'TXT',
              name: `_verification.${domain}`,
              content: verificationToken,
              ttl: 300,
              proxied: false,
            };

            const recordId = await this.cloudflareDNSService.addDNSRecord(zoneId, cfRecord, cloudflareApiToken);
            if (recordId) {
              cloudflareSetupResult = {
                attempted: true,
                successful: true,
                recordId,
                message: 'DNS record added automatically via Cloudflare',
              };
            } else {
              cloudflareSetupResult = {
                attempted: true,
                successful: false,
                error: 'Failed to add DNS record to Cloudflare',
              };
            }
          }
        }
      } catch (error) {
        cloudflareSetupResult = {
          attempted: true,
          successful: false,
          error: `Cloudflare setup failed: ${error.message}`,
        };
      }
    }

    // Perform actual DNS verification
    const verificationResult = await this.dnsVerificationService.verifyDomainOwnership(
      domain,
      verificationToken,
    );

    if (!verificationResult.verified) {
      // Store the verification token and Cloudflare setup result
      const updateData: Partial<Brand> = {
        domain,
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            primary: domain,
            verified: false,
            verificationToken,
            lastVerificationAttempt: new Date(),
            verificationError: verificationResult.error,
            cloudflareAutoSetup: cloudflareSetupResult,
          },
        },
      };

      const updated = await this.brandRepository.update(id, updateData);

      let errorMessage = `Domain verification failed. `;
      if (cloudflareSetupResult?.successful) {
        errorMessage += `DNS record was added automatically, but verification is still pending. Please wait a few minutes for DNS propagation.\n`;
      } else {
        errorMessage += `Please add the following TXT record to your DNS:\n` +
        `Name: _verification.${domain}\n` +
        `Value: ${verificationToken}\n`;
      }
      errorMessage += `Error: ${verificationResult.error || 'Verification record not found'}`;

      throw new BadRequestException(errorMessage);
    }

    // Domain verified successfully
    const updateData: Partial<Brand> = {
      domain,
      whiteLabelConfig: {
        ...brand.whiteLabelConfig,
        domains: {
          ...brand.whiteLabelConfig?.domains,
          primary: domain,
          verified: true,
          verifiedAt: new Date(),
          verificationToken,
        },
      },
    };

    const updated = await this.brandRepository.update(id, updateData);
    return updated || brand;
  }

  async verifyDKIM(tenantId: string, id: string, selector: string = 'default', cloudflareApiToken?: string): Promise<Brand> {
    const brand = await this.getBrandById(tenantId, id);

    // Validate prerequisites for DKIM verification
    this.validateEmailVerificationPrerequisites(brand, 'DKIM');

    // Generate DKIM keys if not present
    let publicKey = brand.whiteLabelConfig?.dkim?.publicKey;
    let privateKey = brand.whiteLabelConfig?.dkim?.privateKey;

    if (!publicKey || !privateKey) {
      const keyPair = await this.dnsVerificationService.generateDKIMKeyPair();
      publicKey = keyPair.publicKey;
      privateKey = keyPair.privateKey;
    }

    // If Cloudflare API token provided, attempt auto-setup of DKIM record
    let cloudflareDkimSetupResult: any = null;
    if (cloudflareApiToken) {
      try {
        // Validate Cloudflare token
        const cfValidation = await this.cloudflareDNSService.validateAPIToken(cloudflareApiToken);
        if (!cfValidation.valid) {
          cloudflareDkimSetupResult = {
            attempted: true,
            successful: false,
            error: `Invalid Cloudflare API token: ${cfValidation.error}`,
          };
        } else {
          // Get zone ID
          const zoneId = await this.cloudflareDNSService.getZoneId(brand.domain!, cloudflareApiToken);
          if (!zoneId) {
            cloudflareDkimSetupResult = {
              attempted: true,
              successful: false,
              error: `Could not find Cloudflare zone for domain: ${brand.domain}`,
            };
          } else {
            // Add the DKIM CNAME record automatically
            const cfRecord = {
              type: 'CNAME',
              name: `${selector}._domainkey.${brand.domain}`,
              content: `${selector}._domainkey.${brand.domain}`, // This would be the actual DKIM record value
              ttl: 300,
              proxied: false,
            };

            const recordId = await this.cloudflareDNSService.addDNSRecord(zoneId, cfRecord, cloudflareApiToken);
            if (recordId) {
              cloudflareDkimSetupResult = {
                attempted: true,
                successful: true,
                recordId,
                selector,
                message: 'DKIM CNAME record added automatically via Cloudflare',
              };
            } else {
              cloudflareDkimSetupResult = {
                attempted: true,
                successful: false,
                error: 'Failed to add DKIM CNAME record to Cloudflare',
              };
            }
          }
        }
      } catch (error) {
        cloudflareDkimSetupResult = {
          attempted: true,
          successful: false,
          error: `Cloudflare DKIM setup failed: ${error.message}`,
        };
      }
    }

    // Perform actual DKIM verification
    const verificationResult = await this.dnsVerificationService.verifyDKIM(
      brand.domain!,
      selector,
    );

    if (!brand.whiteLabelConfig) {
      brand.whiteLabelConfig = {};
    }

    if (!brand.whiteLabelConfig.dkim) {
      brand.whiteLabelConfig.dkim = {};
    }

    if (!verificationResult.verified) {
      brand.whiteLabelConfig.dkim.verified = false;
      brand.whiteLabelConfig.dkim.selector = selector;
      brand.whiteLabelConfig.dkim.lastVerificationAttempt = new Date();
      brand.whiteLabelConfig.dkim.verificationError = verificationResult.error;
      brand.whiteLabelConfig.dkim.publicKey = publicKey;
      brand.whiteLabelConfig.dkim.privateKey = privateKey;
      brand.whiteLabelConfig.dkim.cloudflareAutoSetup = cloudflareDkimSetupResult;

      const updated = await this.brandRepository.update(id, brand);

      let errorMessage = `DKIM verification failed for selector "${selector}". `;
      if (cloudflareDkimSetupResult?.successful) {
        errorMessage += `DKIM record was added automatically, but verification is still pending. Please wait a few minutes for DNS propagation.\n`;
      } else {
        errorMessage += `Please add the DKIM DNS record:\n` +
        `Name: ${selector}._domainkey.${brand.domain}\n` +
        `Type: CNAME\n` +
        `Value: ${selector}._domainkey.${brand.domain}\n`;
      }
      errorMessage += `Error: ${verificationResult.error || 'DKIM record not found or invalid'}`;

      throw new BadRequestException(errorMessage);
    }

    // DKIM verified successfully
    brand.whiteLabelConfig.dkim.verified = true;
    brand.whiteLabelConfig.dkim.verifiedAt = new Date();
    brand.whiteLabelConfig.dkim.selector = selector;
    brand.whiteLabelConfig.dkim.publicKey = publicKey;
    brand.whiteLabelConfig.dkim.privateKey = privateKey;
    brand.whiteLabelConfig.dkim.cloudflareAutoSetup = cloudflareDkimSetupResult;

    const updated = await this.brandRepository.update(id, brand);
    return updated || brand;
  }

  async verifyDMARC(tenantId: string, id: string): Promise<Brand> {
    const brand = await this.getBrandById(tenantId, id);

    // Validate prerequisites for DMARC verification
    this.validateEmailVerificationPrerequisites(brand, 'DMARC');

    // DMARC requires domain verification first
    if (!brand.whiteLabelConfig?.domains?.verified) {
      throw new BadRequestException(
        'Domain must be verified before DMARC verification. Please verify your domain first.'
      );
    }

    // Perform actual DMARC verification
    const verificationResult = await this.dnsVerificationService.verifyDMARC(brand.domain!);

    if (!brand.whiteLabelConfig) {
      brand.whiteLabelConfig = {};
    }

    if (!brand.whiteLabelConfig.dmarc) {
      brand.whiteLabelConfig.dmarc = {};
    }

    if (!verificationResult.verified) {
      brand.whiteLabelConfig.dmarc.verified = false;
      brand.whiteLabelConfig.dmarc.lastVerificationAttempt = new Date();
      brand.whiteLabelConfig.dmarc.verificationError = verificationResult.error;

      const updated = await this.brandRepository.update(id, brand);

      throw new BadRequestException(
        `DMARC verification failed. Please ensure you have added the DMARC DNS record:\n` +
        `Name: _dmarc.${brand.domain}\n` +
        `Value: v=DMARC1; p=quarantine; rua=mailto:dmarc@${brand.domain}\n` +
        `Error: ${verificationResult.error || 'DMARC record not found or invalid'}`
      );
    }

    // DMARC verified successfully
    brand.whiteLabelConfig.dmarc.verified = true;
    brand.whiteLabelConfig.dmarc.verifiedAt = new Date();
    brand.whiteLabelConfig.dmarc.policy = verificationResult.policy;
    brand.whiteLabelConfig.dmarc.percentage = verificationResult.percentage;
    brand.whiteLabelConfig.dmarc.reportEmail = verificationResult.reportEmail;

    const updated = await this.brandRepository.update(id, brand);
    return updated || brand;
  }

  /**
   * Validates prerequisites for domain verification
   */
  private validateDomainVerificationPrerequisites(brand: Brand, domain: string): void {
    const missingFields: string[] = [];

    // Domain is required
    if (!domain && !brand.domain) {
      missingFields.push('domain');
    }

    // Default from email is required
    if (!brand.defaultFromEmail) {
      missingFields.push('defaultFromEmail');
    }

    // Default from name is required
    if (!brand.defaultFromName) {
      missingFields.push('defaultFromName');
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `Domain verifici am ation requires the following fields to be set: ${missingFields.join(', ')}. ` +
        'Please update your brand configuration before attempting domain verification.'
      );
    }

    // Validate that the email domain matches the domain being verified
    const emailDomain = brand.defaultFromEmail!.split('@')[1];
    const targetDomain = domain || brand.domain;

    if (emailDomain !== targetDomain) {
      throw new BadRequestException(
        `The default from email domain (${emailDomain}) must match the domain being verified (${targetDomain}). ` +
        'Please update your default from email or use a different domain.'
      );
    }
  }

  /**
   * Validates prerequisites for email verification (DKIM/DMARC)
   */
  private validateEmailVerificationPrerequisites(brand: Brand, verificationType: 'DKIM' | 'DMARC'): void {
    const missingFields: string[] = [];

    // Domain is required
    if (!brand.domain) {
      missingFields.push('domain');
    }

    // Default from email is required
    if (!brand.defaultFromEmail) {
      missingFields.push('defaultFromEmail');
    }

    // Default from name is required
    if (!brand.defaultFromName) {
      missingFields.push('defaultFromName');
    }

    if (missingFields.length > 0) {
      throw new BadRequestException(
        `${verificationType} verification requires the following fields to be set: ${missingFields.join(', ')}. ` +
        'Please update your brand configuration before attempting verification.'
      );
    }

    // Validate that the email domain matches the brand domain
    const emailDomain = brand.defaultFromEmail!.split('@')[1];

    if (emailDomain !== brand.domain) {
      throw new BadRequestException(
        `The default from email domain (${emailDomain}) must match the brand domain (${brand.domain}). ` +
        'Please update your default from email or domain configuration.'
      );
    }
  }

  /**
   * Get brand configuration for email sending (integrated branded email functionality)
   */
  async getBrandConfigForEmail(tenantId: string, brandId?: string): Promise<{
    brandConfig?: {
      defaultFromEmail?: string;
      defaultFromName?: string;
      domain?: string;
      verified?: boolean;
      dkimEnabled?: boolean;
    };
    canSend: boolean;
    reason?: string;
    recommendations?: string[];
  }> {
    try {
      // If no brand ID provided, try to find a default brand for the tenant
      if (!brandId) {
        const brands = await this.getBrands(tenantId, { limit: 1 });
        if (!brands.records || brands.records.length === 0) {
          return {
            canSend: true, // Can send with platform defaults
            reason: 'No brand configured, using platform defaults',
            recommendations: ['Configure a brand for better email branding'],
          };
        }
        brandId = brands.records[0].id;
      }

      // Get brand configuration
      const brand = await this.getBrandById(tenantId, brandId!);

      // Check if brand has email configuration
      if (!brand.defaultFromEmail || !brand.defaultFromName) {
        return {
          canSend: true, // Can send with platform defaults
          reason: 'Brand missing email configuration, using platform defaults',
          recommendations: [
            'Set defaultFromEmail in brand configuration',
            'Set defaultFromName in brand configuration',
          ],
        };
      }

      // Check if domain is verified with SES
      const isVerified = brand.whiteLabelConfig?.domains?.sesVerified || false;
      const isDkimEnabled = brand.whiteLabelConfig?.dkim?.sesEnabled || false;

      const brandConfig = {
        defaultFromEmail: brand.defaultFromEmail,
        defaultFromName: brand.defaultFromName,
        domain: brand.domain,
        verified: isVerified,
        dkimEnabled: isDkimEnabled,
      };

      if (!isVerified && brand.domain) {
        return {
          brandConfig,
          canSend: true, // Can send but with warnings
          reason: 'Domain not verified with SES',
          recommendations: [
            'Verify domain with SES for better deliverability',
            'Add required DNS records for domain verification',
          ],
        };
      }

      return {
        brandConfig,
        canSend: true,
        recommendations: isVerified 
          ? ['Brand is properly configured for email sending']
          : ['Consider verifying domain with SES for better deliverability'],
      };

    } catch (error) {
      this.logger.error(`Failed to get brand config for email: ${error.message}`, error);
      return {
        canSend: true, // Fallback to platform defaults
        reason: `Brand configuration error: ${error.message}`,
        recommendations: ['Using platform email defaults'],
      };
    }
  }

  /**
   * Get email sending recommendations for a brand
   */
  async getEmailRecommendations(tenantId: string, brandId: string): Promise<{
    status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
    score: number;
    recommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      action: string;
    }>;
  }> {
    try {
      const brand = await this.getBrandById(tenantId, brandId);
      const recommendations: Array<{
        priority: 'high' | 'medium' | 'low';
        title: string;
        description: string;
        action: string;
      }> = [];

      let score = 0;

      // Check basic configuration (30 points)
      if (brand.defaultFromEmail && brand.defaultFromName) {
        score += 30;
      } else {
        recommendations.push({
          priority: 'high',
          title: 'Complete Email Configuration',
          description: 'Set default from email and name for consistent branding',
          action: 'Update brand settings with defaultFromEmail and defaultFromName',
        });
      }

      // Check domain configuration (20 points)
      if (brand.domain) {
        score += 20;
      } else {
        recommendations.push({
          priority: 'high',
          title: 'Add Domain Configuration',
          description: 'Configure a custom domain for professional email sending',
          action: 'Set domain in brand configuration',
        });
      }

      // Check SES verification (30 points)
      const isVerified = brand.whiteLabelConfig?.domains?.sesVerified || false;
      if (isVerified) {
        score += 30;
      } else {
        recommendations.push({
          priority: 'high',
          title: 'Verify Domain with SES',
          description: 'Domain verification improves deliverability and reduces spam risk',
          action: 'Complete SES domain verification process',
        });
      }

      // Check DKIM (20 points)
      const isDkimEnabled = brand.whiteLabelConfig?.dkim?.sesEnabled || false;
      const isDkimVerified = brand.whiteLabelConfig?.dkim?.sesVerified || false;
      
      if (isDkimEnabled && isDkimVerified) {
        score += 20;
      } else if (isDkimEnabled && !isDkimVerified) {
        score += 10;
        recommendations.push({
          priority: 'medium',
          title: 'Complete DKIM Setup',
          description: 'DKIM is enabled but not verified. Add DNS records to complete setup',
          action: 'Add DKIM CNAME records to your DNS',
        });
      } else {
        recommendations.push({
          priority: 'medium',
          title: 'Enable DKIM Authentication',
          description: 'DKIM improves email authentication and deliverability',
          action: 'Enable DKIM in brand settings and add DNS records',
        });
      }

      // Determine status based on score
      let status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
      if (score >= 90) {
        status = 'excellent';
      } else if (score >= 70) {
        status = 'good';
      } else if (score >= 50) {
        status = 'needs_improvement';
      } else {
        status = 'poor';
      }

      return { status, score, recommendations };

    } catch (error) {
      this.logger.error(`Failed to get email recommendations: ${error.message}`, error);
      return {
        status: 'poor',
        score: 0,
        recommendations: [
          {
            priority: 'high',
            title: 'Fix Brand Configuration',
            description: 'Unable to analyze brand configuration due to an error',
            action: 'Check brand settings and try again',
          },
        ],
      };
    }
  }



  /**
   * Get push notification recommendations for a brand
   */
  async getPushRecommendations(tenantId: string, brandId: string): Promise<{
    status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
    score: number;
    recommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      action: string;
    }>;
  }> {
    try {
      const brand = await this.getBrandById(tenantId, brandId);
      const recommendations: Array<{
        priority: 'high' | 'medium' | 'low';
        title: string;
        description: string;
        action: string;
      }> = [];

      let score = 0;

      // Check brand name (20 points)
      if (brand.name) {
        score += 20;
      } else {
        recommendations.push({
          priority: 'high',
          title: 'Set Brand Name',
          description: 'Brand name will be used in push notification titles',
          action: 'Add brand name in brand settings',
        });
      }

      // Check brand colors (20 points)
      if (brand.primaryColor) {
        score += 20;
      } else {
        recommendations.push({
          priority: 'medium',
          title: 'Add Brand Colors',
          description: 'Brand colors will be used in Android push notifications',
          action: 'Set primary color in brand settings',
        });
      }

      // Check brand logo (20 points)
      if (brand.logo) {
        score += 20;
      } else {
        recommendations.push({
          priority: 'medium',
          title: 'Upload Brand Logo',
          description: 'Brand logo will be used as push notification icon',
          action: 'Upload logo in brand settings',
        });
      }

      // Check domain for deep linking (20 points)
      if (brand.domain) {
        score += 20;
      } else {
        recommendations.push({
          priority: 'low',
          title: 'Configure Domain',
          description: 'Domain enables branded deep linking in push notifications',
          action: 'Set domain in brand settings',
        });
      }

      // Check description for context (20 points)
      if (brand.description) {
        score += 20;
      } else {
        recommendations.push({
          priority: 'low',
          title: 'Add Brand Description',
          description: 'Description helps with push notification context',
          action: 'Add description in brand settings',
        });
      }

      // Determine status based on score
      let status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
      if (score >= 90) {
        status = 'excellent';
      } else if (score >= 70) {
        status = 'good';
      } else if (score >= 50) {
        status = 'needs_improvement';
      } else {
        status = 'poor';
      }

      return { status, score, recommendations };

    } catch (error) {
      this.logger.error(`Failed to get push recommendations: ${error.message}`, error);
      return {
        status: 'poor',
        score: 0,
        recommendations: [
          {
            priority: 'high',
            title: 'Fix Brand Configuration',
            description: 'Unable to analyze brand configuration due to an error',
            action: 'Check brand settings and try again',
          },
        ],
      };
    }
  }

  /**
   * Get brand configuration for push notifications
   */
  async getBrandConfigForPush(tenantId: string, brandId?: string): Promise<{
    brandConfig?: {
      name?: string;
      primaryColor?: string;
      logo?: string;
      domain?: string;
    };
    canSend: boolean;
    reason?: string;
    recommendations?: string[];
  }> {
    try {
      // If no brand ID provided, try to find a default brand for the tenant
      if (!brandId) {
        const brands = await this.getBrands(tenantId, { limit: 1 });
        if (!brands.records || brands.records.length === 0) {
          return {
            canSend: true, // Can send with platform defaults
            reason: 'No brand configured, using platform defaults',
            recommendations: ['Configure a brand for better push notification branding'],
          };
        }
        brandId = brands.records[0].id;
      }

      // Get brand configuration
      const brand = await this.getBrandById(tenantId, brandId!);

      const brandConfig = {
        name: brand.name,
        primaryColor: brand.primaryColor,
        logo: brand.logo,
        domain: brand.domain,
      };

      const recommendations: string[] = [];
      
      if (!brand.name) {
        recommendations.push('Set brand name for better push notification titles');
      }
      
      if (!brand.primaryColor) {
        recommendations.push('Set primary color for Android push notification styling');
      }
      
      if (!brand.logo) {
        recommendations.push('Upload logo for push notification icons');
      }

      return {
        brandConfig,
        canSend: true,
        recommendations: recommendations.length > 0 ? recommendations : ['Brand is configured for push notifications'],
      };

    } catch (error) {
      this.logger.error(`Failed to get brand config for push: ${error.message}`, error);
      return {
        canSend: true, // Fallback to platform defaults
        reason: `Brand configuration error: ${error.message}`,
        recommendations: ['Using platform push notification defaults'],
      };
    }
  }

  /**
   * Get Resend domain verification instructions with Cloudflare DNS auto-setup
   */
  async getResendDomainVerificationInstructions(
    tenantId: string,
    id: string,
    domain?: string,
    resendApiKey?: string,
    cloudflareApiToken?: string,
  ): Promise<{
    domain: string;
    domainId?: string;
    instructions: {
      recordType: string;
      name: string;
      value: string;
      description: string;
      priority?: number;
    }[];
    cloudflareSetup?: {
      attempted: boolean;
      successful: boolean;
      recordsAdded: number;
      errors?: string[];
    };
    resendStatus?: {
      configured: boolean;
      error?: string;
    };
  }> {
    const brand = await this.getBrandById(tenantId, id);
    const targetDomain = domain || brand.domain;

    if (!targetDomain) {
      throw new BadRequestException('Domain must be specified either in the request or brand configuration');
    }

    if (!resendApiKey) {
      throw new BadRequestException('Resend API key is required');
    }

    // Validate Resend configuration
    const resendStatus = await this.resendVerificationService.validateResendConfiguration(resendApiKey);
    if (!resendStatus.configured) {
      throw new BadRequestException(`Resend is not properly configured: ${resendStatus.error}`);
    }

    // Check if domain is already being verified or verified
    let verificationResult = await this.resendVerificationService.checkDomainVerificationStatus(targetDomain, resendApiKey);

    // If domain is not in Resend, add it
    if (verificationResult.status === 'not_started') {
      verificationResult = await this.resendVerificationService.addDomain(targetDomain, resendApiKey);

      if (!verificationResult.dnsRecords || verificationResult.dnsRecords.length === 0) {
        throw new BadRequestException(`Failed to add domain to Resend: ${verificationResult.error}`);
      }

      // Save Resend domain info to brand
      const updateData: Partial<Brand> = {
        domain: targetDomain,
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            primary: targetDomain,
            resendDomainId: verificationResult.domainId,
            resendVerificationStatus: verificationResult.status,
            lastResendVerificationAttempt: new Date(),
          },
        },
      };
      await this.brandRepository.update(id, updateData);
    }

    // Generate DNS instructions
    const instructions = this.resendVerificationService.generateDomainVerificationInstructions(
      targetDomain,
      verificationResult.dnsRecords!
    );

    let cloudflareSetup: any = undefined;

    // If Cloudflare API token provided, attempt auto-setup
    if (cloudflareApiToken) {
      try {
        // Validate Cloudflare token
        const cfValidation = await this.cloudflareDNSService.validateAPIToken(cloudflareApiToken);
        if (!cfValidation.valid) {
          cloudflareSetup = {
            attempted: true,
            successful: false,
            recordsAdded: 0,
            errors: [`Invalid Cloudflare API token: ${cfValidation.error}`],
          };
        } else {
          // Get zone ID
          const zoneId = await this.cloudflareDNSService.getZoneId(targetDomain, cloudflareApiToken);
          if (!zoneId) {
            cloudflareSetup = {
              attempted: true,
              successful: false,
              recordsAdded: 0,
              errors: [`Could not find Cloudflare zone for domain: ${targetDomain}`],
            };
          } else {
            // Convert Resend records to Cloudflare format
            const cfRecords = this.cloudflareDNSService.convertResendRecordsToCloudflare(verificationResult.dnsRecords!);

            // Add DNS records
            const addResult = await this.cloudflareDNSService.addDNSRecords(zoneId, cfRecords, cloudflareApiToken);

            cloudflareSetup = {
              attempted: true,
              successful: addResult.failed.length === 0,
              recordsAdded: addResult.successful.length,
              errors: addResult.failed.map(f => `${f.record.name}: ${f.error}`),
            };
          }
        }
      } catch (error) {
        cloudflareSetup = {
          attempted: true,
          successful: false,
          recordsAdded: 0,
          errors: [`Cloudflare setup failed: ${error.message}`],
        };
      }
    }

    return {
      domain: targetDomain,
      domainId: verificationResult.domainId,
      instructions: instructions.instructions,
      cloudflareSetup,
      resendStatus,
    };
  }

  /**
   * Verify domain with Resend
   */
  async verifyResendDomain(
    tenantId: string,
    id: string,
    domain: string,
    resendApiKey: string,
  ): Promise<Brand> {
    const brand = await this.getBrandById(tenantId, id);

    // Validate prerequisites for domain verification
    this.validateDomainVerificationPrerequisites(brand, domain);

    // Check Resend verification status
    const verificationResult = await this.resendVerificationService.checkDomainVerificationStatus(domain, resendApiKey);

    if (!verificationResult.verified) {
      // Update brand with current status
      const updateData: Partial<Brand> = {
        domain,
        whiteLabelConfig: {
          ...brand.whiteLabelConfig,
          domains: {
            ...brand.whiteLabelConfig?.domains,
            primary: domain,
            resendVerified: false,
            resendVerificationStatus: verificationResult.status,
            resendDomainId: verificationResult.domainId,
            lastResendVerificationAttempt: new Date(),
            resendVerificationError: verificationResult.error,
          },
        },
      };

      await this.brandRepository.update(id, updateData);

      throw new BadRequestException(
        `Resend domain verification failed. Status: ${verificationResult.status}. ` +
        `Please ensure DNS records are properly configured. ` +
        `Error: ${verificationResult.error || 'Domain not verified with Resend'}`
      );
    }

    // Domain verified successfully with Resend
    const updateData: Partial<Brand> = {
      domain,
      whiteLabelConfig: {
        ...brand.whiteLabelConfig,
        domains: {
          ...brand.whiteLabelConfig?.domains,
          primary: domain,
          resendVerified: true,
          resendVerifiedAt: new Date(),
          resendVerificationStatus: verificationResult.status,
          resendDomainId: verificationResult.domainId,
        },
      },
    };

    const updated = await this.brandRepository.update(id, updateData);
    return updated || brand;
  }

  /**
   * Check if domain can send emails through Resend
   */
  async checkResendEmailCapability(
    tenantId: string,
    id: string,
    resendApiKey: string,
  ): Promise<{
    canSend: boolean;
    reason?: string;
    verificationStatus?: string;
    recommendations?: string[];
  }> {
    const brand = await this.getBrandById(tenantId, id);

    if (!brand.domain) {
      return {
        canSend: false,
        reason: 'No domain configured',
        recommendations: ['Set a domain in your brand configuration'],
      };
    }

    // Check Resend email capability
    const emailCapability = await this.resendVerificationService.canSendEmails(brand.domain, resendApiKey);

    if (!emailCapability.canSend) {
      return {
        canSend: false,
        reason: emailCapability.reason,
        verificationStatus: emailCapability.verificationStatus,
        recommendations: [
          'Verify your domain with Resend',
          'Add the required DNS records to your DNS provider',
          'Wait for DNS propagation (up to 72 hours)',
          'Consider using Cloudflare DNS auto-setup for easier configuration',
        ],
      };
    }

    return {
      canSend: true,
      verificationStatus: emailCapability.verificationStatus,
      recommendations: ['Your domain is ready for sending emails through Resend!'],
    };
  }

  /**
   * Get Resend email setup recommendations for a brand
   */
  async getResendEmailRecommendations(
    tenantId: string,
    brandId: string,
    resendApiKey?: string,
  ): Promise<{
    status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
    score: number;
    recommendations: Array<{
      priority: 'high' | 'medium' | 'low';
      title: string;
      description: string;
      action: string;
    }>;
  }> {
    try {
      const brand = await this.getBrandById(tenantId, brandId);
      const recommendations: Array<{
        priority: 'high' | 'medium' | 'low';
        title: string;
        description: string;
        action: string;
      }> = [];

      let score = 0;

      // Check basic configuration (30 points)
      if (brand.defaultFromEmail && brand.defaultFromName) {
        score += 30;
      } else {
        recommendations.push({
          priority: 'high',
          title: 'Complete Email Configuration',
          description: 'Set default from email and name for consistent branding',
          action: 'Update brand settings with defaultFromEmail and defaultFromName',
        });
      }

      // Check domain configuration (20 points)
      if (brand.domain) {
        score += 20;
      } else {
        recommendations.push({
          priority: 'high',
          title: 'Add Domain Configuration',
          description: 'Configure a custom domain for professional email sending',
          action: 'Set domain in brand configuration',
        });
      }

      // Check Resend API key (10 points)
      if (resendApiKey) {
        score += 10;
      } else {
        recommendations.push({
          priority: 'high',
          title: 'Provide Resend API Key',
          description: 'API key is required for Resend domain verification',
          action: 'Include resendApiKey in the request',
        });
      }

      // Check Resend verification (30 points)
      if (resendApiKey && brand.domain) {
        try {
          const verificationResult = await this.resendVerificationService.checkDomainVerificationStatus(brand.domain, resendApiKey);
          if (verificationResult.verified) {
            score += 30;
          } else {
            recommendations.push({
              priority: 'high',
              title: 'Verify Domain with Resend',
              description: 'Domain verification improves deliverability and enables branded sending',
              action: 'Complete Resend domain verification process',
            });
          }
        } catch (error) {
          recommendations.push({
            priority: 'high',
            title: 'Check Resend Configuration',
            description: 'Unable to verify domain status with Resend',
            action: 'Verify your Resend API key and domain configuration',
          });
        }
      }

      // Determine status based on score
      let status: 'excellent' | 'good' | 'needs_improvement' | 'poor';
      if (score >= 90) {
        status = 'excellent';
      } else if (score >= 70) {
        status = 'good';
      } else if (score >= 50) {
        status = 'needs_improvement';
      } else {
        status = 'poor';
      }

      return { status, score, recommendations };

    } catch (error) {
      this.logger.error(`Failed to get Resend email recommendations: ${error.message}`, error);
      return {
        status: 'poor',
        score: 0,
        recommendations: [
          {
            priority: 'high',
            title: 'Fix Brand Configuration',
            description: 'Unable to analyze brand configuration due to an error',
            action: 'Check brand settings and try again',
          },
        ],
      };
    }
  }
}
