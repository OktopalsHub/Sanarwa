import { Tenant, TenantStatus } from "../entities/tenant.entity";
import { TenantQuotas } from "../../../common/interfaces";

describe("Tenant Entity", () => {
  let tenant: Tenant;

  beforeEach(() => {
    tenant = new Tenant();
    tenant.id = "123e4567-e89b-12d3-a456-426614174000";
    tenant.name = "Test Tenant";
    // tenant.apiKey = 'api-key-123'; // Removed as apiKey is not a property of Tenant
    tenant.status = TenantStatus.ACTIVE;
    tenant.quotas = {
      notifications: {
        daily: 1000,
        monthly: 30000,
      },
      channels: {
        email: { daily: 500, monthly: 15000 },
        sms: { daily: 200, monthly: 6000 },
      },
    };
    tenant.createdAt = new Date();
    tenant.updatedAt = new Date();
  });

  it("should be defined", () => {
    expect(tenant).toBeDefined();
  });

  it("should support all tenant statuses", () => {
    const statuses = Object.values(TenantStatus);
    expect(statuses).toContain(TenantStatus.ACTIVE);
    expect(statuses).toContain(TenantStatus.SUSPENDED);
    expect(statuses).toContain(TenantStatus.INACTIVE);
  });

  it("should handle quotas correctly", () => {
    const quotas: TenantQuotas = {
      notifications: {
        daily: 1000,
        monthly: 30000,
        total: 1000000,
      },
      channels: {
        email: { daily: 500, monthly: 15000 },
        sms: { daily: 200, monthly: 6000 },
        push: { daily: 300, monthly: 9000 },
        whatsapp: { daily: 100, monthly: 3000 },
        inApp: { daily: 1000, monthly: 30000 },
      },
      templates: {
        total: 100,
        versionsPerTemplate: 10,
      },
      providers: {
        total: 20,
      },
    };

    tenant.quotas = quotas;
    expect(tenant.quotas).toEqual(quotas);
    expect(tenant.quotas.notifications.daily).toBe(1000);
    expect(tenant.quotas.channels.email?.daily).toBe(500);
  });

  it("should handle settings correctly", () => {
    tenant.settings = {
      timezone: "UTC",
      defaultFromEmail: "noreply@example.com",
      defaultFromName: "Test Company",
      webhookUrl: "https://example.com/webhook",
      retryPolicy: {
        maxRetries: 3,
        retryDelay: 1000,
        exponentialBackoff: true,
      },
      rateLimiting: {
        enabled: true,
        requestsPerMinute: 100,
        requestsPerHour: 1000,
      },
    };

    expect(tenant.settings.timezone).toBe("UTC");
    expect(tenant.settings.retryPolicy?.maxRetries).toBe(3);
    expect(tenant.settings.rateLimiting?.enabled).toBe(true);
  });

  it("should handle billing info correctly", () => {
    tenant.billingInfo = {
      plan: "premium",
      billingEmail: "billing@example.com",
      billingAddress: {
        street: "123 Main St",
        city: "New York",
        state: "NY",
        country: "US",
        postalCode: "10001",
      },
      paymentMethod: "credit_card",
    };

    expect(tenant.billingInfo.plan).toBe("premium");
    expect(tenant.billingInfo.billingAddress?.city).toBe("New York");
  });

  it("should handle usage tracking", () => {
    tenant.usage = {
      currentMonth: {
        notifications: 500,
        email: 300,
        sms: 100,
        push: 50,
        whatsapp: 25,
        inApp: 25,
      },
      lastUpdated: new Date(),
    };

    expect(tenant.usage.currentMonth?.notifications).toBe(500);
    expect(tenant.usage.currentMonth?.email).toBe(300);
  });
});
