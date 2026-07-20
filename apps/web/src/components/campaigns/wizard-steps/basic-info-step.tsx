'use client';

import { Droplets, FileText, Repeat, Send, Zap } from '@/lib/icons';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import type { CampaignType } from '@/lib/types/campaign';
import { zodResolver } from '@hookform/resolvers/zod';
import { DocumentTextIcon, BoltIcon, SwatchIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import React from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const basicInfoSchema = z.object({
  name: z.string().min(1, 'Campaign name is required').max(100, 'Name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  type: z.enum(['one_time', 'recurring', 'triggered', 'drip'] as const),
});

type BasicInfoFormData = z.infer<typeof basicInfoSchema>;

interface BasicInfoStepProps {
  data?: {
    name: string;
    description?: string;
    type: CampaignType;
  };
  onUpdate: (data: BasicInfoFormData) => void;
}

const CAMPAIGN_TYPES = [
  {
    value: 'one_time' as const,
    label: 'One-time Campaign',
    description: 'Send a single message to your audience',
    icon: FileText,
  },
  {
    value: 'recurring' as const,
    label: 'Recurring Campaign',
    description: 'Send messages on a regular schedule',
    icon: Repeat,
  },
  {
    value: 'triggered' as const,
    label: 'Triggered Campaign',
    description: 'Send messages based on user actions or events',
    icon: Zap,
  },
  {
    value: 'drip' as const,
    label: 'Drip Campaign',
    description: 'Send a series of messages over time',
    icon: Droplets,
  },
];

export function BasicInfoStep({ data, onUpdate }: BasicInfoStepProps) {
  const {
    register,
    watch,
    setValue,
    formState: { errors },
  } = useForm<BasicInfoFormData>({
    resolver: zodResolver(basicInfoSchema),
    defaultValues: data,
  });

  const watchedValues = watch();

  React.useEffect(() => {
    if (watchedValues.name || watchedValues.description || watchedValues.type) {
      onUpdate(watchedValues);
    }
  }, [watchedValues, onUpdate]);

  return (
    <div className="space-y-6">
      {/* Campaign Name */}
      <div className="space-y-2">
        <Label htmlFor="name">Campaign Name *</Label>
        <Input
          id="name"
          placeholder="Enter campaign name"
          {...register('name')}
        />
        {errors.name && (
          <p className="text-sm text-destructive">{errors.name.message}</p>
        )}
      </div>

      {/* Campaign Description */}
      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Describe your campaign (optional)"
          rows={3}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      {/* Campaign Type */}
      <div className="space-y-3">
        <Label>Campaign Type *</Label>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CAMPAIGN_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = watchedValues.type === type.value;

            return (
              <Card
                key={type.value}
                className={`cursor-pointer transition-all hover:shadow-md ${isSelected
                    ? 'ring-2 ring-primary border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                  }`}
                onClick={() => setValue('type', type.value)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <CardTitle className="text-base">{type.label}</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="pt-0">
                  <CardDescription>{type.description}</CardDescription>
                </CardContent>
              </Card>
            );
          })}
        </div>
        {errors.type && (
          <p className="text-sm text-destructive">{errors.type.message}</p>
        )}
      </div>

      {/* Campaign Type Info */}
      {watchedValues.type && (
        <Card className="bg-muted/50">
          <CardContent className="pt-6">
            <div className="space-y-2">
              <h4 className="font-medium">
                {CAMPAIGN_TYPES.find(t => t.value === watchedValues.type)?.label}
              </h4>
              <div className="text-sm text-muted-foreground">
                {watchedValues.type === 'one_time' && (
                  <p>Perfect for announcements, promotions, or one-off communications. You'll be able to schedule when to send this campaign.</p>
                )}
                {watchedValues.type === 'recurring' && (
                  <p>Ideal for newsletters, weekly updates, or regular check-ins. You can set up daily, weekly, monthly, or custom recurring schedules.</p>
                )}
                {watchedValues.type === 'triggered' && (
                  <p>Great for welcome emails, abandoned cart reminders, or event-based notifications. Messages are sent automatically when specific conditions are met.</p>
                )}
                {watchedValues.type === 'drip' && (
                  <p>Perfect for onboarding sequences, educational series, or nurture campaigns. Messages are sent in a predetermined sequence over time.</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}