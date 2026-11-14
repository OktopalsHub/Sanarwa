"use client";

import { AuthDivider } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { AuthOAuthButtons } from "@/components/auth/auth-oauth-buttons";
import { Button } from "@sanarwa/ui/button";
import { Input } from "@sanarwa/ui/input";
import { useAuth } from "@/contexts/auth-context";
import { redirectAfterAuth } from "@/lib/auth/post-auth-redirect";
import { getTenantPathSegment } from "@/lib/tenant-path";
import { RegisterCredentials } from "@/lib/types/auth";
import { toastApiError } from "@/lib/utils/api-error-message";
import { useRouter } from "@/compat/next-navigation";
import { useState } from "react";

export function RegisterForm() {
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

      const response = (await register(registrationData)) as any;

      if (response?.tenant) {
        router.push(`/${getTenantPathSegment(response.tenant)}/dashboard`);
        return;
      }

      if (response?.tenantSlug) {
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

  return (
    <div className="flex flex-col gap-5">
      <AuthOAuthButtons disabled={isLoading} actionLabel="Sign up" />

      <AuthDivider label="or" />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <FormField label="Work email" htmlFor="email" error={formErrors.email}>
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
          hint="At least 8 characters."
        >
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="new-password"
            value={formData.password}
            onChange={handleInputChange}
            disabled={isLoading}
            aria-invalid={!!formErrors.password}
          />
        </FormField>

        <Button type="submit" disabled={isLoading} className="w-full">
          {isLoading ? "Creating account…" : "Create account"}
        </Button>
      </form>
    </div>
  );
}
