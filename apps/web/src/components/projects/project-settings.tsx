'use client';

import { Webhook } from '@/lib/icons';

import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { projectApi } from '@/lib/api/project';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Separator } from '@/components/ui/separator';
import { useForm } from 'react-hook-form';
import { Project, UpdateProjectRequest } from '@/lib/types/project';
import { toast } from 'sonner';
import { ExclamationTriangleIcon, BookmarkIcon } from '@heroicons/react/24/outline'

interface ProjectSettingsProps {
  project: Project;
}

export function ProjectSettings({ project }: ProjectSettingsProps) {
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<UpdateProjectRequest>({
    defaultValues: {
      name: project.name,
      description: project.description || '',
      settings: {
        webhookUrl: project.settings?.webhookUrl || '',
        retryPolicy: {
          maxRetries: project.settings?.retryPolicy?.maxRetries || 3,
          retryDelay: project.settings?.retryPolicy?.retryDelay || 5000,
        },
        rateLimiting: {
          enabled: project.settings?.rateLimiting?.enabled || false,
          requestsPerMinute: project.settings?.rateLimiting?.requestsPerMinute || 100,
        },
      },
    },
  });

  const updateProjectMutation = useMutation({
    mutationFn: (data: UpdateProjectRequest) => projectApi.updateProject(project.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['project', project.id] });
      toast.success('Project settings updated successfully');
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update project settings');
    },
    onSettled: () => {
      setIsSubmitting(false);
    },
  });

  const onSubmit = async (data: UpdateProjectRequest) => {
    setIsSubmitting(true);
    updateProjectMutation.mutate(data);
  };

  const rateLimitingEnabled = watch('settings.rateLimiting.enabled');

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Basic Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Basic Settings</CardTitle>
            <CardDescription>
              Update your project's basic information and configuration.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Project Name</Label>
              <Input
                id="name"
                {...register('name', {
                  required: 'Project name is required',
                  minLength: {
                    value: 2,
                    message: 'Project name must be at least 2 characters',
                  },
                })}
                disabled={isSubmitting}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                rows={3}
                {...register('description')}
                disabled={isSubmitting}
              />
            </div>
          </CardContent>
        </Card>

        {/* Webhook Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Webhook Configuration</CardTitle>
            <CardDescription>
              Configure webhook endpoints to receive real-time notifications about your campaigns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="webhookUrl">Webhook URL</Label>
              <Input
                id="webhookUrl"
                type="url"
                placeholder="https://your-domain.com/webhook"
                {...register('settings.webhookUrl')}
                disabled={isSubmitting}
              />
              <p className="text-sm text-muted-foreground">
                We'll send POST requests to this URL when events occur.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Retry Policy */}
        <Card>
          <CardHeader>
            <CardTitle>Retry Policy</CardTitle>
            <CardDescription>
              Configure how failed notifications should be retried.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxRetries">Max Retries</Label>
                <Input
                  id="maxRetries"
                  type="number"
                  min="0"
                  max="10"
                  {...register('settings.retryPolicy.maxRetries', {
                    valueAsNumber: true,
                    min: { value: 0, message: 'Must be at least 0' },
                    max: { value: 10, message: 'Must be at most 10' },
                  })}
                  disabled={isSubmitting}
                />
                {errors.settings?.retryPolicy?.maxRetries && (
                  <p className="text-sm text-destructive">
                    {errors.settings.retryPolicy.maxRetries.message}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="retryDelay">Retry Delay (ms)</Label>
                <Input
                  id="retryDelay"
                  type="number"
                  min="1000"
                  max="60000"
                  {...register('settings.retryPolicy.retryDelay', {
                    valueAsNumber: true,
                    min: { value: 1000, message: 'Must be at least 1000ms' },
                    max: { value: 60000, message: 'Must be at most 60000ms' },
                  })}
                  disabled={isSubmitting}
                />
                {errors.settings?.retryPolicy?.retryDelay && (
                  <p className="text-sm text-destructive">
                    {errors.settings.retryPolicy.retryDelay.message}
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Rate Limiting */}
        <Card>
          <CardHeader>
            <CardTitle>Rate Limiting</CardTitle>
            <CardDescription>
              Control the rate at which notifications are sent to prevent overwhelming recipients.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="rateLimitingEnabled">Enable Rate Limiting</Label>
                <p className="text-sm text-muted-foreground">
                  Limit the number of requests per minute
                </p>
              </div>
              <Switch
                id="rateLimitingEnabled"
                checked={rateLimitingEnabled}
                onCheckedChange={(checked) => setValue('settings.rateLimiting.enabled', checked)}
                disabled={isSubmitting}
              />
            </div>

            {rateLimitingEnabled && (
              <div className="space-y-2">
                <Label htmlFor="requestsPerMinute">Requests per Minute</Label>
                <Input
                  id="requestsPerMinute"
                  type="number"
                  min="1"
                  max="10000"
                  {...register('settings.rateLimiting.requestsPerMinute', {
                    valueAsNumber: true,
                    min: { value: 1, message: 'Must be at least 1' },
                    max: { value: 10000, message: 'Must be at most 10000' },
                  })}
                  disabled={isSubmitting}
                />
                {errors.settings?.rateLimiting?.requestsPerMinute && (
                  <p className="text-sm text-destructive">
                    {errors.settings.rateLimiting.requestsPerMinute.message}
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Save Button */}
        <div className="flex justify-end">
          <Button type="submit" disabled={!isDirty || isSubmitting}>
            <BookmarkIcon className="h-4 w-4 mr-2" />
            {isSubmitting ? 'Saving...' : 'Save Changes'}
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
          <CardDescription>
            Irreversible and destructive actions for this project.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg">
            <div>
              <h4 className="font-medium">Archive Project</h4>
              <p className="text-sm text-muted-foreground">
                Archive this project. It can be restored later.
              </p>
            </div>
            <Button variant="outline" size="sm">
              Archive
            </Button>
          </div>

          <div className="flex items-center justify-between p-4 border border-destructive/20 rounded-lg">
            <div>
              <h4 className="font-medium">Delete Project</h4>
              <p className="text-sm text-muted-foreground">
                Permanently delete this project and all its data.
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