import type { Tenant } from "@/lib/types/tenant";

export function getTenantPathSegment(tenant: Pick<Tenant, "subdomain" | "slug">): string {
  return tenant.subdomain || tenant.slug || "";
}

export function matchesTenantPathSegment(
  tenant: Pick<Tenant, "subdomain" | "slug">,
  segment: string,
): boolean {
  if (!segment) return false;
  return segment === tenant.subdomain || segment === tenant.slug;
}
