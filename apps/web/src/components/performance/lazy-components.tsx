"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Suspense, lazy } from "react";

// Loading fallback components
export function ComponentSkeleton({ className }: { className?: string }) {
  return (
    <div className={className}>
      <Skeleton className="h-8 w-full mb-4" />
      <Skeleton className="h-4 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-2" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

export function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Skeleton className="h-64 w-full" />
        <Skeleton className="h-64 w-full" />
      </div>
    </div>
  );
}

export function ChartSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-32" />
      <Skeleton className="h-48 w-full" />
    </div>
  );
}

export function TableSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-10 w-full" />
      {Array.from({ length: 5 }).map((_, i) => (
        <Skeleton key={i} className="h-8 w-full" />
      ))}
    </div>
  );
}

export function FormSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-10 w-full" />
      <Skeleton className="h-6 w-24" />
      <Skeleton className="h-24 w-full" />
      <Skeleton className="h-10 w-32" />
    </div>
  );
}

// Lazy-loaded components with proper fallbacks
export const LazyCampaignBuilder = lazy(() =>
  import("@/components/campaigns/campaign-wizard").then((module) => ({
    default: module.CampaignWizard,
  })),
);

export const LazyWorkflowCanvas = lazy(() =>
  import("@/components/workflows/workflow-canvas").then((module) => ({
    default: module.WorkflowCanvas,
  })),
);

export const LazyAnalyticsDashboard = lazy(() =>
  import("@/components/analytics/analytics-dashboard").then((module) => ({
    default: module.AnalyticsDashboard,
  })),
);

export const LazyBrandingConfigurator = lazy(() =>
  import("@/components/branding/branding-configurator").then((module) => ({
    default: module.BrandingConfigurator,
  })),
);

export const LazyTeamManagement = lazy(() =>
  import("@/components/tenant/team-management").then((module) => ({
    default: module.TeamManagement,
  })),
);

// Wrapper components with Suspense
interface LazyWrapperProps {
  children: React.ReactNode;
  fallback?: React.ReactNode;
  className?: string;
}

export function LazyWrapper({ children, fallback, className }: LazyWrapperProps) {
  return (
    <Suspense fallback={fallback || <ComponentSkeleton className={className} />}>
      {children}
    </Suspense>
  );
}

// Specific lazy wrappers for common components
export function LazyCampaignBuilderWrapper(props: any) {
  return (
    <LazyWrapper fallback={<FormSkeleton />}>
      <LazyCampaignBuilder {...props} />
    </LazyWrapper>
  );
}

export function LazyWorkflowCanvasWrapper(props: any) {
  return (
    <LazyWrapper fallback={<ComponentSkeleton className="h-96" />}>
      <LazyWorkflowCanvas {...props} />
    </LazyWrapper>
  );
}

export function LazyAnalyticsDashboardWrapper(props: any) {
  return (
    <LazyWrapper fallback={<DashboardSkeleton />}>
      <LazyAnalyticsDashboard {...props} />
    </LazyWrapper>
  );
}

export function LazyBrandingConfiguratorWrapper(props: any) {
  return (
    <LazyWrapper fallback={<FormSkeleton />}>
      <LazyBrandingConfigurator {...props} />
    </LazyWrapper>
  );
}

export function LazyTeamManagementWrapper(props: any) {
  return (
    <LazyWrapper fallback={<TableSkeleton />}>
      <LazyTeamManagement {...props} />
    </LazyWrapper>
  );
}
