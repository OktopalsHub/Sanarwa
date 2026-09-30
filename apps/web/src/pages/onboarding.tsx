"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { OnboardingPageLayout } from "@/components/auth/onboarding-page-layout";
import { TenantOnboarding } from "@/components/tenant/tenant-onboarding";

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <OnboardingPageLayout>
        <TenantOnboarding />
      </OnboardingPageLayout>
    </ProtectedRoute>
  );
}
