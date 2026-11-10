"use client";

import { ProtectedRoute } from "@/components/auth/protected-route";
import { AppShell } from "@/components/layout";
import { BrandedEmailTemplate } from "@/components/templates/branded-email-template";

export default function EmailTemplatePage() {
  const handleSaveTemplate = (template: any) => {
    console.log("Saving template:", template);
  };

  const handleSendTest = (template: any) => {
    console.log("Sending test email:", template);
  };

  return (
    <ProtectedRoute>
      <AppShell>
        <div className="p-6">
          <div className="max-w-7xl mx-auto">
            <BrandedEmailTemplate onSave={handleSaveTemplate} onSend={handleSendTest} />
          </div>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
