'use client';

import { Button } from '@/components/ui/button';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { Bars3Icon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { Breadcrumbs } from './breadcrumbs';

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile sidebar */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            className="fixed top-4 left-4 z-50 md:hidden"
          >
            <Bars3Icon className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-72 p-0">
          <AppSidebar onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      {/* Desktop layout */}
      <div className="flex">
        {/* Desktop sidebar */}
        <div className="hidden md:flex md:w-72 md:flex-col md:fixed md:inset-y-0">
          <AppSidebar />
        </div>

        {/* Main content */}
        <div className="flex-1 md:pl-72">
          <AppHeader />

          {/* Breadcrumbs */}
          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="px-4 py-3">
              <Breadcrumbs />
            </div>
          </div>

          {/* Page content */}
          <main className="flex-1">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
}