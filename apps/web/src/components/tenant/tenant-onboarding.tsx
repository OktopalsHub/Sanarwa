"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useTenant } from "@/contexts/tenant-context";
import { getTenantPathSegment } from "@/lib/tenant-path";
import { CreateTenantRequest } from "@/lib/types/tenant";
import { toastApiError } from "@/lib/utils/api-error-message";
import { IconArrowRight, IconBuilding } from "@tabler/icons-react";
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

interface TenantOnboardingProps {
  onComplete?: () => void;
}

export function TenantOnboarding({ onComplete }: TenantOnboardingProps) {
  const router = useRouter();
  const { tenants, createTenant, switchTenant, isLoading } = useTenant();
  const [step, setStep] = useState<"select" | "create">("select");
  const [formData, setFormData] = useState<CreateTenantRequest>({
    name: "",
    subdomain: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const inputClass =
    "h-11 rounded-[var(--radius-input)] border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-[var(--dur-micro)] ease-[var(--ease-out)] placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/25";

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

  const validateForm = (): boolean => {
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

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateForm()) return;

    try {
      const payload: CreateTenantRequest = {
        name: formData.name.trim(),
        ...(formData.subdomain?.trim() ? { subdomain: formData.subdomain.trim() } : {}),
      };
      const tenant = await createTenant(payload);
      await switchTenant(tenant.id);
      onComplete?.();
      router.push(`/${getTenantPathSegment(tenant)}/dashboard`);
    } catch (error) {
      toastApiError(error, "Could not create workspace");
    }
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
      <div className="flex flex-col gap-6">
        <header className="space-y-1.5">
          <h2
            className="font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold leading-tight tracking-[var(--tracking-display)] text-[var(--color-ink)]"
            style={{ fontStyle: "normal" }}
          >
            Choose a workspace
          </h2>
          <p className="text-sm leading-relaxed text-[var(--color-muted)]">
            Open an existing team or create a new workspace.
          </p>
        </header>

        <ul className="flex flex-col gap-2">
          {tenants.map((tenant) => (
            <li key={tenant.id}>
              <button
                type="button"
                onClick={() => handleSelectExisting(tenant.id)}
                disabled={isLoading}
                className="flex w-full min-h-11 items-center justify-between gap-3 rounded-[var(--radius-input)] border border-[var(--color-rule)] bg-[var(--color-paper-2)] px-4 py-3 text-left shadow-[var(--shadow-card)] transition-colors duration-[var(--dur-micro)] ease-[var(--ease-out)] hover:border-[var(--color-rule-2)] hover:bg-[var(--color-paper-3)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] disabled:opacity-50"
              >
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-[var(--radius-input)] border border-[var(--color-rule)] bg-[var(--color-paper)]">
                    <IconBuilding className="size-4 text-[var(--color-muted)]" aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[var(--color-ink)]">
                      {tenant.name}
                    </span>
                    <span className="block truncate font-mono text-xs text-[var(--color-muted)]">
                      /{getTenantPathSegment(tenant)}
                    </span>
                  </span>
                </span>
                <IconArrowRight className="size-4 shrink-0 text-[var(--color-muted)]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <div className="relative py-1">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-[var(--color-rule)]" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-[var(--color-paper)] px-3 text-xs text-[var(--color-muted)]">
              Or
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="h-11 w-full rounded-[var(--radius-input)] border-[var(--color-rule)]"
          onClick={() => setStep("create")}
          disabled={isLoading}
        >
          Create new workspace
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="space-y-1.5">
        <h2
          className="font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold leading-tight tracking-[var(--tracking-display)] text-[var(--color-ink)]"
          style={{ fontStyle: "normal" }}
        >
          Create workspace
        </h2>
        <p className="text-sm leading-relaxed text-[var(--color-muted)]">
          This name and URL slug identify your team inside Sanarwa.
        </p>
      </header>

      <form onSubmit={handleCreateTenant} className="flex flex-col gap-4" noValidate>
        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="name">Workspace name</FieldLabel>
          <Input
            id="name"
            name="name"
            type="text"
            value={formData.name}
            onChange={handleInputChange}
            placeholder="Acme Inc"
            disabled={isLoading}
            aria-invalid={!!formErrors.name}
            className={inputClass}
          />
          {formErrors.name && (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {formErrors.name}
            </p>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          <FieldLabel htmlFor="subdomain">Workspace URL</FieldLabel>
          <Input
            id="subdomain"
            name="subdomain"
            type="text"
            value={formData.subdomain}
            onChange={handleInputChange}
            placeholder="acme"
            disabled={isLoading}
            aria-invalid={!!formErrors.subdomain}
            className={inputClass}
          />
          {formErrors.subdomain && (
            <p className="text-sm text-[var(--color-danger)]" role="alert">
              {formErrors.subdomain}
            </p>
          )}
          <p className="text-[11px] text-[var(--color-muted)]">
            Opens at /{formData.subdomain || "your-workspace"}/dashboard
          </p>
        </div>

        <Button
          type="submit"
          size="lg"
          disabled={isLoading}
          className="h-11 w-full rounded-[var(--radius-input)] bg-[var(--hm-accent)] font-semibold text-[var(--color-accent-ink)] shadow-[var(--shadow-card)] transition-opacity duration-[var(--dur-micro)] ease-[var(--ease-out)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 active:translate-y-px disabled:opacity-50"
        >
          {isLoading ? "Creating…" : "Create workspace"}
        </Button>
      </form>

      {tenants.length > 0 && (
        <Button
          type="button"
          variant="ghost"
          className="h-11 w-full"
          onClick={() => setStep("select")}
          disabled={isLoading}
        >
          Back to workspace list
        </Button>
      )}
    </div>
  );
}
