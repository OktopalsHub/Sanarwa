import { VerifyEmail } from "@/components/auth/verify-email";
import { Suspense } from "react";

function VerifyEmailPageContent() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <div className="w-full max-w-md">
        <VerifyEmail />
      </div>
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      }
    >
      <VerifyEmailPageContent />
    </Suspense>
  );
}

export const metadata = {
  title: "Verify Email - Notifi",
  description: "Verify your email address",
};
