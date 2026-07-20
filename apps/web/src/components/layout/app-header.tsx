'use client';

import { User } from '@/lib/icons';

import { TenantSwitcher } from '@/components/tenant/tenant-switcher';
import { ThemeToggle } from '@/components/theme-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { BellIcon, MagnifyingGlassIcon } from '@heroicons/react/24/outline'
import { UserProfileDropdown } from './user-profile-dropdown';

export function AppHeader() {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center gap-4 px-4">
        {/* Search */}
        <div className="flex-1 max-w-md">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search campaigns, workflows, templates..."
              className="pl-9"
            />
          </div>
        </div>

        {/* Right side actions */}
        <div className="flex items-center gap-2">
          {/* Notifications */}
          <Button variant="ghost" size="icon" className="relative">
            <BellIcon className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
              3
            </span>
            <span className="sr-only">Notifications</span>
          </Button>

          {/* Theme toggle */}
          <ThemeToggle />

          {/* Tenant switcher */}
          <div className="w-48">
            <TenantSwitcher />
          </div>

          {/* User profile */}
          <UserProfileDropdown />
        </div>
      </div>
    </header>
  );
}