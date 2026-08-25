"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTenant } from "@/contexts/tenant-context";
import { CreateTenantRequest } from "@/lib/types/tenant";
import { ArrowRightIcon, BuildingOfficeIcon } from "@heroicons/react/24/outline";
import { useRouter } from "@/compat/next-navigation";
import { useState } from "react";

interface TenantOnboardingProps {
  onComplete?: () => void;
}

export function TenantOnboarding({ onComplete }: TenantOnboardingProps) {
  const router = useRouter();
  const { tenants, createTenant, switchTenant, isLoading } = useTenant();
  const [step, setStep] = useState<"select" | "create">("select");
  const [formData, setFormData] = useState<CreateTenantRequest>({
    name: "",
    slug: "",
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});

  const handleSelectExisting = async (tenantId: string) => {
    try {
      await switchTenant(tenantId);
      onComplete?.();
      const selected = tenants.find((t) => t.id === tenantId);
      if (selected) {
        router.push(`/${selected.slug || selected.subdomain || selected.id}/dashboard`);
      }
    } catch (error) {
      console.error("Failed to select tenant:", error);
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (!formData.name.trim()) {
      errors.name = "Organization name is required";
    } else if (formData.name.trim().length < 2) {
      errors.name = "Organization name must be at least 2 characters";
    }

    if (formData.slug && !/^[a-z0-9-]+$/.test(formData.slug)) {
      errors.slug = "Slug can only contain lowercase letters, numbers, and hyphens";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateTenant = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      const tenant = await createTenant(formData);
      await switchTenant(tenant.id);
      onComplete?.();
      router.push(`/${tenant.slug || tenant.subdomain || tenant.id}/dashboard`);
    } catch (error) {
      console.error("Failed to create tenant:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));

    // Auto-generate slug from name
    if (name === "name" && !formData.slug) {
      const slug = value
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, "")
        .replace(/\s+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "");

      setFormData((prev) => ({
        ...prev,
        slug,
      }));
    }

    // Clear field error when user starts typing
    if (formErrors[name]) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: "",
      }));
    }
  };

  if (step === "select" && tenants.length > 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Card className="w-full max-w-md p-6">
          <div className="space-y-6">
            <div className="text-center">
              <BuildingOfficeIcon className="w-12 h-12 mx-auto mb-4 text-primary" />
              <h1 className="text-2xl font-bold">Welcome to Sanarwa</h1>
              <p className="text-muted-foreground">
                Select an organization to continue or create a new one
              </p>
            </div>

            <div className="space-y-3">
              {tenants.map((tenant) => (
                <button
                  key={tenant.id}
                  onClick={() => handleSelectExisting(tenant.id)}
                  disabled={isLoading}
                  className="w-full p-4 text-left border rounded-lg hover:bg-accent hover:text-accent-foreground transition-colors disabled:opacity-50"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium">{tenant.name}</div>
                      <div className="text-sm text-muted-foreground">{tenant.slug}</div>
                    </div>
                    <ArrowRightIcon className="h-4 w-4" />
                  </div>
                </button>
              ))}
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or</span>
              </div>
            </div>

            <Button
              onClick={() => setStep("create")}
              variant="outline"
              className="w-full"
              disabled={isLoading}
            >
              Create new organization
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Card className="w-full max-w-md p-6">
        <div className="space-y-6">
          <div className="text-center">
            <BuildingOfficeIcon className="w-12 h-12 mx-auto mb-4 text-primary" />
            <h1 className="text-2xl font-bold">Create your organization</h1>
            <p className="text-muted-foreground">
              Set up your organization to start managing communications
            </p>
          </div>

          <form onSubmit={handleCreateTenant} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Organization Name</Label>
              <Input
                id="name"
                name="name"
                type="text"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Enter your organization name"
                disabled={isLoading}
                aria-invalid={!!formErrors.name}
                aria-describedby={formErrors.name ? "name-error" : undefined}
              />
              {formErrors.name && (
                <p id="name-error" className="text-sm text-destructive">
                  {formErrors.name}
                </p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Organization Slug</Label>
              <Input
                id="slug"
                name="slug"
                type="text"
                value={formData.slug}
                onChange={handleInputChange}
                placeholder="organization-slug"
                disabled={isLoading}
                aria-invalid={!!formErrors.slug}
                aria-describedby={formErrors.slug ? "slug-error" : undefined}
              />
              {formErrors.slug && (
                <p id="slug-error" className="text-sm text-destructive">
                  {formErrors.slug}
                </p>
              )}
              <p className="text-xs text-muted-foreground">
                This will be used in your organization's URL
              </p>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? "Creating..." : "Create organization"}
            </Button>
          </form>

          {tenants.length > 0 && (
            <Button
              onClick={() => setStep("select")}
              variant="ghost"
              className="w-full"
              disabled={isLoading}
            >
              Back to organization selection
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
