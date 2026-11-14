"use client";

import { AuthDivider } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { AuthOAuthButtons } from "@/components/auth/auth-oauth-buttons";
import { Button } from "@sanarwa/ui/button";
import { Input } from "@sanarwa/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { redirectAfterAuth } from "@/lib/auth/post-auth-redirect";
import { LoginCredentials } from "@/lib/types/auth";
import { toastApiError } from "@/lib/utils/api-error-message";
import Link from "@/compat/next-link";
import { useRouter } from "@/compat/next-navigation";
import { useState } from "react";

export function LoginForm() {
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

  return (
    <div className="flex flex-col gap-5">
      <AuthOAuthButtons disabled={isLoading} actionLabel="Login" />

      <AuthDivider label="or" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Email" htmlFor="email" error={formErrors.email}>
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
          />
        </FormField>

        <FormField
          label="Password"
          htmlFor="password"
          error={formErrors.password}
          action={
            <Link
              href="/forgot-password"
              className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
            >
              Forgot password?
            </Link>
          }
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={formData.password}
            onChange={handleInputChange}
            disabled={isLoading}
            aria-invalid={!!formErrors.password}
          />
        </FormField>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Signing in…" : "Sign in"}
        </Button>
      </form>
    </div>
  );
}
