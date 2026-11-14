"use client";

import { NotificationBell } from "@/components/in-app/notification-bell";
import { TenantSwitcher } from "@/components/tenant/tenant-switcher";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@sanarwa/ui/button";
import { Bars3Icon } from "@heroicons/react/24/outline";
import { UserProfileDropdown } from "./user-profile-dropdown";

interface AppHeaderProps {
  onToggleSidebar?: () => void;
}

export function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background">
      <div className="flex h-14 items-center gap-2 px-4 md:px-6">
        {onToggleSidebar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="-ml-2 shrink-0 md:hidden"
            onClick={onToggleSidebar}
            aria-label="Open navigation menu"
          >
            <Bars3Icon className="h-5 w-5" aria-hidden />
          </Button>
        ) : null}

        <div className="w-44 min-w-0 sm:w-56">
          <TenantSwitcher />
        </div>

        <div className="min-w-0 flex-1" />

        <div className="flex shrink-0 items-center gap-1">
          <NotificationBell />
          <ThemeToggle />
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}
