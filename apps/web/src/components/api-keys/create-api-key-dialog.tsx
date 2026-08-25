"use client";

import { Send } from "@/lib/icons";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useForm, Controller } from "react-hook-form";
import { toast } from "sonner";
import { projectApi } from "@/lib/api/project";
import { apiKeyApi } from "@/lib/api/api-key";
import { apiClient } from "@/lib/api/client";
import { useTenant } from "@/contexts/tenant-context";
import { DocumentDuplicateIcon, EyeIcon, EyeSlashIcon } from "@heroicons/react/24/outline";

interface CreateApiKeyDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface CreateApiKeyForm {
  name: string;
  projectId: string;
  permissions: string[];
}

export function CreateApiKeyDialog({ open, onOpenChange }: CreateApiKeyDialogProps) {
  const { selectedTenant } = useTenant();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedPermissions, setSelectedPermissions] = useState<string[]>(["read"]);
  const [createdApiKey, setCreatedApiKey] = useState<string | null>(null);
  const [showApiKey, setShowApiKey] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CreateApiKeyForm>();

  // Fetch projects for selection
  const { data: projectsData } = useQuery({
    queryKey: ["projects", selectedTenant?.id],
    queryFn: () => projectApi.getProjects({ limit: 100 }),
    enabled: !!selectedTenant?.id && open,
  });

  const projects = projectsData?.data || [];

  const permissions = [
    { id: "read", label: "Read", description: "View data and analytics" },
    { id: "write", label: "Write", description: "Send messages and create campaigns" },
    { id: "admin", label: "Admin", description: "Manage settings and configurations" },
  ];

  const handlePermissionChange = (permissionId: string, checked: boolean) => {
    if (checked) {
      setSelectedPermissions([...selectedPermissions, permissionId]);
    } else {
      setSelectedPermissions(selectedPermissions.filter((p) => p !== permissionId));
    }
  };

  const onSubmit = async (data: CreateApiKeyForm) => {
    if (selectedPermissions.length === 0) {
      toast.error("Please select at least one permission");
      return;
    }

    setIsSubmitting(true);
    try {
      if (selectedTenant?.id) {
        apiClient.setTenant(selectedTenant.id);
      }
      const result = await apiKeyApi.createApiKey({
        name: data.name,
        projectId: data.projectId,
        permissions: selectedPermissions,
      });

      setCreatedApiKey(result.key || null);
      toast.success("API key created");
    } catch (error) {
      toast.error("Failed to create API key");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      setSelectedPermissions(["read"]);
      setCreatedApiKey(null);
      setShowApiKey(false);
      onOpenChange(false);
    }
  };

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("API key copied to clipboard");
    } catch (error) {
      toast.error("Failed to copy API key");
    }
  };

  const maskApiKey = (key: string) => {
    if (key.length <= 12) return key;
    return key.substring(0, 12) + "•".repeat(key.length - 16) + key.substring(key.length - 4);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>{createdApiKey ? "API Key Created" : "Create API Key"}</DialogTitle>
          <DialogDescription>
            {createdApiKey
              ? "Your API key has been created. Make sure to copy it now as you won't be able to see it again."
              : "Create a new API key for accessing the Sanarwa API."}
          </DialogDescription>
        </DialogHeader>

        {createdApiKey ? (
          // Show created API key
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Your API Key</Label>
              <div className="flex gap-2">
                <Input
                  value={showApiKey ? createdApiKey : maskApiKey(createdApiKey)}
                  readOnly
                  className="font-mono text-sm"
                />
                <Button variant="outline" size="sm" onClick={() => setShowApiKey(!showApiKey)}>
                  {showApiKey ? (
                    <EyeSlashIcon className="h-4 w-4" />
                  ) : (
                    <EyeIcon className="h-4 w-4" />
                  )}
                </Button>
                <Button variant="outline" size="sm" onClick={() => copyToClipboard(createdApiKey)}>
                  <DocumentDuplicateIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>

            <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
              <div className="flex items-start gap-2">
                <div className="text-yellow-600 dark:text-yellow-400 mt-0.5">⚠️</div>
                <div className="text-sm">
                  <p className="font-medium text-yellow-800 dark:text-yellow-200">Important!</p>
                  <p className="text-yellow-700 dark:text-yellow-300">
                    This is the only time you'll be able to see this API key. Make sure to copy it
                    and store it securely.
                  </p>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button onClick={handleClose}>Done</Button>
            </DialogFooter>
          </div>
        ) : (
          // Show creation form
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">API Key Name</Label>
              <Input
                id="name"
                placeholder="e.g., Production API Key"
                {...register("name", {
                  required: "API key name is required",
                  minLength: {
                    value: 2,
                    message: "Name must be at least 2 characters",
                  },
                  maxLength: {
                    value: 100,
                    message: "Name must be less than 100 characters",
                  },
                })}
                disabled={isSubmitting}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="projectId">Project</Label>
              <Controller
                name="projectId"
                control={control}
                rules={{ required: "Please select a project" }}
                render={({ field }) => (
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select a project" />
                    </SelectTrigger>
                    <SelectContent>
                      {projects.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.projectId && (
                <p className="text-sm text-destructive">{errors.projectId.message}</p>
              )}
            </div>

            <div className="space-y-3">
              <Label>Permissions</Label>
              <div className="space-y-3">
                {permissions.map((permission) => (
                  <div key={permission.id} className="flex items-start space-x-3">
                    <Checkbox
                      id={permission.id}
                      checked={selectedPermissions.includes(permission.id)}
                      onCheckedChange={(checked) =>
                        handlePermissionChange(permission.id, checked as boolean)
                      }
                      disabled={isSubmitting}
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label
                        htmlFor={permission.id}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        {permission.label}
                      </Label>
                      <p className="text-xs text-muted-foreground">{permission.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
                Cancel
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Creating..." : "Create API Key"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
