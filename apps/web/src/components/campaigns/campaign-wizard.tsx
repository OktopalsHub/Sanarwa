'use client';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { campaignApi } from '@/lib/api/campaigns';
import type { CampaignWizardData, CreateCampaignRequest } from '@/lib/types/campaign';
import { toast } from '@/lib/utils/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ArrowRightIcon, BookmarkIcon, PaperAirplaneIcon, ArrowLeftIcon } from '@heroicons/react/24/outline'
import { useRouter } from '@/compat/next-navigation';
import { useTenantBasePath } from '@/hooks/use-tenant-slug';
import { useState } from 'react';
import { AudienceTargetingStep } from './wizard-steps/audience-targeting-step';
import { BasicInfoStep } from './wizard-steps/basic-info-step';
import { ChannelSelectionStep } from './wizard-steps/channel-selection-step';
import { ReviewStep } from './wizard-steps/review-step';
import { SchedulingStep } from './wizard-steps/scheduling-step';

interface CampaignWizardProps {
  onClose?: () => void;
  initialData?: Partial<CampaignWizardData>;
}

const WIZARD_STEPS = [
  { id: 'basic', title: 'Basic Information', description: 'Campaign name, type, and description' },
  { id: 'channels', title: 'Channel Selection', description: 'Choose communication channels' },
  { id: 'audience', title: 'Audience Targeting', description: 'Define your target audience' },
  { id: 'schedule', title: 'Scheduling', description: 'Set campaign timing and schedule' },
  { id: 'review', title: 'Review & Launch', description: 'Review and launch your campaign' },
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
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign created successfully!');
      router.push(`${basePath}/campaigns/${campaign.id}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to create campaign');
    },
  });

  const updateWizardData = (stepData: any) => {
    setWizardData(prev => ({
      ...prev,
      data: {
        ...prev.data,
        ...stepData,
      },
    }));
  };

  const goToStep = (step: number) => {
    setWizardData(prev => ({ ...prev, step }));
  };

  const nextStep = () => {
    if (wizardData.step < WIZARD_STEPS.length) {
      goToStep(wizardData.step + 1);
    }
  };

  const prevStep = () => {
    if (wizardData.step > 1) {
      goToStep(wizardData.step - 1);
    }
  };

  const canProceedToNext = () => {
    const { data } = wizardData;

    switch (wizardData.step) {
      case 1: // Basic Info
        return data.basic?.name && data.basic?.type;
      case 2: // Channels
        return data.channels?.selectedChannels && data.channels.selectedChannels.length > 0;
      case 3: // Audience
        return data.audience?.type;
      case 4: // Schedule
        return data.schedule?.type;
      case 5: // Review
        return true;
      default:
        return false;
    }
  };

  const handleSaveDraft = async () => {
    if (!canCreateCampaign()) return;

    setIsSubmitting(true);
    try {
      const campaignData = buildCampaignRequest('draft');
      await createCampaignMutation.mutateAsync(campaignData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLaunchCampaign = async () => {
    if (!canCreateCampaign()) return;

    setIsSubmitting(true);
    try {
      const campaignData = buildCampaignRequest('scheduled');
      await createCampaignMutation.mutateAsync(campaignData);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canCreateCampaign = () => {
    const { data } = wizardData;
    return (
      data.basic?.name &&
      data.basic?.type &&
      data.channels?.selectedChannels?.length &&
      data.audience?.type &&
      data.schedule?.type
    );
  };

  const buildCampaignRequest = (status: 'draft' | 'scheduled'): CreateCampaignRequest => {
    const { data } = wizardData;

    return {
      name: data.basic!.name,
      description: data.basic!.description,
      type: data.basic!.type,
      channels: data.channels!.selectedChannels,
      audience: data.audience!,
      schedule: data.schedule!,
      templates: data.templates || [],
    };
  };

  const renderCurrentStep = () => {
    switch (wizardData.step) {
      case 1:
        return (
          <BasicInfoStep
            data={wizardData.data.basic}
            onUpdate={(basic) => updateWizardData({ basic })}
          />
        );
      case 2:
        return (
          <ChannelSelectionStep
            data={wizardData.data.channels}
            onUpdate={(channels) => updateWizardData({ channels })}
          />
        );
      case 3:
        return (
          <AudienceTargetingStep
            data={wizardData.data.audience}
            onUpdate={(audience) => updateWizardData({ audience })}
          />
        );
      case 4:
        return (
          <SchedulingStep
            data={wizardData.data.schedule}
            onUpdate={(schedule) => updateWizardData({ schedule })}
          />
        );
      case 5:
        return (
          <ReviewStep
            data={wizardData.data}
            onUpdate={updateWizardData}
          />
        );
      default:
        return null;
    }
  };

  const currentStep = WIZARD_STEPS[wizardData.step - 1];
  const progress = (wizardData.step / WIZARD_STEPS.length) * 100;

  if (!currentStep) {
    return <div>Invalid step</div>;
  }

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Create New Campaign</h1>
          <p className="text-muted-foreground">
            Step {wizardData.step} of {WIZARD_STEPS.length}: {currentStep.title}
          </p>
        </div>
        {onClose && (
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
        )}
      </div>

      {/* Progress */}
      <div className="space-y-2">
        <Progress value={progress} className="h-2" />
        <div className="flex justify-between text-sm text-muted-foreground">
          {WIZARD_STEPS.map((step, index) => (
            <div
              key={step.id}
              className={`flex-1 text-center ${index + 1 === wizardData.step ? 'text-primary font-medium' : ''
                } ${index + 1 < wizardData.step ? 'text-green-600' : ''}`}
            >
              {step.title}
            </div>
          ))}
        </div>
      </div>

      {/* Step Content */}
      <Card>
        <CardHeader>
          <CardTitle>{currentStep.title}</CardTitle>
          <p className="text-muted-foreground">{currentStep.description}</p>
        </CardHeader>
        <CardContent>
          {renderCurrentStep()}
        </CardContent>
      </Card>

      {/* Navigation */}
      <div className="flex items-center justify-between">
        <Button
          variant="outline"
          onClick={prevStep}
          disabled={wizardData.step === 1}
        >
          <ArrowLeftIcon className="w-4 h-4 mr-2" />
          Previous
        </Button>

        <div className="flex items-center gap-3">
          {wizardData.step === WIZARD_STEPS.length ? (
            <>
              <Button
                variant="outline"
                onClick={handleSaveDraft}
                disabled={!canCreateCampaign() || isSubmitting}
              >
                <BookmarkIcon className="w-4 h-4 mr-2" />
                Save as Draft
              </Button>
              <Button
                onClick={handleLaunchCampaign}
                disabled={!canCreateCampaign() || isSubmitting}
              >
                <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                Launch Campaign
              </Button>
            </>
          ) : (
            <Button
              onClick={nextStep}
              disabled={!canProceedToNext()}
            >
              Next
              <ArrowRightIcon className="w-4 h-4 ml-2" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}