import { LoginForm } from "@/components/auth/login-form";
import { LoginPageLayout } from "@/components/auth/login-page-layout";
import { Suspense } from "react";

function LoginPageContent() {
  return (
    <LoginPageLayout>
      <LoginForm />
    </LoginPageLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[var(--color-paper)]">
          <div className="size-8 animate-spin rounded-full border-2 border-[var(--color-rule)] border-t-[var(--hm-accent)]" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

export const metadata = {
  title: "Sign In - Sanarwa",
  description: "Sign in to your Sanarwa account",
};
