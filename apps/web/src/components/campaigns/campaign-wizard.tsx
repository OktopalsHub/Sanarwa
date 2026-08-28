"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { campaignApi } from "@/lib/api/campaigns";
import type { CampaignWizardData, CreateCampaignRequest } from "@/lib/types/campaign";
import { toast } from "@/lib/utils/toast";
import { cn } from "@/lib/utils";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { IconArrowLeft, IconArrowRight, IconBookmark, IconSend } from "@tabler/icons-react";
import { useRouter } from "@/compat/next-navigation";
import { useTenantBasePath } from "@/hooks/use-tenant-slug";
import { useState } from "react";
import { AudienceTargetingStep } from "./wizard-steps/audience-targeting-step";
import { BasicInfoStep } from "./wizard-steps/basic-info-step";
import { ChannelSelectionStep } from "./wizard-steps/channel-selection-step";
import { ReviewStep } from "./wizard-steps/review-step";
import { SchedulingStep } from "./wizard-steps/scheduling-step";

interface CampaignWizardProps {
  onClose?: () => void;
  initialData?: Partial<CampaignWizardData>;
}

const WIZARD_STEPS = [
  { id: "basic", title: "Basic Information", description: "Campaign name, type, and description" },
  { id: "channels", title: "Channel Selection", description: "Choose communication channels" },
  { id: "audience", title: "Audience Targeting", description: "Define your target audience" },
  { id: "schedule", title: "Scheduling", description: "Set campaign timing and schedule" },
  { id: "review", title: "Review & Launch", description: "Review and launch your campaign" },
];

export function CampaignWizard({ onClose, initialData }: CampaignWizardProps) {
  const router = useRouter();
  const basePath = useTenantBasePath();
  const queryClient = useQueryClient();

  const [wizardData, setWizardData] = useState<CampaignWizardData>({
    step: 1,
    totalSteps: WIZARD_STEPS.length,
    data: initialData?.data || {},
  });

  const [isSubmitting, setIsSubmitting] = useState(false);

  const createCampaignMutation = useMutation({
    mutationFn: campaignApi.createCampaign,
    onSuccess: (campaign) => {
      queryClient.invalidateQueries({ queryKey: ["campaigns"] });
      toast.success("Campaign created successfully!");
      router.push(`${basePath}/campaigns/${campaign.id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message || "Failed to create campaign");
    },
  });

  const updateWizardData = (stepData: CampaignWizardData["data"]) => {
    setWizardData((prev) => ({
      ...prev,
      data: { ...prev.data, ...stepData },
    }));
  };

  const goToStep = (step: number) => {
    setWizardData((prev) => ({ ...prev, step }));
  };

  const { data } = wizardData;
  const canProceed =
    wizardData.step === 1
      ? Boolean(data.basic?.name && data.basic?.type)
      : wizardData.step === 2
        ? Boolean(data.channels?.selectedChannels?.length)
        : wizardData.step === 3
          ? Boolean(data.audience?.type)
          : wizardData.step === 4
            ? Boolean(data.schedule?.type)
            : true;

  const canCreate = Boolean(
    data.basic?.name &&
    data.basic?.type &&
    data.channels?.selectedChannels?.length &&
    data.audience?.type &&
    data.schedule?.type,
  );

  const buildCampaignRequest = (_status: "draft" | "scheduled"): CreateCampaignRequest => ({
    name: data.basic!.name,
    description: data.basic!.description,
    type: data.basic!.type,
    channels: data.channels!.selectedChannels,
    audience: data.audience!,
    schedule: data.schedule!,
    templates: data.templates || [],
  });

  const submit = async (status: "draft" | "scheduled") => {
    if (!canCreate) return;
    setIsSubmitting(true);
    try {
      await createCampaignMutation.mutateAsync(buildCampaignRequest(status));
    } finally {
      setIsSubmitting(false);
    }
  };

  const currentStep = WIZARD_STEPS[wizardData.step - 1];
  if (!currentStep) return <div>Invalid step</div>;

  const steps = [
    <BasicInfoStep
      key="basic"
      data={data.basic}
      onUpdate={(basic) => updateWizardData({ basic })}
    />,
    <ChannelSelectionStep
      key="channels"
      data={data.channels}
      onUpdate={(channels) => updateWizardData({ channels })}
    />,
    <AudienceTargetingStep
      key="audience"
      data={data.audience}
      onUpdate={(audience) => updateWizardData({ audience })}
    />,
    <SchedulingStep
      key="schedule"
      data={data.schedule}
      onUpdate={(schedule) => updateWizardData({ schedule })}
    />,
    <ReviewStep key="review" data={data} onUpdate={updateWizardData} />,
  ];

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create New Campaign</h1>
          <p className="text-muted-foreground">
            Step {wizardData.step} of {WIZARD_STEPS.length}: {currentStep.title}
          </p>
        </div>
        {onClose ? (
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        ) : null}
      </div>

      <div className="flex flex-col gap-2">
        <Progress value={(wizardData.step / WIZARD_STEPS.length) * 100} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground">
          {WIZARD_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={cn(
                "flex-1 text-center",
                index + 1 === wizardData.step && "font-medium text-primary",
                index + 1 < wizardData.step && "text-primary",
              )}
            >
              {step.title}
            </div>
          ))}
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{currentStep.title}</CardTitle>
          <p className="text-muted-foreground">{currentStep.description}</p>
        </CardHeader>
        <CardContent>{steps[wizardData.step - 1]}</CardContent>
      </Card>

      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={() => goToStep(wizardData.step - 1)}
          disabled={wizardData.step === 1}
        >
          <IconArrowLeft data-icon="inline-start" />
          Previous
        </Button>
        <div className="flex items-center gap-3">
          {wizardData.step === WIZARD_STEPS.length ? (
            <>
              <Button
                variant="outline"
                onClick={() => submit("draft")}
                disabled={!canCreate || isSubmitting}
              >
                <IconBookmark data-icon="inline-start" />
                Save as Draft
              </Button>
              <Button onClick={() => submit("scheduled")} disabled={!canCreate || isSubmitting}>
                <IconSend data-icon="inline-start" />
                Launch Campaign
              </Button>
            </>
          ) : (
            <Button onClick={() => goToStep(wizardData.step + 1)} disabled={!canProceed}>
              Next
              <IconArrowRight data-icon="inline-end" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
