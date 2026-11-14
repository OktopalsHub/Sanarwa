"use client";

import { Sheet, SheetContent } from "@sanarwa/ui/sheet";
import { useState } from "react";
import { AppHeader } from "./app-header";
import { AppSidebar } from "./app-sidebar";

interface AppShellProps {
  children: React.ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen bg-background">
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="w-64 p-0" aria-label="Navigation menu">
          <AppSidebar onNavigate={() => setSidebarOpen(false)} />
        </SheetContent>
      </Sheet>

      <div className="hidden md:fixed md:inset-y-0 md:flex md:w-60 md:flex-col">
        <AppSidebar />
      </div>

      <div className="md:pl-60">
        <AppHeader onToggleSidebar={() => setSidebarOpen(true)} />
        <main>{children}</main>
      </div>
    </div>
  );
}
