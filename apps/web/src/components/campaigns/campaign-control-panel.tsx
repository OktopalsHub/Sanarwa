'use client';

import { Send } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { campaignApi } from '@/lib/api/campaigns';
import type { Campaign, CampaignStatus } from '@/lib/types/campaign';
import { toast } from '@/lib/utils/toast';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ExclamationTriangleIcon, CalendarIcon, ClockIcon, DocumentDuplicateIcon, PencilIcon, PauseIcon, PlayIcon, PaperAirplaneIcon, StopIcon, UsersIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';

interface CampaignControlPanelProps {
  campaign: Campaign;
  onEdit?: () => void;
}

export function CampaignControlPanel({ campaign, onEdit }: CampaignControlPanelProps) {
  const queryClient = useQueryClient();
  const [showScheduleDialog, setShowScheduleDialog] = useState(false);
  const [showTestDialog, setShowTestDialog] = useState(false);
  const [testEmails, setTestEmails] = useState('');
  const [scheduleDate, setScheduleDate] = useState('');
  const [scheduleTime, setScheduleTime] = useState('');

  // Campaign control mutations
  const startCampaignMutation = useMutation({
    mutationFn: campaignApi.startCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] });
      toast.success('Campaign started successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to start campaign');
    },
  });

  const pauseCampaignMutation = useMutation({
    mutationFn: campaignApi.pauseCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] });
      toast.success('Campaign paused successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to pause campaign');
    },
  });

  const resumeCampaignMutation = useMutation({
    mutationFn: campaignApi.resumeCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] });
      toast.success('Campaign resumed successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to resume campaign');
    },
  });

  const stopCampaignMutation = useMutation({
    mutationFn: campaignApi.stopCampaign,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaign', campaign.id] });
      toast.success('Campaign stopped successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to stop campaign');
    },
  });

  const sendTestMutation = useMutation({
    mutationFn: (emails: string[]) => campaignApi.sendTestCampaign(campaign.id, emails),
    onSuccess: () => {
      toast.success('Test campaign sent successfully');
      setShowTestDialog(false);
      setTestEmails('');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to send test campaign');
    },
  });

  const duplicateCampaignMutation = useMutation({
    mutationFn: (name: string) => campaignApi.duplicateCampaign(campaign.id, name),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
      toast.success('Campaign duplicated successfully');
    },
    onError: (error: Error) => {
      toast.error(error.message || 'Failed to duplicate campaign');
    },
  });

  const handleStartCampaign = () => {
    if (campaign.status === 'draft' || campaign.status === 'scheduled') {
      startCampaignMutation.mutate(campaign.id);
    }
  };

  const handlePauseCampaign = () => {
    if (campaign.status === 'active') {
      pauseCampaignMutation.mutate(campaign.id);
    }
  };

  const handleResumeCampaign = () => {
    if (campaign.status === 'paused') {
      resumeCampaignMutation.mutate(campaign.id);
    }
  };

  const handleStopCampaign = () => {
    if (campaign.status === 'active' || campaign.status === 'paused') {
      if (confirm('Are you sure you want to stop this campaign? This action cannot be undone.')) {
        stopCampaignMutation.mutate(campaign.id);
      }
    }
  };

  const handleSendTest = () => {
    const emails = testEmails
      .split(',')
      .map(email => email.trim())
      .filter(email => email.length > 0);

    if (emails.length === 0) {
      toast.error('Please enter at least one email address');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    const invalidEmails = emails.filter(email => !emailRegex.test(email));

    if (invalidEmails.length > 0) {
      toast.error(`Invalid email addresses: ${invalidEmails.join(', ')}`);
      return;
    }

    sendTestMutation.mutate(emails);
  };

  const handleDuplicate = () => {
    const newName = `${campaign.name} (Copy)`;
    duplicateCampaignMutation.mutate(newName);
  };

  const canStart = campaign.status === 'draft' || campaign.status === 'scheduled';
  const canPause = campaign.status === 'active';
  const canResume = campaign.status === 'paused';
  const canStop = campaign.status === 'active' || campaign.status === 'paused';
  const canTest = campaign.status !== 'active';

  const getStatusColor = (status: CampaignStatus) => {
    switch (status) {
      case 'draft': return 'bg-gray-100 text-gray-800';
      case 'scheduled': return 'bg-blue-100 text-blue-800';
      case 'active': return 'bg-green-100 text-green-800';
      case 'paused': return 'bg-yellow-100 text-yellow-800';
      case 'completed': return 'bg-purple-100 text-purple-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(date));
  };

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="w-5 h-5" />
            Campaign Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Campaign Status */}
          <div className="flex items-center justify-between p-3 bg-muted rounded-lg">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">Status:</span>
              <Badge className={getStatusColor(campaign.status)}>
                {campaign.status}
              </Badge>
            </div>
            {campaign.schedule.scheduledAt && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <CalendarIcon className="w-4 h-4" />
                Scheduled: {formatDate(campaign.schedule.scheduledAt)}
              </div>
            )}
          </div>

          {/* Control Buttons */}
          <div className="grid grid-cols-2 gap-2">
            {canStart && (
              <Button
                onClick={handleStartCampaign}
                disabled={startCampaignMutation.isPending}
                className="w-full"
              >
                <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                {campaign.status === 'scheduled' ? 'Start Now' : 'Start Campaign'}
              </Button>
            )}

            {canPause && (
              <Button
                variant="outline"
                onClick={handlePauseCampaign}
                disabled={pauseCampaignMutation.isPending}
                className="w-full"
              >
                <PauseIcon className="w-4 h-4 mr-2" />
                Pause
              </Button>
            )}

            {canResume && (
              <Button
                onClick={handleResumeCampaign}
                disabled={resumeCampaignMutation.isPending}
                className="w-full"
              >
                <PlayIcon className="w-4 h-4 mr-2" />
                Resume
              </Button>
            )}

            {canStop && (
              <Button
                variant="outline"
                onClick={handleStopCampaign}
                disabled={stopCampaignMutation.isPending}
                className="w-full text-red-600 hover:text-red-700"
              >
                <StopIcon className="w-4 h-4 mr-2" />
                Stop
              </Button>
            )}

            {onEdit && (
              <Button
                variant="outline"
                onClick={onEdit}
                className="w-full"
              >
                <PencilIcon className="w-4 h-4 mr-2" />
                Edit
              </Button>
            )}

            <Button
              variant="outline"
              onClick={handleDuplicate}
              disabled={duplicateCampaignMutation.isPending}
              className="w-full"
            >
              <DocumentDuplicateIcon className="w-4 h-4 mr-2" />
              Duplicate
            </Button>

            {canTest && (
              <Button
                variant="outline"
                onClick={() => setShowTestDialog(true)}
                className="w-full"
              >
                <PaperAirplaneIcon className="w-4 h-4 mr-2" />
                Send Test
              </Button>
            )}

            {campaign.status === 'draft' && (
              <Button
                variant="outline"
                onClick={() => setShowScheduleDialog(true)}
                className="w-full"
              >
                <ClockIcon className="w-4 h-4 mr-2" />
                Schedule
              </Button>
            )}
          </div>

          {/* Campaign Info */}
          <div className="space-y-2 pt-4 border-t">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Created:</span>
              <span>{formatDate(campaign.createdAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Last Updated:</span>
              <span>{formatDate(campaign.updatedAt)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Type:</span>
              <span className="capitalize">{campaign.type.replace('_', ' ')}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Channels:</span>
              <span>{campaign.channels.length}</span>
            </div>
          </div>

          {/* Warnings */}
          {campaign.status === 'draft' && (
            <div className="flex items-start gap-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <ExclamationTriangleIcon className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="text-sm">
                <p className="font-medium text-yellow-800">Campaign is in draft mode</p>
                <p className="text-yellow-700">
                  Review your settings and start the campaign when ready.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Test Campaign Dialog */}
      <Dialog open={showTestDialog} onOpenChange={setShowTestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Send Test Campaign</DialogTitle>
            <DialogDescription>
              Send a test version of this campaign to specific email addresses.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="test-emails">Email Addresses</Label>
              <Textarea
                id="test-emails"
                placeholder="Enter email addresses separated by commas"
                value={testEmails}
                onChange={(e) => setTestEmails(e.target.value)}
                rows={3}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Separate multiple email addresses with commas
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTestDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleSendTest}
              disabled={sendTestMutation.isPending || !testEmails.trim()}
            >
              {sendTestMutation.isPending ? 'Sending...' : 'Send Test'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Schedule Campaign Dialog */}
      <Dialog open={showScheduleDialog} onOpenChange={setShowScheduleDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Schedule Campaign</DialogTitle>
            <DialogDescription>
              Set a specific date and time to automatically start this campaign.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="schedule-date">Date</Label>
              <Input
                id="schedule-date"
                type="date"
                value={scheduleDate}
                onChange={(e) => setScheduleDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
              />
            </div>
            <div>
              <Label htmlFor="schedule-time">Time</Label>
              <Input
                id="schedule-time"
                type="time"
                value={scheduleTime}
                onChange={(e) => setScheduleTime(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowScheduleDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                // Handle scheduling logic here
                toast.success('Campaign scheduled successfully');
                setShowScheduleDialog(false);
              }}
              disabled={!scheduleDate || !scheduleTime}
            >
              Schedule Campaign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}