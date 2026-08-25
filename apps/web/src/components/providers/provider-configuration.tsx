"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { providerApi } from "@/lib/api/provider";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { useForm } from "react-hook-form";
import { Provider, UpdateProviderRequest } from "@/lib/types/provider";
import { toast } from "sonner";
import {
  BookmarkIcon,
  EyeIcon,
  EyeSlashIcon,
  ExclamationTriangleIcon,
} from "@heroicons/react/24/outline";

interface ProviderConfigurationProps {
  provider: Provider;
}

export function ProviderConfiguration({ provider }: ProviderConfigurationProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showSecrets, setShowSecrets] = useState<Record<string, boolean>>({});

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UpdateProviderRequest>({
    defaultValues: {
      name: provider.name,
      description: provider.description || "",
      priority: provider.priority,
      isDefault: provider.isDefault,
      config: provider.config || {},
    },
  });

  const updateProviderMutation = useMutation({
    mutationFn: (data: UpdateProviderRequest) => providerApi.updateProvider(provider.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["provider", provider.id] });
      toast.success("Provider configuration updated successfully");
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to update provider configuration");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: UpdateProviderRequest) => {
    setIsSubmitting(true);
    updateProviderMutation.mutate(data);
  };

  const toggleSecretVisibility = (fieldName: string) => {
    setShowSecrets((prev) => ({
      ...prev,
      [fieldName]: !prev[fieldName],
    }));
  };

  const getConfigTemplate = () => {
    return providerApi.getProviderConfigTemplate(provider.type, provider.subtype);
  };

  const template = getConfigTemplate();
  const isDefaultProvider = watch("isDefault");

  const renderConfigField = (fieldName: string, isRequired: boolean = false) => {
    const isSecret =
      fieldName.toLowerCase().includes("secret") ||
      fieldName.toLowerCase().includes("key") ||
      fieldName.toLowerCase().includes("token") ||
      fieldName.toLowerCase().includes("password");

    const credentials = provider.config?.credentials as unknown as {
      config?: Record<string, unknown>;
    };
    const fieldValue = String(credentials?.config?.[fieldName] ?? "");
    const displayValue =
      isSecret && !showSecrets[fieldName]
        ? "•".repeat(Math.min(fieldValue.length, 20))
        : fieldValue;

    return (
      <div key={fieldName} className="space-y-2">
        <Label htmlFor={fieldName} className="flex items-center gap-2">
          {fieldName.replace(/([A-Z])/g, " $1").replace(/^./, (str) => str.toUpperCase())}
          {isRequired && <span className="text-destructive">*</span>}
        </Label>
        <div className="flex gap-2">
          <Input
            id={fieldName}
            type={isSecret && !showSecrets[fieldName] ? "password" : "text"}
            placeholder={`Enter ${fieldName}`}
            value={displayValue}
            {...(register as (name: string, options?: object) => ReturnType<typeof register>)(
              `config.credentials.config.${fieldName}`,
              {
                required: isRequired ? `${fieldName} is required` : false,
              },
            )}
            disabled={isSubmitting}
          />
          {isSecret && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => toggleSecretVisibility(fieldName)}
            >
              {showSecrets[fieldName] ? (
                <EyeSlashIcon className="h-4 w-4" />
              ) : (
                <EyeIcon className="h-4 w-4" />
              )}
            </Button>
          )}
        </div>
        {(errors.config as { credentials?: { config?: Record<string, { message?: string }> } })
          ?.credentials?.config?.[fieldName] && (
          <p className="text-sm text-destructive">
            {
              (errors.config as { credentials?: { config?: Record<string, { message?: string }> } })
                .credentials?.config?.[fieldName]?.message
            }
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Settings</CardTitle>
            <CardDescription>
              Update your provider's basic information and configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Provider Name</Label>
              <Input
                id="name"
                {...register("name", {
                  required: "Provider name is required",
                  minLength: {
                    value: 2,
                    message: "Provider name must be at least 2 characters",
                  },
                })}
                disabled={isSubmitting}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input id="description" {...register("description")} disabled={isSubmitting} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                max="100"
                {...register("priority", {
                  valueAsNumber: true,
                  min: { value: 0, message: "Priority must be at least 0" },
                  max: { value: 100, message: "Priority must be at most 100" },
                })}
                disabled={isSubmitting}
              />
              {errors.priority && (
                <p className="text-sm text-destructive">{errors.priority.message}</p>
              )}
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="isDefault">Set as Default Provider</Label>
                <p className="text-sm text-muted-foreground">
                  Use this provider as the default for {provider.type} notifications
                </p>
              </div>
              <Switch
                id="isDefault"
                checked={isDefaultProvider}
                onCheckedChange={(checked) => setValue("isDefault", checked)}
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>

        {/* Provider Credentials */}
        <Card>
          <CardHeader>
            <CardTitle>Provider Credentials</CardTitle>
            <CardDescription>
              Configure the authentication credentials for {provider.subtype}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Required Fields */}
            {template.requiredFields.length > 0 && (
              <div className="space-y-4">
                <h4 className="font-medium text-sm">Required Configuration</h4>
                {template.requiredFields.map((field) => renderConfigField(field, true))}
              </div>
            )}

            {/* Optional Fields */}
            {template.optionalFields.length > 0 && (
              <>
                <Separator />
                <div className="space-y-4">
                  <h4 className="font-medium text-sm">Optional Configuration</h4>
                  {template.optionalFields.map((field) => renderConfigField(field, false))}
                </div>
              </>
            )}

            {/* Configuration Example */}
            {template.example && (
              <>
                <Separator />
                <div className="space-y-2">
                  <h4 className="font-medium text-sm">Example Configuration</h4>
                  <div className="bg-muted p-3 rounded-md">
                    <pre className="text-xs overflow-x-auto">
                      {JSON.stringify(template.example, null, 2)}
                    </pre>
                  </div>
                  {template.documentation && (
                    <p className="text-xs text-muted-foreground">
                      For more information, see the{" "}
                      <a
                        href={template.documentation}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline"
                      >
                        official documentation
                      </a>
                    </p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            <BookmarkIcon className="h-4 w-4 mr-2" />
            {isSubmitting ? "Saving..." : "Save Configuration"}
          </Button>
        </div>
      </form>

      <Separator />

      {/* Danger Zone */}
      <Card className="border-destructive">
        <CardHeader>
          <CardTitle className="text-destructive flex items-center gap-2">
            <ExclamationTriangleIcon className="h-5 w-5" />
            Danger Zone
          </CardTitle>
          <CardDescription>Irreversible and destructive actions for this provider.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg">
            <div>
              <h4 className="font-medium">Deactivate Provider</h4>
              <p className="text-sm text-muted-foreground">
                Temporarily disable this provider. It can be reactivated later.
              </p>
            </div>
            <Button variant="outline" size="sm">
              Deactivate
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg">
            <div>
              <h4 className="font-medium">Delete Provider</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete this provider and all its configuration.
              </p>
            </div>
            <Button variant="destructive" size="sm">
              Delete
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
