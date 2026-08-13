'use client';

import { PermissionGate } from '@/components/auth/permission-gate';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { useTenantBasePath } from '@/hooks/use-tenant-slug';
import { Permission } from '@/lib/types/permissions';
import { cn } from '@/lib/utils';
import {
  BoltIcon,
  BriefcaseIcon,
  ChartBarIcon,
  CodeBracketSquareIcon,
  Cog6ToothIcon,
  CreditCardIcon,
  CubeIcon,
  HomeIcon,
  InboxIcon,
  LinkIcon,
} from '@heroicons/react/24/outline';
import Link from '@/compat/next-link';
import { usePathname } from '@/compat/next-navigation';
import { useMemo } from 'react';

interface NavigationItem {
  name: string;
  segment: string;
  icon: React.ComponentType<{ className?: string }>;
  permissions?: Permission[];
}

function buildNav(base: string, items: NavigationItem[]): Array<NavigationItem & { href: string }> {
  return items.map((item) => ({
    ...item,
    href: `${base}/${item.segment}`,
  }));
}

const sendingSegments: NavigationItem[] = [
  { name: 'Dashboard', segment: 'dashboard', icon: HomeIcon },
  { name: 'Messages', segment: 'messages', icon: InboxIcon },
  { name: 'Campaigns', segment: 'campaigns', icon: BriefcaseIcon, permissions: ['campaigns:read'] },
  { name: 'Analytics', segment: 'analytics', icon: ChartBarIcon, permissions: ['analytics:read'] },
];

const setupSegments: NavigationItem[] = [
  { name: 'Projects', segment: 'projects', icon: CubeIcon },
  { name: 'Providers', segment: 'providers', icon: BoltIcon },
  { name: 'API Keys', segment: 'api-keys', icon: CodeBracketSquareIcon },
  { name: 'Webhooks', segment: 'webhooks', icon: LinkIcon },
];

const workspaceSegments: NavigationItem[] = [
  { name: 'Billing', segment: 'billing', icon: CreditCardIcon },
  { name: 'Settings', segment: 'settings', icon: Cog6ToothIcon, permissions: ['settings:read'] },
];

interface AppSidebarProps {
  onNavigate?: () => void;
}

export function AppSidebar({ onNavigate }: AppSidebarProps) {
  const pathname = usePathname();
  const basePath = useTenantBasePath();
  const base = basePath || '/dashboard';

  const sending = useMemo(() => buildNav(base, sendingSegments), [base]);
  const setup = useMemo(() => buildNav(base, setupSegments), [base]);
  const workspace = useMemo(() => buildNav(base, workspaceSegments), [base]);

  const handleNavigation = () => {
    onNavigate?.();
  };

  const homeHref = basePath ? `${basePath}/dashboard` : '/dashboard';

  return (
    <div className="flex h-full flex-col bg-background border-r">
      <div className="flex h-16 items-center px-6 border-b">
        <Link href={homeHref} className="flex items-center gap-2" onClick={handleNavigation}>
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <BoltIcon className="h-4 w-4" />
          </div>
          <span className="text-lg font-semibold">Sanarwa</span>
        </Link>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto p-4">
        <NavSection
          title="Sending"
          items={sending}
          pathname={pathname}
          onClick={handleNavigation}
        />
        <Separator className="my-4" />
        <NavSection
          title="Setup"
          items={setup}
          pathname={pathname}
          onClick={handleNavigation}
        />
        <Separator className="my-4" />
        <NavSection
          title="Workspace"
          items={workspace}
          pathname={pathname}
          onClick={handleNavigation}
        />
      </nav>

      <div className="p-4 border-t">
        <div className="text-xs text-muted-foreground">
          <p>© {new Date().getFullYear()} Sanarwa</p>
        </div>
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
  onClick: () => void;
}) {
  return (
    <div className="space-y-1">
      <div className="px-3 py-2">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          {title}
        </h3>
      </div>
      {items.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
        if (item.permissions) {
          return (
            <PermissionGate key={item.name} permissions={item.permissions}>
              <NavigationLink item={item} isActive={isActive} onClick={onClick} />
            </PermissionGate>
          );
        }
        return (
          <NavigationLink
            key={item.name}
            item={item}
            isActive={isActive}
            onClick={onClick}
          />
        );
      })}
    </div>
  );
}

interface NavigationLinkProps {
  item: NavigationItem & { href: string };
  isActive: boolean;
  onClick?: () => void;
}

function NavigationLink({ item, isActive, onClick }: NavigationLinkProps) {
  return (
    <Button
      asChild
      variant={isActive ? 'secondary' : 'ghost'}
      className={cn(
        'w-full justify-start gap-3 h-10',
        isActive && 'bg-secondary text-secondary-foreground',
      )}
    >
      <Link href={item.href} onClick={onClick}>
        <item.icon className="h-4 w-4" />
        <span className="flex-1 text-left">{item.name}</span>
      </Link>
    </Button>
  );
}
