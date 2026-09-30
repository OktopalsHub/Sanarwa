"use client";

import { ChevronRightIcon, HomeIcon } from "@heroicons/react/24/outline";
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

  // Generate breadcrumb items from pathname
  const generateBreadcrumbs = (): BreadcrumbItem[] => {
    const segments = pathname.split("/").filter(Boolean);
    const breadcrumbs: BreadcrumbItem[] = [];

    // Always start with dashboard
    if (segments[0] !== "dashboard") {
      breadcrumbs.push({
        label: "Dashboard",
        href: "/dashboard",
      });
    }

    // Build breadcrumbs from path segments
    let currentPath = "";
    segments.forEach((segment, index) => {
      currentPath += `/${segment}`;
      const label = routeLabels[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

      breadcrumbs.push({
        label,
        href: index === segments.length - 1 ? undefined : currentPath,
      });
    });

    return breadcrumbs;
  };

  const breadcrumbs = generateBreadcrumbs();

  if (breadcrumbs.length <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center space-x-1 text-sm text-muted-foreground">
      <HomeIcon className="h-4 w-4" />
      {breadcrumbs.map((item, index) => (
        <div key={item.label} className="flex items-center space-x-1">
          {index > 0 && <ChevronRightIcon className="h-4 w-4" />}
          {item.href ? (
            <Link href={item.href} className="hover:text-foreground transition-colors">
              {item.label}
            </Link>
          ) : (
            <span className="text-foreground font-medium">{item.label}</span>
          )}
        </div>
      ))}
    </nav>
  );
}
