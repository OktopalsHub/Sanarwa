import { beforeEach, describe, expect, it, vi } from "vitest";
import { TenantApiClient } from "@sanarwa/api-client";

const tenant = {
  id: "tenant-1",
  name: "Acme",
  subdomain: "acme",
  status: "active",
} as never;

describe("TenantApiClient.getMyMemberships", () => {
  let apiClient: { get: ReturnType<typeof vi.fn> };

  const client = () => new TenantApiClient(apiClient as never);

  beforeEach(() => {
    apiClient = { get: vi.fn() };
  });

  it("preserves the role, status and user from a paginated response", async () => {
    apiClient.get.mockResolvedValue({
      records: [
        {
          id: "member-1",
          role: "admin",
          status: "active",
          user: { id: "user-1" },
          tenant,
        },
      ],
    });

    const memberships = await client().getMyMemberships();

    expect(memberships).toEqual([
      {
        membershipId: "member-1",
        tenantId: "tenant-1",
        userId: "user-1",
        role: "admin",
        status: "active",
        tenant,
      },
    ]);
  });

  it("does not invent a role when the response is a bare tenant list", async () => {
    apiClient.get.mockResolvedValue([tenant]);

    const memberships = await client().getMyMemberships();

    expect(memberships).toHaveLength(1);
    expect(memberships[0].tenantId).toBe("tenant-1");
    expect(memberships[0].role).toBeUndefined();
  });

  it("skips records that carry no tenant", async () => {
    apiClient.get.mockResolvedValue({
      records: [
        { id: "member-2", role: "owner" },
        { id: "member-3", role: "owner", tenant },
      ],
    });

    const memberships = await client().getMyMemberships();

    expect(memberships).toHaveLength(1);
    expect(memberships[0].tenantId).toBe("tenant-1");
  });

  it("keeps getMyTenants returning tenants, derived from memberships", async () => {
    apiClient.get.mockResolvedValue({
      records: [{ id: "m-1", role: "owner", status: "active", tenant }],
    });

    const tenants = await client().getMyTenants({ limit: 50 });

    expect(tenants).toEqual([tenant]);
    expect(apiClient.get).toHaveBeenCalledWith(
      "/tenants/me",
      { limit: 50 },
      { tenantScoped: false },
    );
  });
});
