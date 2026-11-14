import { AuthLayout, AuthLink } from "@/components/auth/auth-layout";
import { RegisterForm } from "@/components/auth/register-form";
import { formatTokens, WELCOME_SIGNUP_TOKENS } from "@/lib/pricing";
import { Suspense } from "react";

function RegisterPageContent() {
  return (
    <AuthLayout
      title="Create your account"
      description={`Includes ${formatTokens(WELCOME_SIGNUP_TOKENS)} free tokens. No credit card required.`}
      footer={
        <>
          Already have an account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <RegisterForm />
    </AuthLayout>
  );
}

export default function RegisterPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      }
    >
      <RegisterPageContent />
    </Suspense>
  );
}

const metadata = {
  title: "Create Account - Sanarwa",
  description: "Create your Sanarwa account",
};
