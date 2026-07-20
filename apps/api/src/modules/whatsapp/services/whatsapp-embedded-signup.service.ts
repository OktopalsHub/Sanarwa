import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { WABAConfig } from '../entities/waba-config.entity';
import { TenantWABAConfig } from '../entities/tenant-waba-config.entity';

export interface EmbeddedSignupRequest {
  tenantId: string;
  businessName: string;
  businessEmail: string;
  businessPhone: string;
  businessWebsite?: string;
  businessDescription?: string;
  redirectUri: string;
}

export interface EmbeddedSignupResponse {
  signupUrl: string;
  state: string;
  expiresAt: Date;
}

export interface WABASetupResult {
  wabaId: string;
  businessAccountId: string;
  phoneNumberId: string;
  accessToken: string;
  status: 'PENDING' | 'ACTIVE';
  verificationRequired: boolean;
}

@Injectable()
export class WhatsAppEmbeddedSignupService {
  private readonly logger = new Logger(WhatsAppEmbeddedSignupService.name);
  private readonly metaApiUrl = 'https://graph.facebook.com/v18.0';

  constructor(
    @InjectRepository(WABAConfig)
    private wabaConfigRepository: Repository<WABAConfig>,
    @InjectRepository(TenantWABAConfig)
    private tenantWabaConfigRepository: Repository<TenantWABAConfig>,
    private configService: ConfigService,
  ) { }

  /**
   * Generate Embedded Signup URL for tenant to create their own WABA
   * This is the key to avoiding the 6,000 template limit per WABA
   */
  async generateEmbeddedSignupUrl(request: EmbeddedSignupRequest): Promise<EmbeddedSignupResponse> {
    try {
      // Check if tenant already has a WABA
      const existingConfig = await this.tenantWabaConfigRepository.findOne({
        where: { tenantId: request.tenantId, isActive: true },
      });

      if (existingConfig) {
        throw new ConflictException('Tenant already has an active WhatsApp Business Account');
      }

      const appId = this.configService.get<string>('META_APP_ID');
      const configId = this.configService.get<string>('META_CONFIG_ID');

      if (!appId || !configId) {
        throw new BadRequestException('Meta app configuration is missing. Please configure META_APP_ID and META_CONFIG_ID.');
      }

      const state = this.generateSecureState(request.tenantId);

      // Meta Embedded Signup URL
      const signupUrl = new URL(`${this.metaApiUrl}/${appId}/embedded_signup`);
      signupUrl.searchParams.set('config_id', configId);
      signupUrl.searchParams.set('state', state);
      signupUrl.searchParams.set('redirect_uri', request.redirectUri);
      signupUrl.searchParams.set('response_type', 'code');

      // Store signup state for verification
      await this.storeSignupState(state, request);

      return {
        signupUrl: signupUrl.toString(),
        state,
        expiresAt: new Date(Date.now() + 30 * 60 * 1000), // 30 minutes
      };
    } catch (error) {
      this.logger.error('Failed to generate embedded signup URL', error);
      throw error;
    }
  }

  /**
   * Complete the embedded signup process after tenant authorizes
   */
  async completeEmbeddedSignup(code: string, state: string): Promise<WABASetupResult> {
    try {
      // Verify state and get tenant info
      const signupData = await this.verifySignupState(state);
      if (!signupData) {
        throw new BadRequestException('Invalid or expired signup state');
      }

      // Exchange code for access token
      const tokenResponse = await this.exchangeCodeForToken(code);

      // Get WABA details
      const wabaDetails = await this.getWABADetails(tokenResponse.access_token);

      // Create WABA config
      const wabaConfig = await this.createWABAConfig({
        tenantId: signupData.tenantId,
        businessAccountId: wabaDetails.id,
        accessToken: tokenResponse.access_token,
        phoneNumberId: wabaDetails.phone_number_id,
        isByop: false, // Platform-managed via ESU
        metadata: {
          displayName: wabaDetails.name,
          phoneNumber: wabaDetails.display_phone_number,
          verificationStatus: wabaDetails.verification_status,
          businessProfile: wabaDetails.business_profile,
        },
      });

      // Create tenant WABA config
      await this.createTenantWABAConfig({
        tenantId: signupData.tenantId,
        wabaId: wabaConfig.id,
        accessToken: tokenResponse.access_token,
        phoneNumberId: wabaDetails.phone_number_id,
        status: wabaDetails.verification_status === 'VERIFIED' ? 'ACTIVE' : 'PENDING',
        verificationStatus: wabaDetails.verification_status,
      });

      this.logger.log(`Created WABA for tenant ${signupData.tenantId}: ${wabaConfig.id}`);

      return {
        wabaId: wabaConfig.id,
        businessAccountId: wabaDetails.id,
        phoneNumberId: wabaDetails.phone_number_id,
        accessToken: tokenResponse.access_token,
        status: wabaDetails.verification_status === 'VERIFIED' ? 'ACTIVE' : 'PENDING',
        verificationRequired: wabaDetails.verification_status !== 'VERIFIED',
      };
    } catch (error) {
      this.logger.error('Failed to complete embedded signup', error);
      throw error;
    }
  }

  /**
   * Get tenant's WABA configuration
   */
  async getTenantWABA(tenantId: string): Promise<TenantWABAConfig | null> {
    return this.tenantWabaConfigRepository.findOne({
      where: { tenantId, isActive: true },
      relations: ['waba'],
    });
  }

  /**
   * Check if tenant can create more templates
   */
  async canCreateTemplate(tenantId: string): Promise<boolean> {
    const tenantWaba = await this.getTenantWABA(tenantId);
    if (!tenantWaba) return false;

    return tenantWaba.waba.canCreateTemplate();
  }

  /**
   * Get tenant's template usage
   */
  async getTemplateUsage(tenantId: string): Promise<{
    used: number;
    limit: number;
    remaining: number;
    utilizationRate: number;
  }> {
    const tenantWaba = await this.getTenantWABA(tenantId);
    if (!tenantWaba) {
      return { used: 0, limit: 0, remaining: 0, utilizationRate: 0 };
    }

    const used = tenantWaba.waba.templateCount;
    const limit = tenantWaba.waba.maxTemplates;
    const remaining = limit - used;
    const utilizationRate = (used / limit) * 100;

    return { used, limit, remaining, utilizationRate };
  }

  /**
   * Sync WABA status with Meta
   */
  async syncWABAStatus(tenantId: string): Promise<void> {
    const tenantWaba = await this.getTenantWABA(tenantId);
    if (!tenantWaba) return;

    try {
      const wabaDetails = await this.getWABADetails(tenantWaba.waba.accessToken);

      // Update WABA config
      await this.wabaConfigRepository.update(tenantWaba.waba.id, {
        metadata: {
          ...tenantWaba.waba.metadata,
          verificationStatus: wabaDetails.verification_status,
          businessProfile: wabaDetails.business_profile,
        },
        lastUsedAt: new Date(),
      });

      // Update tenant config
      await this.tenantWabaConfigRepository.update(tenantWaba.id, {
        verificationStatus: wabaDetails.verification_status,
        status: wabaDetails.verification_status === 'VERIFIED' ? 'ACTIVE' : 'PENDING',
        lastSyncAt: new Date(),
      });

      this.logger.log(`Synced WABA status for tenant ${tenantId}`);
    } catch (error) {
      this.logger.error(`Failed to sync WABA status for tenant ${tenantId}`, error);
    }
  }

  private async exchangeCodeForToken(code: string): Promise<{ access_token: string }> {
    const appId = this.configService.get<string>('META_APP_ID');
    const appSecret = this.configService.get<string>('META_APP_SECRET');

    const response = await axios.post(`${this.metaApiUrl}/oauth/access_token`, {
      client_id: appId,
      client_secret: appSecret,
      code,
    });

    return response.data;
  }

  private async getWABADetails(accessToken: string): Promise<any> {
    const response = await axios.get(`${this.metaApiUrl}/me`, {
      params: {
        fields: 'id,name,phone_numbers,business_profile,verification_status',
        access_token: accessToken,
      },
    });

    const data = response.data;
    const phoneNumber = data.phone_numbers?.data?.[0];

    return {
      id: data.id,
      name: data.name,
      phone_number_id: phoneNumber?.id,
      display_phone_number: phoneNumber?.display_phone_number,
      verification_status: data.verification_status || 'UNVERIFIED',
      business_profile: data.business_profile,
    };
  }

  private async createWABAConfig(data: {
    tenantId: string;
    businessAccountId: string;
    accessToken: string;
    phoneNumberId: string;
    isByop: boolean;
    metadata: any;
  }): Promise<WABAConfig> {
    const wabaConfig = this.wabaConfigRepository.create({
      tenantId: data.tenantId,
      businessAccountId: data.businessAccountId,
      accessToken: data.accessToken,
      phoneNumberId: data.phoneNumberId,
      webhookVerifyToken: this.generateWebhookToken(),
      isByop: data.isByop,
      metadata: data.metadata,
    });

    return this.wabaConfigRepository.save(wabaConfig);
  }

  private async createTenantWABAConfig(data: {
    tenantId: string;
    wabaId: string;
    accessToken: string;
    phoneNumberId: string;
    status: string;
    verificationStatus: string;
  }): Promise<TenantWABAConfig> {
    const tenantConfig = this.tenantWabaConfigRepository.create({
      tenantId: data.tenantId,
      wabaId: data.wabaId,
      accessToken: data.accessToken,
      phoneNumberId: data.phoneNumberId,
      status: data.status as any,
      verificationStatus: data.verificationStatus as any,
      usage: {
        messagesSent: 0,
        templatesUsed: 0,
        totalCost: 0,
      },
    });

    return this.tenantWabaConfigRepository.save(tenantConfig);
  }

  private generateSecureState(tenantId: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2);
    return Buffer.from(`${tenantId}:${timestamp}:${random}`).toString('base64');
  }

  private generateWebhookToken(): string {
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
  }

  private async storeSignupState(state: string, request: EmbeddedSignupRequest): Promise<void> {
    // Store in Redis or database for verification
    // Implementation depends on your caching strategy
    // For now, we'll use a simple in-memory store (not production-ready)
    this.signupStates.set(state, {
      ...request,
      createdAt: new Date(),
    });
  }

  private async verifySignupState(state: string): Promise<EmbeddedSignupRequest | null> {
    const data = this.signupStates.get(state);
    if (!data) return null;

    // Check if expired (30 minutes)
    const isExpired = Date.now() - data.createdAt.getTime() > 30 * 60 * 1000;
    if (isExpired) {
      this.signupStates.delete(state);
      return null;
    }

    return data;
  }

  // Temporary in-memory store (use Redis in production)
  private signupStates = new Map<string, EmbeddedSignupRequest & { createdAt: Date }>();
}