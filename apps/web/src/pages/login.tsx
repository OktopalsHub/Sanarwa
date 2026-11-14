import { AuthLayout, AuthLink } from "@/components/auth/auth-layout";
import { LoginForm } from "@/components/auth/login-form";
import { Suspense } from "react";

function LoginPageContent() {
  return (
    <AuthLayout
      title="Sign in to Sanarwa"
      description="Welcome back. Enter your details to continue."
      footer={
        <>
          Don&apos;t have an account? <AuthLink href="/register">Create one</AuthLink>
        </>
      }
    >
      <LoginForm />
    </AuthLayout>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <div className="size-6 animate-spin rounded-full border-2 border-muted border-t-foreground" />
        </div>
      }
    >
      <LoginPageContent />
    </Suspense>
  );
}

const metadata = {
  title: "Sign In - Sanarwa",
  description: "Sign in to your Sanarwa account",
};
