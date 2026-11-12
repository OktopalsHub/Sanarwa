"use client";

import { Sheet, SheetContent } from "@sanarwa/ui/sheet";
import { useState } from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";
import { Breadcrumbs } from "./breadcrumbs";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-72 p-0" aria-label="Navigation menu">
          <AppSidebar onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="flex">
        <div className="hidden md:fixed md:inset-y-0 md:flex md:w-72 md:flex-col">
          <AppSidebar />
        </div>

        <div className="flex-1 md:pl-72">
          <AppHeader onToggleSidebar={() => setSidebarOpen(true)} />

          <div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
            <div className="px-4 py-3">
              <Breadcrumbs />
            </div>
          </div>

          <main className="flex-1">{children}</main>
        </div>
      </div>
    </div>
  );
}
