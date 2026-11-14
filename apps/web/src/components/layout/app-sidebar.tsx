"use client";

import { PermissionGate } from "@/components/auth/permission-gate";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import { cn } from "@/lib/utils";
import { IconBook } from "@tabler/icons-react";
import Link from "@/compat/next-link";
import { usePathname } from "@/compat/next-navigation";
import { useMemo } from "react";
import { BrandMark } from "@/components/brand-mark";
import { buildNav, navigationGroups, type NavigationItem } from "./nav-config";

interface AppSidebarProps {
  onNavigate?: () => void;
}

type LinkItem = NavigationItem & { href: string };

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const basePath = useTenantBasePath();
  const base = basePath || "/dashboard";
  const homeHref = basePath ? `${basePath}/dashboard` : "/dashboard";

  const groups = useMemo(
    () => navigationGroups.map((group) => ({ ...group, items: buildNav(base, group.items) })),
    [base],
  );

  return (
    <div className="flex h-full flex-col border-r bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center px-4">
        <Link href={homeHref} className="flex items-center gap-2" onClick={onNavigate}>
          <BrandMark />
          <span className="text-[15px] font-semibold tracking-tight">Sanarwa</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-5 overflow-y-auto px-3 py-2" aria-label="Main">
        {groups.map((group, index) => (
          <div key={group.title ?? index} className="flex flex-col gap-0.5">
            {group.title ? (
              <p className="px-2.5 pb-1 text-xs font-medium text-muted-foreground">{group.title}</p>
            ) : null}
            {group.items.map((item) => (
              <GatedLink key={item.segment} item={item} pathname={pathname} onClick={onNavigate} />
            ))}
          </div>
        ))}
      </nav>

      <div className="border-t p-3">
        <Link
          href="/docs"
          onClick={onNavigate}
          className="flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
        >
          <IconBook className="size-4" aria-hidden />
          Documentation
        </Link>
      </div>
    </div>
  );
}

function GatedLink({
  item,
  pathname,
  onClick,
}: {
  item: LinkItem;
  pathname: string;
  onClick?: () => void;
}) {
  const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
  const link = <NavLink item={item} isActive={isActive} onClick={onClick} />;

  return item.permissions ? (
    <PermissionGate permissions={item.permissions}>{link}</PermissionGate>
  ) : (
    link
  );
}

function NavLink({
  item,
  isActive,
  onClick,
}: {
  item: LinkItem;
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={isActive ? "page" : undefined}
      className={cn(
        "flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-colors",
        isActive
          ? "bg-sidebar-accent font-medium text-sidebar-accent-foreground"
          : "text-muted-foreground hover:bg-sidebar-accent hover:text-foreground",
      )}
    >
      <item.icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.name}</span>
    </Link>
  );
}
