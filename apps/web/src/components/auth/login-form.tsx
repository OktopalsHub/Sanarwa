"use client";

import { AuthDivider } from "@/components/auth/auth-page-shell";
import { AuthOAuthButtons } from "@/components/auth/auth-oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { redirectAfterAuth } from "@/lib/auth/post-auth-redirect";
import { LoginCredentials } from "@/lib/types/auth";
import { toastApiError } from "@/lib/utils/api-error-message";
import Link from "@/compat/next-link";
import { useRouter } from "@/compat/next-navigation";
import { useState } from "react";

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: React.ReactNode }) {
  return (
    <label
      htmlFor={htmlFor}
      className="font-mono text-[11px] font-medium uppercase tracking-[var(--tracking-label)] text-[var(--color-muted)]"
    >
      {children}
    </label>
  );
}

export function LoginForm({ variant = "standalone" }: { variant?: "standalone" | "dual" }) {
  const router = useRouter();
  const { login, isLoading } = useAuth();

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
      errors.email = "Enter a valid email address";
    }

    if (!formData.password) {
      errors.password = "Password is required";
    } else if (formData.password.length < 6) {
      errors.password = "Password must be at least 6 characters";
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toastApiError(new Error(Object.values(errors)[0]!), "Check the highlighted fields");
    }
    return Object.keys(errors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      await login(formData);
      await redirectAfterAuth(router);
    } catch (err) {
      toastApiError(err, "Sign in failed");
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

  const inputClass =
    "h-11 rounded-[var(--radius-input)] border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-[var(--dur-micro)] ease-[var(--ease-out)] placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/25";

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1.5">
        <h2
          className="font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold leading-tight tracking-[var(--tracking-display)] text-[var(--color-ink)]"
          style={{ fontStyle: "normal" }}
        >
          Sign in
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-muted)]">
          Use your work email to open your workspace dashboard.
        </p>
      </header>

      <AuthOAuthButtons disabled={isLoading} actionLabel="Login" />

      <AuthDivider label="Or use email" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="email">Email</FieldLabel>
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={formData.email}
              onChange={handleInputChange}
              placeholder="you@company.com"
              disabled={isLoading}
              aria-invalid={!!formErrors.email}
              className={inputClass}
            />
            {formErrors.email && (
              <p className="text-sm text-[var(--color-danger)]" role="alert">
                {formErrors.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between gap-2">
              <FieldLabel htmlFor="password">Password</FieldLabel>
              <Link
                href="/forgot-password"
                className="text-[11px] text-[var(--color-muted)] underline-offset-2 hover:text-[var(--hm-accent)] hover:underline"
              >
                Forgot password?
              </Link>
            </div>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="Your password"
              disabled={isLoading}
              aria-invalid={!!formErrors.password}
              className={inputClass}
            />
            {formErrors.password && (
              <p className="text-sm text-[var(--color-danger)]" role="alert">
                {formErrors.password}
              </p>
            )}
          </div>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="h-11 w-full rounded-[var(--radius-input)] bg-[var(--hm-accent)] font-semibold text-[var(--color-accent-ink)] shadow-[var(--shadow-card)] transition-opacity duration-[var(--dur-micro)] ease-[var(--ease-out)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 active:translate-y-px disabled:opacity-50"
        >
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>

      {variant === "standalone" && (
        <p className="hidden text-center text-sm text-[var(--color-muted)] lg:block">
          No account?{" "}
          <Link
            href="/register"
            className="font-medium text-[var(--color-ink)] underline-offset-2 hover:text-[var(--hm-accent)] hover:underline"
          >
            Create one
          </Link>
        </p>
      )}
    </div>
  );
}
