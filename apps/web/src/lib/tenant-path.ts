import type { Tenant } from "@/lib/types/tenant";

/** Canonical URL segment: /{subdomain}/* */
export function getTenantPathSegment(tenant: Pick<Tenant, "subdomain" | "slug" | "id">): string {
  return tenant.subdomain || tenant.slug || tenant.id;
}

export function tenantBasePath(tenant: Pick<Tenant, "subdomain" | "slug" | "id">): string {
  const segment = getTenantPathSegment(tenant);
  return segment ? `/${segment}` : "";
}

export function matchesTenantPathSegment(
  tenant: Pick<Tenant, "subdomain" | "slug" | "id">,
  segment: string,
): boolean {
  if (!segment) return false;
  return (
    segment === tenant.subdomain ||
    segment === tenant.slug ||
    segment === tenant.id
  );
}
