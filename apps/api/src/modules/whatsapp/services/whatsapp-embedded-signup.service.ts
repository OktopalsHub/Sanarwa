import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository } from "typeorm";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomBytes, timingSafeEqual } from "crypto";
import axios from "axios";
import { ChannelsService } from "../../channels/channels.service";
import { WABAConfig } from "../entities/waba-config.entity";
import { TenantWABAConfig } from "../entities/tenant-waba-config.entity";

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
  appId: string;
  configId: string;
  state: string;
  loginUrl: string;
  redirectUri: string;
  expiresAt: Date;
}

export interface CompleteSignupInput {
  code: string;
  state: string;
  wabaId?: string;
  phoneNumberId?: string;
}

export interface WABASetupResult {
  wabaId: string;
  businessAccountId: string;
  phoneNumberId: string;
  displayPhoneNumber?: string;
  status: "PENDING" | "ACTIVE";
  verificationRequired: boolean;
  connected: boolean;
}

const STATE_TTL_MS = 30 * 60 * 1000;

@Injectable()
export class WhatsAppEmbeddedSignupService {
  private readonly logger = new Logger(WhatsAppEmbeddedSignupService.name);

  constructor(
    @InjectRepository(WABAConfig)
    private wabaConfigRepository: Repository<WABAConfig>,
    @InjectRepository(TenantWABAConfig)
    private tenantWabaConfigRepository: Repository<TenantWABAConfig>,
    private configService: ConfigService,
    private channelsService: ChannelsService,
  ) {}

  async generateEmbeddedSignupUrl(request: EmbeddedSignupRequest): Promise<EmbeddedSignupResponse> {
    const existingConfig = await this.tenantWabaConfigRepository.findOne({
      where: { tenantId: request.tenantId, isActive: true },
    });

    if (existingConfig) {
      throw new ConflictException("Tenant already has an active WhatsApp Business Account");
    }

    const appId = this.requireSetting("META_APP_ID");
    const configId = this.requireSetting("META_CONFIG_ID");
    const state = this.signState(request.tenantId);

    const loginUrl = new URL(`https://www.facebook.com/${this.graphVersion()}/dialog/oauth`);
    loginUrl.searchParams.set("client_id", appId);
    loginUrl.searchParams.set("config_id", configId);
    loginUrl.searchParams.set("response_type", "code");
    loginUrl.searchParams.set("override_default_response_type", "true");
    loginUrl.searchParams.set("state", state);
    loginUrl.searchParams.set("redirect_uri", request.redirectUri);

    return {
      appId,
      configId,
      state,
      loginUrl: loginUrl.toString(),
      redirectUri: request.redirectUri,
      expiresAt: new Date(Date.now() + STATE_TTL_MS),
    };
  }

  async completeEmbeddedSignup(
    tenantId: string,
    memberId: string,
    input: CompleteSignupInput,
  ): Promise<WABASetupResult> {
    const stateTenantId = this.verifyState(input.state);
    if (stateTenantId !== tenantId) {
      throw new BadRequestException("Signup state does not belong to this tenant");
    }

    const accessToken = await this.exchangeCodeForToken(input.code);

    const wabaId = input.wabaId ?? (await this.resolveWabaId(accessToken));
    if (!wabaId) {
      throw new BadRequestException(
        "Meta did not return a WABA id. Re-run signup and keep the embedded signup session open.",
      );
    }

    const phoneNumberId =
      input.phoneNumberId ?? (await this.firstPhoneNumberId(wabaId, accessToken));
    if (!phoneNumberId) {
      throw new BadRequestException(
        "No phone number was attached to the WhatsApp Business Account. Add one in Meta Business Manager and retry.",
      );
    }

    const [wabaDetails, phoneDetails] = await Promise.all([
      this.fetchWaba(wabaId, accessToken),
      this.fetchPhone(phoneNumberId, accessToken),
    ]);

    const status = this.statusFor(wabaDetails.account_review_status);
    const verificationStatus = this.verificationFor(wabaDetails.account_review_status);

    const wabaConfig = await this.upsertWabaConfig({
      tenantId,
      businessAccountId: wabaId,
      accessToken,
      phoneNumberId,
      status,
      metadata: {
        displayName: wabaDetails.name,
        phoneNumber: phoneDetails.display_phone_number,
        verificationStatus,
        businessProfile: phoneDetails,
      },
    });

    await this.upsertTenantWabaConfig({
      tenantId,
      wabaId: wabaConfig.id,
      accessToken,
      phoneNumberId,
      status,
      verificationStatus,
    });

    await this.channelsService.upsert(tenantId, memberId, "whatsapp", {
      name: "WhatsApp Business",
      isActive: true,
      config: {
        accessToken,
        phoneNumberId,
        businessAccountId: wabaId,
        webhookVerifyToken: wabaConfig.webhookVerifyToken,
        appSecret: this.configService.get<string>("META_APP_SECRET"),
        apiVersion: this.graphVersion(),
      },
    });

    this.logger.log(`Connected WABA ${wabaId} for tenant ${tenantId}`);

    return {
      wabaId: wabaConfig.id,
      businessAccountId: wabaId,
      phoneNumberId,
      displayPhoneNumber: phoneDetails.display_phone_number,
      status,
      verificationRequired: verificationStatus !== "VERIFIED",
      connected: true,
    };
  }

  async getTenantWABA(tenantId: string): Promise<TenantWABAConfig | null> {
    return this.tenantWabaConfigRepository.findOne({
      where: { tenantId, isActive: true },
      relations: { waba: true },
    });
  }

  async canCreateTemplate(tenantId: string): Promise<boolean> {
    const tenantWaba = await this.getTenantWABA(tenantId);
    if (!tenantWaba) return false;

    return tenantWaba.waba.canCreateTemplate();
  }

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
    const utilizationRate = limit > 0 ? (used / limit) * 100 : 0;

    return { used, limit, remaining, utilizationRate };
  }

  async syncWABAStatus(tenantId: string, memberId: string): Promise<void> {
    const tenantWaba = await this.getTenantWABA(tenantId);
    if (!tenantWaba) {
      throw new BadRequestException("No WhatsApp Business Account is connected");
    }

    const accessToken = tenantWaba.accessToken ?? tenantWaba.waba.accessToken;
    const phoneNumberId = tenantWaba.phoneNumberId ?? tenantWaba.waba.phoneNumberId;

    const [wabaDetails, phoneDetails] = await Promise.all([
      this.fetchWaba(tenantWaba.waba.businessAccountId, accessToken),
      this.fetchPhone(phoneNumberId, accessToken),
    ]);

    const status = this.statusFor(wabaDetails.account_review_status);
    const verificationStatus = this.verificationFor(wabaDetails.account_review_status);

    await this.wabaConfigRepository.update(tenantWaba.waba.id, {
      accessToken,
      phoneNumberId,
      metadata: {
        ...tenantWaba.waba.metadata,
        displayName: wabaDetails.name,
        phoneNumber: phoneDetails.display_phone_number,
        verificationStatus,
        businessProfile: { ...phoneDetails },
      } as any,
      lastUsedAt: new Date(),
    });

    await this.tenantWabaConfigRepository.update(tenantWaba.id, {
      accessToken,
      phoneNumberId,
      verificationStatus,
      status,
      lastSyncAt: new Date(),
    });

    await this.channelsService.upsert(tenantId, memberId, "whatsapp", {
      name: "WhatsApp Business",
      isActive: true,
      config: {
        accessToken,
        phoneNumberId,
        businessAccountId: tenantWaba.waba.businessAccountId,
        webhookVerifyToken: tenantWaba.waba.webhookVerifyToken,
        appSecret: this.configService.get<string>("META_APP_SECRET"),
        apiVersion: this.graphVersion(),
      },
    });

    this.logger.log(`Synced WABA status for tenant ${tenantId}`);
  }

  async disconnect(tenantId: string): Promise<void> {
    const tenantWaba = await this.getTenantWABA(tenantId);
    if (tenantWaba) {
      await this.tenantWabaConfigRepository.update(tenantWaba.id, { isActive: false });
      await this.wabaConfigRepository.update(tenantWaba.waba.id, { isActive: false });
    }

    const connection = await this.channelsService.findConfig(tenantId, "whatsapp");
    if (connection) {
      await this.channelsService.remove(tenantId, "whatsapp");
    }
  }

  private async exchangeCodeForToken(code: string): Promise<string> {
    const appId = this.requireSetting("META_APP_ID");
    const appSecret = this.requireSetting("META_APP_SECRET");

    try {
      const shortLived = await axios.get(`${this.graphUrl()}/oauth/access_token`, {
        params: { client_id: appId, client_secret: appSecret, code },
      });

      const shortToken = shortLived.data?.access_token as string | undefined;
      if (!shortToken) {
        throw new BadRequestException("Meta did not return an access token");
      }

      const longLived = await axios.get(`${this.graphUrl()}/oauth/access_token`, {
        params: {
          grant_type: "fb_exchange_token",
          client_id: appId,
          client_secret: appSecret,
          fb_exchange_token: shortToken,
        },
      });

      return (longLived.data?.access_token as string | undefined) ?? shortToken;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new BadRequestException(
          `Meta rejected the signup code: ${this.metaError(error.response?.data)}`,
        );
      }
      throw error;
    }
  }

  private async resolveWabaId(accessToken: string): Promise<string | undefined> {
    try {
      const response = await axios.get(`${this.graphUrl()}/debug_token`, {
        params: { input_token: accessToken, access_token: accessToken },
      });
      const granularScopes = response.data?.data?.granular_scopes ?? [];
      for (const scope of granularScopes) {
        const targetIds = scope?.target_ids ?? [];
        if (scope?.scope?.includes("whatsapp_business_management") && targetIds.length > 0) {
          return String(targetIds[0]);
        }
      }
    } catch (error) {
      this.logger.warn(`Could not infer WABA id from the token: ${this.errorMessage(error)}`);
    }
    return undefined;
  }

  private async firstPhoneNumberId(
    wabaId: string,
    accessToken: string,
  ): Promise<string | undefined> {
    try {
      const response = await axios.get(`${this.graphUrl()}/${wabaId}/phone_numbers`, {
        params: { fields: "id,display_phone_number", access_token: accessToken },
      });
      const first = response.data?.data?.[0];
      return first?.id ? String(first.id) : undefined;
    } catch (error) {
      this.logger.warn(
        `Could not list phone numbers for WABA ${wabaId}: ${this.errorMessage(error)}`,
      );
      return undefined;
    }
  }

  private async fetchWaba(wabaId: string, accessToken: string): Promise<WabaDetails> {
    try {
      const response = await axios.get(`${this.graphUrl()}/${wabaId}`, {
        params: {
          fields: "id,name,currency,account_review_status,message_template_namespace",
          access_token: accessToken,
        },
      });
      return response.data;
    } catch (error) {
      throw new BadRequestException(
        `Could not read WhatsApp Business Account ${wabaId}: ${this.metaError(
          axios.isAxiosError(error) ? error.response?.data : undefined,
        )}`,
      );
    }
  }

  private async fetchPhone(phoneNumberId: string, accessToken: string): Promise<PhoneDetails> {
    try {
      const response = await axios.get(`${this.graphUrl()}/${phoneNumberId}`, {
        params: {
          fields: "id,display_phone_number,verified_name,quality_rating",
          access_token: accessToken,
        },
      });
      return response.data;
    } catch (error) {
      throw new BadRequestException(
        `Could not read WhatsApp phone number ${phoneNumberId}: ${this.metaError(
          axios.isAxiosError(error) ? error.response?.data : undefined,
        )}`,
      );
    }
  }

  private async upsertWabaConfig(data: {
    tenantId: string;
    businessAccountId: string;
    accessToken: string;
    phoneNumberId: string;
    status: "PENDING" | "ACTIVE";
    metadata: Record<string, unknown>;
  }): Promise<WABAConfig> {
    const existing = await this.wabaConfigRepository.findOne({
      where: { businessAccountId: data.businessAccountId },
    });

    if (existing) {
      await this.wabaConfigRepository.update(existing.id, {
        tenantId: data.tenantId,
        accessToken: data.accessToken,
        phoneNumberId: data.phoneNumberId,
        isActive: true,
        metadata: data.metadata,
        lastUsedAt: new Date(),
      });
      return this.wabaConfigRepository.findOneOrFail({ where: { id: existing.id } });
    }

    const created = this.wabaConfigRepository.create({
      tenantId: data.tenantId,
      businessAccountId: data.businessAccountId,
      accessToken: data.accessToken,
      phoneNumberId: data.phoneNumberId,
      webhookVerifyToken: randomBytes(24).toString("hex"),
      isByop: true,
      metadata: data.metadata,
    });

    return this.wabaConfigRepository.save(created);
  }

  private async upsertTenantWabaConfig(data: {
    tenantId: string;
    wabaId: string;
    accessToken: string;
    phoneNumberId: string;
    status: "PENDING" | "ACTIVE";
    verificationStatus: "UNVERIFIED" | "PENDING" | "VERIFIED";
  }): Promise<TenantWABAConfig> {
    const existing = await this.tenantWabaConfigRepository.findOne({
      where: { tenantId: data.tenantId, wabaId: data.wabaId },
    });

    if (existing) {
      await this.tenantWabaConfigRepository.update(existing.id, {
        accessToken: data.accessToken,
        phoneNumberId: data.phoneNumberId,
        status: data.status,
        verificationStatus: data.verificationStatus,
        isActive: true,
        lastSyncAt: new Date(),
      });
      return this.tenantWabaConfigRepository.findOneOrFail({ where: { id: existing.id } });
    }

    const created = this.tenantWabaConfigRepository.create({
      tenantId: data.tenantId,
      wabaId: data.wabaId,
      accessToken: data.accessToken,
      phoneNumberId: data.phoneNumberId,
      status: data.status,
      verificationStatus: data.verificationStatus,
      usage: {
        messagesSent: 0,
        templatesUsed: 0,
        totalCost: 0,
      },
    });

    return this.tenantWabaConfigRepository.save(created);
  }

  private statusFor(reviewStatus?: string): "PENDING" | "ACTIVE" {
    return reviewStatus === "APPROVED" ? "ACTIVE" : "PENDING";
  }

  private verificationFor(reviewStatus?: string): "UNVERIFIED" | "PENDING" | "VERIFIED" {
    if (reviewStatus === "APPROVED") return "VERIFIED";
    if (reviewStatus === "PENDING" || reviewStatus === "IN_REVIEW") return "PENDING";
    return "UNVERIFIED";
  }

  private signState(tenantId: string): string {
    const payload = Buffer.from(
      JSON.stringify({ tenantId, expiresAt: Date.now() + STATE_TTL_MS }),
    ).toString("base64url");
    return `${payload}.${this.signature(payload)}`;
  }

  private verifyState(state: string): string {
    const [payload, signature] = state.split(".");
    if (!payload || !signature) {
      throw new BadRequestException("Invalid signup state");
    }

    const expected = this.signature(payload);
    const provided = Buffer.from(signature);
    const expectedBuffer = Buffer.from(expected);
    if (provided.length !== expectedBuffer.length || !timingSafeEqual(provided, expectedBuffer)) {
      throw new BadRequestException("Invalid signup state signature");
    }

    let decoded: { tenantId?: string; expiresAt?: number };
    try {
      decoded = JSON.parse(Buffer.from(payload, "base64url").toString("utf8"));
    } catch {
      throw new BadRequestException("Invalid signup state");
    }

    if (!decoded.tenantId || !decoded.expiresAt || decoded.expiresAt < Date.now()) {
      throw new BadRequestException("Signup state has expired");
    }

    return decoded.tenantId;
  }

  private signature(payload: string): string {
    return createHmac("sha256", this.stateSecret()).update(payload).digest("base64url");
  }

  private stateSecret(): string {
    const secret =
      this.configService.get<string>("META_APP_SECRET") ??
      this.configService.get<string>("JWT_AUTH_SECRET");
    if (!secret) {
      throw new ServiceUnavailableException(
        "Set META_APP_SECRET (or JWT_AUTH_SECRET) to sign embedded signup state",
      );
    }
    return secret;
  }

  private requireSetting(key: "META_APP_ID" | "META_CONFIG_ID" | "META_APP_SECRET"): string {
    const value = this.configService.get<string>(key);
    if (!value) {
      throw new ServiceUnavailableException(
        `${key} is not configured. Add it to the API environment to enable WhatsApp Embedded Signup.`,
      );
    }
    return value;
  }

  private graphVersion(): string {
    return this.configService.get<string>("WHATSAPP_API_VERSION") ?? "v21.0";
  }

  private graphUrl(): string {
    return `https://graph.facebook.com/${this.graphVersion()}`;
  }

  private metaError(data: unknown): string {
    const error = data as { error?: { message?: string; code?: number } } | undefined;
    return error?.error?.message ?? "unknown Meta error";
  }

  private errorMessage(error: unknown): string {
    return error instanceof Error ? error.message : "unknown error";
  }
}

interface WabaDetails {
  id?: string;
  name?: string;
  currency?: string;
  account_review_status?: string;
  message_template_namespace?: string;
}

interface PhoneDetails {
  id?: string;
  display_phone_number?: string;
  verified_name?: string;
  quality_rating?: string;
}
