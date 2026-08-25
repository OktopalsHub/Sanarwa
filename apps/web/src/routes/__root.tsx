import { Send } from "@/lib/icons";
import type { ReactNode } from "react";
import { Outlet, createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import { SkipLinks } from "@/components/accessibility";
import { MonitoringProvider, UserBehaviorTracker } from "@/components/monitoring";
import {
  PerformanceDebugger,
  PerformanceMonitorComponent,
  ServiceWorkerRegistration,
} from "@/components/performance";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/contexts/auth-context";
import { BrandingProvider } from "@/contexts/branding-context";
import { TenantProvider } from "@/contexts/tenant-context";
import { QueryProvider } from "@/lib/query";
import { ReduxProvider } from "@/lib/store";
import { brandAssets } from "@sanarwa/assets";
import { Toaster } from "sonner";
import appCss from "@/styles/globals.css?url";

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Sanarwa — Multi-channel communication API" },
      {
        name: "description",
        content: "Send email, SMS, push, in-app, and voice from one typed API.",
      },
      { name: "theme-color", content: "#001F3D" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: brandAssets.favicon, type: "image/svg+xml" },
      { rel: "manifest", href: "/manifest.json" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500;600&family=Inter:wght@400;500;600;700;900&display=swap",
      },
    ],
  }),
  component: RootComponent,
});

function RootComponent() {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="font-sans antialiased">
        <SkipLinks />
        <ServiceWorkerRegistration />
        <PerformanceMonitorComponent enableWebVitals enableCustomMetrics />
        <ReduxProvider>
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
                    <PerformanceDebugger />
                  </BrandingProvider>
                </TenantProvider>
              </AuthProvider>
            </ThemeProvider>
          </QueryProvider>
        </ReduxProvider>
        <Scripts />
      </body>
    </html>
  );
}

function AppShell({ children }: { children: ReactNode }) {
  return <>{children}</>;
}
