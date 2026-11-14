"use client";

import { Button } from "@sanarwa/ui/button";
import { Input } from "@sanarwa/ui/input";
import { AuthLayout, AuthLink } from "@/components/auth/auth-layout";
import { FormField } from "@/components/auth/form-field";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { getTenantPathSegment } from "@/lib/tenant-path";
import { authClient } from "@/lib/better-auth-client";
import { CreateTenantRequest } from "@/lib/types/tenant";
import { toastApiError } from "@/lib/utils/api-error-message";
import { IconArrowRight, IconBuilding } from "@tabler/icons-react";
import { useRouter } from "@/compat/next-navigation";
import { useState } from "react";

interface TenantOnboardingProps {
  onComplete?: () => void;
}

export function TenantOnboarding({ onComplete }: TenantOnboardingProps) {
  const router = useRouter();
  const { tenants, createTenant, switchTenant } = useTenant();
  const [submitting, setSubmitting] = useState(false);
  const { user } = useAuth();
  const [step, setStep] = useState<"select" | 1 | 2>(tenants.length > 0 ? "select" : 1);
  const [orgName, setOrgName] = useState("");
  const [orgSlug, setOrgSlug] = useState("");
  const [displayName, setDisplayName] = useState(user?.name ?? "");
  const [formData, setFormData] = useState<CreateTenantRequest>({ name: "", subdomain: "" });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleSelectExisting = async (tenantId: string) => {
    try {
      await switchTenant(tenantId);
      onComplete?.();
      const selected = tenants.find((t) => t.id === tenantId);
      if (selected) {
        router.push(`/${getTenantPathSegment(selected)}/dashboard`);
      }
    } catch (error) {
      toastApiError(error, "Could not open that workspace");
    }
  };

  const validateOrgForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Workspace name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Use at least 2 characters";
    }

    if (formData.subdomain && !/^[a-z0-9-]+$/.test(formData.subdomain)) {
      errors.subdomain = "Use lowercase letters, numbers, and hyphens only";
    } else if (formData.subdomain && formData.subdomain.length < 3) {
      errors.subdomain = "URL slug must be at least 3 characters";
    }

    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toastApiError(new Error(Object.values(errors)[0]!), "Check the highlighted fields");
    }
    return Object.keys(errors).length === 0;
  };

  const handleCreateOrg = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateOrgForm()) return;

    setSubmitting(true);
    try {
      const tenant = await createTenant({
        name: formData.name.trim(),
        ...(formData.subdomain?.trim() ? { subdomain: formData.subdomain.trim() } : {}),
      });
      await switchTenant(tenant.id);
      setOrgName(tenant.name);
      setOrgSlug(getTenantPathSegment(tenant));
      setStep(2);
    } catch (error) {
      toastApiError(error, "Could not create workspace");
    } finally {
      setSubmitting(false);
    }
  };

  const handleEnterDashboard = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = displayName.trim();
    if (trimmed.length < 2) {
      toastApiError(new Error("Use at least 2 characters"), "Check the name field");
      return;
    }

    try {
      await authClient.updateUser({ name: trimmed });
    } catch (error) {
      toastApiError(error, "Could not save your name");
    }

    onComplete?.();
    router.push(orgSlug ? `/${orgSlug}/dashboard` : "/dashboard");
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));

    if (name === "name" && !formData.subdomain) {
      const subdomain = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");
      setFormData((prev) => ({ ...prev, subdomain }));
    }

    if (formErrors[name]) {
      setFormErrors((prev) => ({ ...prev, [name]: "" }));
    }
  };

  if (step === "select" && tenants.length > 0) {
    return (
      <AuthLayout
        title="Choose a workspace"
        description="Open an existing workspace or create a new one."
      >
        <ul className="flex flex-col gap-2">
          {tenants.map((tenant) => (
            <li key={tenant.id}>
              <button
                type="button"
                onClick={() => handleSelectExisting(tenant.id)}
                disabled={submitting}
                className="flex w-full items-center justify-between gap-3 rounded-lg border bg-background px-4 py-3 text-left transition-colors hover:bg-accent disabled:opacity-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <IconBuilding className="size-5 shrink-0 text-muted-foreground" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate text-sm font-medium">{tenant.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                      {getTenantPathSegment(tenant)}
                    </span>
                  </span>
                </span>
                <IconArrowRight className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
        <Button
          type="button"
          variant="outline"
          className="mt-4 w-full"
          onClick={() => setStep(1)}
          disabled={submitting}
        >
          Create a new workspace
        </Button>
      </AuthLayout>
    );
  }

  if (step === 2) {
    return (
      <AuthLayout
        title="What should we call you?"
        description={`Teammates will see this name in ${orgName || "your workspace"}.`}
        footer="Step 2 of 2"
      >
        <form onSubmit={handleEnterDashboard} className="flex flex-col gap-4">
          <FormField label="Your name" htmlFor="displayName">
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Amaka Obi"
              disabled={submitting}
            />
          </FormField>
          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Saving…" : "Open my workspace"}
          </Button>
        </form>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout
      title="Create your workspace"
      description="A workspace is where your team manages messages, API keys and billing."
      footer={
        <>
          Step 1 of 2 · Wrong account? <AuthLink href="/login">Sign in</AuthLink>
        </>
      }
    >
      <form onSubmit={handleCreateOrg} className="flex flex-col gap-4">
        <FormField label="Workspace name" htmlFor="name" error={formErrors.name}>
          <Input
            id="name"
            name="name"
            autoComplete="organization"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Payload Lab"
            disabled={submitting}
            aria-invalid={!!formErrors.name}
          />
        </FormField>

        <FormField
          label="Workspace URL"
          htmlFor="subdomain"
          error={formErrors.subdomain}
          hint={`Opens at /${formData.subdomain || "your-workspace"}/dashboard`}
        >
          <Input
            id="subdomain"
            name="subdomain"
            autoComplete="off"
            value={formData.subdomain}
            onChange={handleInputChange}
            placeholder="payload-lab"
            disabled={submitting}
            aria-invalid={!!formErrors.subdomain}
          />
        </FormField>

        <Button type="submit" disabled={submitting} className="w-full">
          {submitting ? "Creating…" : "Continue"}
        </Button>
      </form>
    </AuthLayout>
  );
}
