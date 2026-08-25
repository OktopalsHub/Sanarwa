"use client";

import { AuthCard, AuthDivider } from "@/components/auth/auth-page-shell";
import { AuthOAuthButtons } from "@/components/auth/auth-oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { LoginCredentials } from "@/lib/types/auth";
import Link from "@/compat/next-link";
import { useRouter, useSearchParams } from "@/compat/next-navigation";
import { useState } from "react";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, isLoading, error } = useAuth();

  const [formData, setFormData] = useState<LoginCredentials>({
    email: "",
    password: "",
    rememberMe: false,
  });

  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.email) {
      errors.email = "Email is required";
    } else if (!/\S+@\S+\.\S+/.test(formData.email)) {
      errors.email = "Email is invalid";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await login(formData);

      const { tenantApi } = await import("@/lib/api/tenant");
      const tenants = await tenantApi.getTenants();

      if (tenants.length > 0) {
        const firstTenant = tenants[0]!;
        const tenantSlug = firstTenant.slug || firstTenant.subdomain || firstTenant.id;
        router.push(`/${tenantSlug}/dashboard`);
      } else {
        router.push("/onboarding");
      }
    } catch (err) {
      console.error("Login failed:", err);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  const passwordError = formErrors.password || (error ? error.message : "");

  return (
    <AuthCard>
      <div className="flex flex-col gap-6">
        <div className="space-y-1 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-[var(--color-ink)]">
            Welcome back
          </h1>
          <p className="text-sm text-[var(--color-muted)]">Sign in to your account</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <Input
              id="email"
              name="email"
              type="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="name@company.com"
              disabled={isLoading}
              aria-label="Email"
              aria-invalid={!!formErrors.email}
              className="h-11 border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)]"
            />
            {formErrors.email && <p className="text-sm text-destructive">{formErrors.email}</p>}

            <div className="flex flex-col gap-1">
              <Input
                id="password"
                name="password"
                type="password"
                value={formData.password}
                onChange={handleInputChange}
                placeholder="Enter your password"
                disabled={isLoading}
                aria-label="Password"
                aria-invalid={!!passwordError}
                className="h-11 border-[var(--color-rule)] bg-[var(--color-paper)] text-[var(--color-ink)] placeholder:text-[var(--color-muted)]"
              />
              {passwordError && (
                <div className="flex flex-col gap-1">
                  <p className="text-sm text-destructive">{passwordError}</p>
                  <div className="text-right">
                    <Link
                      href="/forgot-password"
                      className="text-sm text-[var(--color-muted)] underline-offset-2 hover:text-[var(--hm-accent)] hover:underline"
                    >
                      Forgot password?
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>

          <Button
            type="submit"
            size="lg"
            className="h-11 w-full bg-[var(--hm-accent)] text-[var(--color-accent-ink)] hover:opacity-90"
            disabled={isLoading}
          >
            {isLoading ? "Signing in…" : "Login"}
          </Button>
        </form>

        <AuthDivider label="Or continue with" />

        <AuthOAuthButtons disabled={isLoading} actionLabel="Login" />

        <p className="text-center text-sm text-[var(--color-muted)]">
          Don&apos;t have an account?{" "}
          <Link
            href="/register"
            className="text-[var(--hm-accent)] underline-offset-2 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </AuthCard>
  );
}
