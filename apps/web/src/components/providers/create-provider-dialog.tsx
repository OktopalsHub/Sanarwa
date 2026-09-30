"use client";

import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { providerApi } from "@/lib/api/provider";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm, Controller } from "react-hook-form";
import { CreateProviderRequest, ProviderType } from "@/lib/types/provider";
import { useTenant } from "@/contexts/tenant-context";
import { toast } from "sonner";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface CreateProviderDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const providerTypes = [
  { value: ProviderType.EMAIL, label: "Email", description: "Send email notifications" },
  { value: ProviderType.SMS, label: "SMS", description: "Send text messages" },
  { value: ProviderType.PUSH, label: "Push", description: "Send push notifications" },
  { value: ProviderType.VOICE, label: "Voice", description: "Send voice calls" },
  { value: ProviderType.WHATSAPP, label: "WhatsApp", description: "Send WhatsApp messages" },
];

const providerSubtypes: Partial<Record<ProviderType, Array<{ value: string; label: string }>>> = {
  [ProviderType.EMAIL]: [
    { value: "aws_ses", label: "Amazon SES" },
    { value: "sendgrid", label: "SendGrid" },
    { value: "mailgun", label: "Mailgun" },
    { value: "postmark", label: "Postmark" },
  ],
  [ProviderType.SMS]: [
    { value: "twilio", label: "Twilio" },
    { value: "aws_sns", label: "Amazon SNS" },
    { value: "vonage", label: "Vonage" },
    { value: "africas_talking", label: "Africa's Talking" },
  ],
  [ProviderType.PUSH]: [
    { value: "firebase", label: "Firebase FCM" },
    { value: "apns", label: "Apple Push Notification" },
    { value: "web_push", label: "Web Push" },
  ],
  [ProviderType.VOICE]: [
    { value: "twilio_voice", label: "Twilio Voice" },
    { value: "aws_polly", label: "Amazon Polly" },
  ],
  [ProviderType.WHATSAPP]: [
    { value: "twilio_whatsapp", label: "Twilio WhatsApp" },
    { value: "whatsapp_business", label: "WhatsApp Business API" },
  ],
};

export function CreateProviderDialog({ open, onOpenChange }: CreateProviderDialogProps) {
  const { selectedTenant } = useTenant();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedType, setSelectedType] = useState<ProviderType | "">("");

  const {
    register,
    handleSubmit,
    reset,
    control,
    watch,
    formState: { errors },
  } = useForm<CreateProviderRequest>();

  const watchedType = watch("type");

  const createProviderMutation = useMutation({
    mutationFn: (data: CreateProviderRequest) => providerApi.createProvider(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["providers"] });
      toast.success("Provider created successfully");
      reset();
      setSelectedType("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast.error(error.message || "Failed to create provider");
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: CreateProviderRequest) => {
    if (!selectedTenant) {
      toast.error("No tenant selected");
      return;
    }

    setIsSubmitting(true);
    createProviderMutation.mutate(data);
  };

  const handleClose = () => {
    if (!isSubmitting) {
      reset();
      setSelectedType("");
      onOpenChange(false);
    }
  };

  const getConfigTemplate = (type: ProviderType, subtype: string) => {
    const template = providerApi.getProviderConfigTemplate(type, subtype);
    return template;
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add New Provider</DialogTitle>
          <DialogDescription>
            Configure a new notification service provider for your tenant.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Provider Type Selection */}
          <div className="space-y-4">
            <Label>Provider Type</Label>
            <div className="grid grid-cols-1 gap-3">
              {providerTypes.map((type) => (
                <Card
                  key={type.value}
                  className={`cursor-pointer transition-colors ${
                    selectedType === type.value
                      ? "border-primary bg-primary/5"
                      : "hover:border-primary/50"
                  }`}
                  onClick={() => setSelectedType(type.value)}
                >
                  <CardHeader className="pb-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        {...register("type", { required: "Provider type is required" })}
                        value={type.value}
                        checked={selectedType === type.value}
                        onChange={() => setSelectedType(type.value)}
                        className="sr-only"
                      />
                      <CardTitle className="text-sm">{type.label}</CardTitle>
                    </div>
                    <CardDescription className="text-xs">{type.description}</CardDescription>
                  </CardHeader>
                </Card>
              ))}
            </div>
            {errors.type && <p className="text-sm text-destructive">{errors.type.message}</p>}
          </div>

          {/* Provider Subtype */}
          {selectedType && (
            <div className="space-y-2">
              <Label htmlFor="subtype">Service Provider</Label>
              <Controller
                name="subtype"
                control={control}
                rules={{ required: "Service provider is required" }}
                render={({ field }) => (
                  <Select onValueChange={field.onChange} value={field.value}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a service provider" />
                    </SelectTrigger>
                    <SelectContent>
                      {providerSubtypes[selectedType]?.map((subtype) => (
                        <SelectItem key={subtype.value} value={subtype.value}>
                          {subtype.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {errors.subtype && (
                <p className="text-sm text-destructive">{errors.subtype.message}</p>
              )}
            </div>
          )}

          {/* Basic Configuration */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Provider Name</Label>
              <Input
                id="name"
                placeholder="e.g., Production Email Provider"
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
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                placeholder="Describe this provider configuration"
                rows={2}
                {...register("description")}
                disabled={isSubmitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="priority">Priority</Label>
              <Input
                id="priority"
                type="number"
                min="0"
                max="100"
                placeholder="0-100 (higher = higher priority)"
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
          </div>

          {/* Configuration Template Info */}
          {selectedType && watchedType && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm">Configuration Required</CardTitle>
                <CardDescription className="text-xs">
                  After creating this provider, you'll need to configure the following settings:
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-xs space-y-1">
                  {(() => {
                    const template = getConfigTemplate(selectedType, watchedType);
                    return template.requiredFields.map((field) => (
                      <div key={field} className="flex items-center gap-2">
                        <div className="w-2 h-2 bg-primary rounded-full"></div>
                        <span className="capitalize">
                          {field.replace(/([A-Z])/g, " $1").trim()}
                        </span>
                      </div>
                    ));
                  })()}
                </div>
              </CardContent>
            </Card>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Creating..." : "Create Provider"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
