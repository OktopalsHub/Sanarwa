import { NotificationChannel } from "src/common/enums";
import { ProviderConfig } from "../../modules/provider/provider-config.entity";

export class ProviderConfigFactory {
  static create(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    const mockProject = {
      id: "project-" + Math.random().toString(36).substr(2, 9),
      tenantId: "tenant-" + Math.random().toString(36).substr(2, 9),
      tenant: {
        id: "tenant-" + Math.random().toString(36).substr(2, 9),
        name: "Test Tenant",
      },
    };

    const defaultConfig: ProviderConfig = {
      id: "config-" + Math.random().toString(36).substr(2, 9),
      projectId: mockProject.id,
      providerId: "aws_ses",
      providerName: "AWS SES",
      providerType: "aws_ses" as any,
      channel: NotificationChannel.EMAIL,
      config: {
        accessKeyId: "test-access-key",
        secretAccessKey: "test-secret-key",
        region: "us-east-1",
      },
      priority: 1,
      isActive: true,
      isDefault: false,
      healthStatus: "healthy",
      createdBy: {
        id: "member-" + Math.random().toString(36).substr(2, 9),
      } as any,
      createdAt: new Date(),
      updatedAt: new Date(),
      project: mockProject as any,
      get tenant() {
        return this.project?.tenant;
      },
      get tenantId() {
        return this.project?.tenantId;
      },
    };

    return { ...defaultConfig, ...overrides } as ProviderConfig;
  }

  static createMany(count: number, overrides: Partial<ProviderConfig> = {}): ProviderConfig[] {
    return Array.from({ length: count }, (_, index) =>
      this.create({
        ...overrides,
        id: `config-${index + 1}`,
        providerId: `provider-${index + 1}`,
        priority: index + 1,
      }),
    );
  }

  static createForChannel(
    channel: NotificationChannel,
    overrides: Partial<ProviderConfig> = {},
  ): ProviderConfig {
    const channelConfig = this.getConfigForChannel(channel);
    return this.create({
      ...overrides,
      channel,
      ...channelConfig,
    });
  }

  static createAWSSES(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return this.create({
      ...overrides,
      providerId: "aws_ses",
      providerName: "AWS SES",
      providerType: "aws_ses" as any,
      channel: NotificationChannel.EMAIL,
      config: {
        accessKeyId: "AKIA...",
        secretAccessKey: "secret...",
        region: "us-east-1",
        fromEmail: "noreply@example.com",
      },
    });
  }

  static createAWSSNS(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return this.create({
      ...overrides,
      providerId: "aws_sns",
      providerName: "AWS SNS",
      providerType: "aws_sns" as any,
      channel: NotificationChannel.SMS,
      config: {
        accessKeyId: "AKIA...",
        secretAccessKey: "secret...",
        region: "us-east-1",
      },
    });
  }

  static createTermii(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return this.create({
      ...overrides,
      providerId: "termii",
      providerName: "Termii SMS",
      providerType: "termii" as any,
      channel: NotificationChannel.SMS,
      config: {
        apiKey: "termii-api-key",
        senderId: "TERMII",
        baseUrl: "https://api.ng.termii.com",
      },
    });
  }

  static createPinpoint(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return this.create({
      ...overrides,
      providerId: "aws_pinpoint",
      providerName: "AWS Pinpoint",
      providerType: "aws_pinpoint" as any,
      channel: NotificationChannel.PUSH,
      config: {
        accessKeyId: "AKIA...",
        secretAccessKey: "secret...",
        region: "us-east-1",
        applicationId: "pinpoint-app-id",
      },
    });
  }

  static createWhatsApp(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return this.create({
      ...overrides,
      providerId: "meta_whatsapp",
      providerName: "Meta WhatsApp",
      providerType: "meta_whatsapp" as any,
      channel: NotificationChannel.WHATSAPP,
      config: {
        accessToken: "whatsapp-access-token",
        phoneNumberId: "phone-number-id",
        businessAccountId: "business-account-id",
      },
    });
  }

  static createWithPriority(
    priority: number,
    overrides: Partial<ProviderConfig> = {},
  ): ProviderConfig {
    return this.create({ ...overrides, priority });
  }

  static createInactive(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return this.create({ ...overrides, isActive: false });
  }

  static createDefault(overrides: Partial<ProviderConfig> = {}): ProviderConfig {
    return this.create({ ...overrides, isDefault: true, priority: 1 });
  }

  private static getConfigForChannel(channel: NotificationChannel) {
    switch (channel) {
      case NotificationChannel.EMAIL:
        return {
          providerId: "aws_ses",
          providerName: "AWS SES",
          providerType: "aws_ses" as any,
          config: {
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            region: "us-east-1",
          },
        };
      case NotificationChannel.SMS:
        return {
          providerId: "aws_sns",
          providerName: "AWS SNS",
          providerType: "aws_sns" as any,
          config: {
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            region: "us-east-1",
          },
        };
      case NotificationChannel.PUSH:
        return {
          providerId: "aws_pinpoint",
          providerName: "AWS Pinpoint",
          providerType: "aws_pinpoint" as any,
          config: {
            accessKeyId: "test-key",
            secretAccessKey: "test-secret",
            region: "us-east-1",
            applicationId: "test-app-id",
          },
        };
      case NotificationChannel.WHATSAPP:
        return {
          providerId: "meta_whatsapp",
          providerName: "Meta WhatsApp",
          providerType: "meta_whatsapp" as any,
          config: {
            accessToken: "test-token",
            phoneNumberId: "test-phone-id",
          },
        };
      default:
        return {
          providerId: "default_provider",
          providerName: "Default Provider",
          providerType: "default" as any,
          config: {},
        };
    }
  }
}
