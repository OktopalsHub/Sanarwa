"use client";

import { AuthDivider } from "@/components/auth/auth-page-shell";
import { AuthOAuthButtons } from "@/components/auth/auth-oauth-buttons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { redirectAfterAuth } from "@/lib/auth/post-auth-redirect";
import { getTenantPathSegment } from "@/lib/tenant-path";
import { RegisterCredentials } from "@/lib/types/auth";
import { toastApiError } from "@/lib/utils/api-error-message";
import { formatTokens, WELCOME_SIGNUP_TOKENS } from "@/lib/pricing";
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

export function RegisterForm({ variant = "standalone" }: { variant?: "standalone" | "dual" }) {
  const router = useRouter();
  const { register, isLoading } = useAuth();

  const [formData, setFormData] = useState<RegisterCredentials>({
    firstName: "",
    lastName: "",
    email: "",
    password: "",
    confirmPassword: "",
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
    } else if (formData.password.length < 8) {
      errors.password = "Use at least 8 characters";
    } else if (!/(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/.test(formData.password)) {
      errors.password = "Include uppercase, lowercase, and a number";
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
      const registrationData = {
        ...formData,
        firstName: formData.firstName || "User",
        lastName: formData.lastName || "Account",
      };

      const response = await register(registrationData);

      if (response.tenant) {
        router.push(`/${getTenantPathSegment(response.tenant)}/dashboard`);
        return;
      }

      if (response.tenantSlug) {
        router.push(`/${response.tenantSlug}/dashboard`);
        return;
      }

      await redirectAfterAuth(router);
    } catch (err) {
      toastApiError(err, "Could not create your account");
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

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
          Create account
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-muted)]">
          Includes {formatTokens(WELCOME_SIGNUP_TOKENS)} free tokens. No credit card required.
        </p>
      </header>

      <AuthOAuthButtons disabled={isLoading} actionLabel="Sign up" />

      <AuthDivider label="Or use email" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="email">Work email</FieldLabel>
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
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="new-password"
              value={formData.password}
              onChange={handleInputChange}
              placeholder="8+ characters"
              disabled={isLoading}
              aria-invalid={!!formErrors.password}
              aria-describedby="password-hint"
              className={inputClass}
            />
            <p id="password-hint" className="text-[11px] text-[var(--color-muted)]">
              Uppercase, lowercase, and a number
            </p>
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
          {isLoading ? "Creating account…" : "Create account"}
        </Button>
      </form>

      {variant === "standalone" && (
        <p className="hidden text-center text-sm text-[var(--color-muted)] lg:block">
          Have an account?{" "}
          <Link
            href="/login"
            className="font-medium text-[var(--color-ink)] underline-offset-2 hover:text-[var(--hm-accent)] hover:underline"
          >
            Sign in
          </Link>
        </p>
      )}
    </div>
  );
}
