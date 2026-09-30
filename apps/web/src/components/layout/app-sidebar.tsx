"use client";

import { PermissionGate } from "@/components/auth/permission-gate";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import { cn } from "@/lib/utils";
import { IconBolt } from "@tabler/icons-react";
import Link from "@/compat/next-link";
import { usePathname } from "@/compat/next-navigation";
import { useMemo } from "react";
import {
  buildNav,
  sendingSegments,
  setupSegments,
  workspaceSegments,
  type NavigationItem,
} from "./nav-config";

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const basePath = useTenantBasePath();
  const base = basePath || "/dashboard";

  const sending = useMemo(() => buildNav(base, sendingSegments), [base]);
  const setup = useMemo(() => buildNav(base, setupSegments), [base]);
  const workspace = useMemo(() => buildNav(base, workspaceSegments), [base]);

  const homeHref = basePath ? `${basePath}/dashboard` : "/dashboard";

  return (
    <div className="flex h-full flex-col border-r bg-background">
      <div className="flex h-16 items-center border-b px-6">
        <Link href={homeHref} className="flex items-center gap-2" onClick={onNavigate}>
          <div className="flex size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <IconBolt className="size-4" />
          </div>
          <span className="text-lg font-semibold">Sanarwa</span>
        </Link>
      </div>

      <nav className="flex flex-1 flex-col gap-1 overflow-y-auto p-4">
        <NavSection title="Sending" items={sending} pathname={pathname} onClick={onNavigate} />
        <Separator className="my-4" />
        <NavSection title="Setup" items={setup} pathname={pathname} onClick={onNavigate} />
        <Separator className="my-4" />
        <NavSection title="Workspace" items={workspace} pathname={pathname} onClick={onNavigate} />
      </nav>

      <div className="border-t p-4">
        <p className="text-xs text-muted-foreground">© {new Date().getFullYear()} Sanarwa</p>
      </div>
    </div>
  );
}

function NavSection({
  title,
  items,
  pathname,
  onClick,
}: {
  title: string;
  items: Array<NavigationItem & { href: string }>;
  pathname: string;
  onClick?: () => void;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
      </div>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
        if (item.permissions) {
          return (
            <PermissionGate key={item.name} permissions={item.permissions}>
              <NavigationLink item={item} isActive={isActive} onClick={onClick} />
            </PermissionGate>
          );
        }
        return <NavigationLink key={item.name} item={item} isActive={isActive} onClick={onClick} />;
      })}
    </div>
  );
}

function NavigationLink({
  item,
  isActive,
  onClick,
}: {
  item: NavigationItem & { href: string };
  isActive: boolean;
  onClick?: () => void;
}) {
  return (
    <Button
      asChild
      variant={isActive ? "secondary" : "ghost"}
      className={cn(
        "h-10 w-full justify-start gap-3",
        isActive && "bg-secondary text-secondary-foreground",
      )}
    >
      <Link href={item.href} onClick={onClick}>
        <item.icon data-icon="inline-start" />
        <span className="flex-1 text-left">{item.name}</span>
      </Link>
    </Button>
  );
}
