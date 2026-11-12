"use client";

import { Button } from "@sanarwa/ui/button";
import { Input } from "@sanarwa/ui/input";
import { AuthSplitShell, SplitPanel } from "@/components/auth/auth-split-shell";
import { MemberCardPreview } from "@/components/auth/member-card-preview";
import { useAuth } from "@/contexts/auth-context";
import { useTenant } from "@/contexts/tenant-context";
import { getTenantPathSegment } from "@/lib/tenant-path";
import { authClient } from "@/lib/better-auth-client";
import { CreateTenantRequest } from "@/lib/types/tenant";
import { toastApiError } from "@/lib/utils/api-error-message";
import { IconArrowRight, IconBuilding, IconCheck } from "@tabler/icons-react";
import { useRouter } from "@/compat/next-navigation";
import Link from "@/compat/next-link";
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

const inputClass =
  "h-11 rounded-[var(--radius-input)] border-[var(--color-rule)] bg-[var(--color-paper-2)] text-[var(--color-ink)] shadow-[var(--shadow-card)] transition-[border-color,box-shadow] duration-[var(--dur-micro)] ease-[var(--ease-out)] placeholder:text-[var(--color-muted)] focus-visible:border-[var(--color-focus)] focus-visible:ring-2 focus-visible:ring-[var(--color-focus)]/25";

const ctaClass =
  "h-12 w-full rounded-full bg-[var(--hm-accent)] font-mono text-[12px] font-bold uppercase tracking-[0.14em] text-[var(--color-accent-ink)] transition-opacity duration-[var(--dur-micro)] ease-[var(--ease-out)] hover:opacity-90 focus-visible:ring-2 focus-visible:ring-[var(--color-focus)] focus-visible:ring-offset-2 active:translate-y-px disabled:opacity-50";

export function TenantOnboarding({ onComplete }: TenantOnboardingProps) {
  const router = useRouter();
  const { tenants, createTenant, switchTenant, isLoading } = useTenant();
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
                  <IconBuilding className="size-5 shrink-0 text-[var(--color-muted)]" aria-hidden />
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate font-medium text-[var(--color-ink)]">
                      {tenant.name}
                    </span>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-[var(--color-muted)]">
                      {getTenantPathSegment(tenant)}
                    </span>
                  </span>
                </span>
                <IconArrowRight className="size-4 shrink-0 text-[var(--color-muted)]" aria-hidden />
              </button>
            </li>
          ))}
        </ul>

        <button
          type="button"
          onClick={() => setStep(1)}
          disabled={isLoading}
          className="group flex min-h-11 w-full items-center justify-between gap-3 rounded-[var(--radius-input)] border border-dashed border-[var(--color-rule-2)] px-4 py-3 text-left transition-colors duration-[var(--dur-micro)] ease-[var(--ease-out)] hover:border-[var(--color-ink)] disabled:opacity-50"
        >
          <span className="text-sm font-medium text-[var(--color-ink)]">
            Create a new workspace
          </span>
          <IconArrowRight
            className="size-4 text-[var(--color-muted)] transition-transform duration-[var(--dur-micro)] ease-[var(--ease-out)] group-hover:translate-x-0.5"
            aria-hidden
          />
        </button>
      </div>
    );
  }

  const panel = (
    <AuthSplitShell
      panel={
        <SplitPanel
          eyebrow="Sanarwa · Set up"
          headline={
            step === 1 ? (
              <>
                NAME THE
                <br />
                <span className="text-[var(--hm-accent)]">WORKSPACE.</span>
              </>
            ) : (
              <>
                MAKE YOUR
                <br />
                <span className="text-[var(--hm-accent)]">PROFILE.</span>
              </>
            )
          }
          sub="One workspace per team. Your URL becomes the home for campaigns, messages and billing."
          sticker={<MemberCardPreview name={displayName} orgName={orgName} />}
          chips={[]}
          footnote="You can change this later in settings"
          switchTo={
            <Link
              href="/login"
              className="text-[var(--hm-accent)] underline-offset-2 hover:underline"
            >
              Sign in
            </Link>
          }
        />
      }
    >
      {step === 1 ? (
        <form onSubmit={handleCreateOrg} className="flex w-full flex-col gap-6">
          <ProgressSteps step={1} />
          <header className="space-y-1.5">
            <h1
              className="font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold leading-tight tracking-[var(--tracking-display)] text-[var(--color-ink)]"
              style={{ fontStyle: "normal" }}
            >
              Name the workspace<span className="text-[var(--hm-accent)]">.</span>
            </h1>
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
              You can rename it later. The URL slug can&apos;t change once set.
            </p>
          </header>

          <div className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <FieldLabel htmlFor="name">Workspace name</FieldLabel>
              <Input
                id="name"
                name="name"
                autoComplete="organization"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Payload Lab"
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
                autoComplete="off"
                value={formData.subdomain}
                onChange={handleInputChange}
                placeholder="payload-lab"
                disabled={isLoading}
                aria-invalid={!!formErrors.subdomain}
                className={inputClass}
              />
              {formErrors.subdomain ? (
                <p className="text-sm text-[var(--color-danger)]" role="alert">
                  {formErrors.subdomain}
                </p>
              ) : (
                <p className="text-xs text-[var(--color-muted)]">
                  Opens at /{formData.subdomain || "your-workspace"}/dashboard
                </p>
              )}
            </div>
          </div>

          <Button type="submit" size="lg" disabled={isLoading} className={ctaClass}>
            {isLoading ? "Creating…" : "Continue to profile"}
            {!isLoading && <IconArrowRight className="size-5" aria-hidden />}
          </Button>
        </form>
      ) : (
        <form onSubmit={handleEnterDashboard} className="flex w-full flex-col gap-6">
          <ProgressSteps step={2} />
          <header className="space-y-1.5">
            <h1
              className="font-[family-name:var(--font-display)] text-[length:var(--text-2xl)] font-bold leading-tight tracking-[var(--tracking-display)] text-[var(--color-ink)]"
              style={{ fontStyle: "normal" }}
            >
              Make your profile<span className="text-[var(--hm-accent)]">.</span>
            </h1>
            <p className="text-sm leading-relaxed text-[var(--color-muted)]">
              This is how teammates see you inside {orgName || "this workspace"}: on the member list
              and in the org switcher.
            </p>
          </header>

          <div className="flex flex-col gap-1.5">
            <FieldLabel htmlFor="displayName">Display name</FieldLabel>
            <Input
              id="displayName"
              name="displayName"
              autoComplete="name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Daniel Agbey"
              disabled={isLoading}
              className={inputClass}
            />
          </div>

          <Button type="submit" size="lg" disabled={isLoading} className={ctaClass}>
            {isLoading ? "Saving…" : "Enter dashboard"}
            {!isLoading && <IconArrowRight className="size-5" aria-hidden />}
          </Button>
        </form>
      )}
    </AuthSplitShell>
  );

  return panel;
}

function ProgressSteps({ step }: { step: 1 | 2 }) {
  const steps = [
    { number: "01", label: "Organization" },
    { number: "02", label: "Your profile" },
  ] as const;

  return (
    <ol className="flex items-center gap-2" aria-label="Onboarding progress">
      {steps.map((item, index) => {
        const n = (index + 1) as 1 | 2;
        const active = n === step;
        const done = n < step;
        return (
          <li key={item.number} className="flex items-center gap-2">
            <span
              aria-current={active ? "step" : undefined}
              className="flex items-center gap-2 rounded-full px-3 py-1.5 font-mono text-[11px] font-medium uppercase tracking-[0.18em]"
              style={
                done
                  ? { background: "var(--color-ink)", color: "var(--color-paper)" }
                  : active
                    ? { background: "var(--color-ink)", color: "var(--color-paper)" }
                    : { border: "1px solid var(--color-rule-2)", color: "var(--color-muted)" }
              }
            >
              {done ? <IconCheck className="size-3.5" aria-hidden /> : item.number} {item.label}
            </span>
            {index < steps.length - 1 ? (
              <span className="h-px w-6 bg-[var(--color-rule-2)]" aria-hidden />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
