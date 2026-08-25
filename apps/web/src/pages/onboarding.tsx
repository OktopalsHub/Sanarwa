"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { TenantOnboarding } from "@/components/tenant/tenant-onboarding";

export default function OnboardingPage() {
  return (
    <ProtectedRoute>
      <TenantOnboarding />
    </ProtectedRoute>
  );
}
