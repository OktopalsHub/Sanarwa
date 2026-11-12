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
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-2 px-3 sm:gap-4 sm:px-4">
        {onToggleSidebar ? (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 md:hidden"
            onClick={onToggleSidebar}
            aria-label="Toggle navigation menu"
          >
            <Bars3Icon className="h-5 w-5" aria-hidden />
          </Button>
        ) : null}

        <div className="min-w-0 flex-1" />

        <div className="flex shrink-0 items-center gap-2">
          <NotificationBell />

          <ThemeToggle />

          <div className="w-28 min-w-0 sm:w-48">
            <TenantSwitcher />
          </div>

          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}
