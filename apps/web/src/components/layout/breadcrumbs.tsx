"use client";

import { ChevronRightIcon } from "@heroicons/react/24/outline";
import { useTenant } from "@/contexts/tenant-context";
import { getTenantPathSegment } from "@/lib/tenant-path";
import Link from "@/compat/next-link";
import { usePathname } from "@/compat/next-navigation";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

const routeLabels: Record<string, string> = {
  dashboard: "Dashboard",
  campaigns: "Campaigns",
  workflows: "Workflows",
  messages: "Messages",
  webhooks: "Webhooks",
  providers: "Providers",
  projects: "Projects",
  analytics: "Analytics",
  audience: "Audience",
  channels: "Channels",
  settings: "Settings",
  integrations: "Integrations",
  notifications: "Notifications",
  branding: "Branding",
  team: "Team",
  "api-keys": "API Keys",
  billing: "Billing",
  profile: "Profile",
};

export function Breadcrumbs() {
  const pathname = usePathname();
  const { selectedTenant } = useTenant();

  const tenantSegment = selectedTenant ? getTenantPathSegment(selectedTenant) : undefined;
  const segments = pathname.split("/").filter(Boolean);
  const tenantScoped = Boolean(selectedTenant && tenantSegment && segments[0] === tenantSegment);

  const breadcrumbs: BreadcrumbItem[] = [];
  let rest = segments;

  if (tenantScoped && selectedTenant && tenantSegment) {
    breadcrumbs.push({ label: selectedTenant.name, href: `/${tenantSegment}/dashboard` });
    rest = segments.slice(1);
  } else if (segments[0] !== "dashboard") {
    breadcrumbs.push({ label: "Dashboard", href: "/dashboard" });
  }

  let currentPath = tenantScoped && tenantSegment ? `/${tenantSegment}` : "";
  rest.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);
    breadcrumbs.push({
      label,
      href: index === rest.length - 1 ? undefined : currentPath,
    });
  });

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center gap-1 text-sm text-muted-foreground" aria-label="Breadcrumb">
      {breadcrumbs.map((item, index) => (
        <div key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <ChevronRightIcon className="h-4 w-4" aria-hidden />}
          {item.href ? (
            <Link href={item.href} className="transition-colors hover:text-foreground">
              {item.label}
            </Link>
          ) : (
            <span aria-current="page" className="font-medium text-foreground">
              {item.label}
            </span>
          )}
        </div>
      ))}
    </nav>
  );
}
