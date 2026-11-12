import { Send } from "@/lib/icons";
import type { ReactNode } from "react";
import { Outlet, createRootRoute } from "@tanstack/react-router";
import { SkipLinks } from "@/components/accessibility";
import { MonitoringProvider, UserBehaviorTracker } from "@/components/monitoring";
import { PerformanceMonitorComponent, ServiceWorkerRegistration } from "@/components/performance";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { BrandingProvider } from "@/contexts/branding-context";
import { TenantProvider } from "@/contexts/tenant-context";
import { QueryProvider } from "@/lib/query";
import { Toaster } from "sonner";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <>
      <SkipLinks />
      <ServiceWorkerRegistration />
      <PerformanceMonitorComponent enableWebVitals enableCustomMetrics />
      <QueryProvider>
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange={false}
        >
          <AuthProvider>
            <TenantProvider>
              <BrandingProvider>
                <MonitoringProvider>
                  <UserBehaviorTracker>
                    <AppShell>{(<Outlet />) as ReactNode}</AppShell>
                  </UserBehaviorTracker>
                </MonitoringProvider>
                <Toaster richColors position="top-right" />
              </BrandingProvider>
            </TenantProvider>
          </AuthProvider>
        </ThemeProvider>
      </QueryProvider>
    </>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
