import { ResetPasswordForm } from "@/components/auth/reset-password-form";
import { Suspense } from "react";

function ResetPasswordPageContent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <ResetPasswordForm />
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <ResetPasswordPageContent />
    </Suspense>
  );
}

export const metadata = {
  title: "Reset Password - Notifi",
  description: "Reset your Notifi account password",
};
