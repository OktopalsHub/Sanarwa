'use client';

import { Webhook } from '@/lib/icons';

import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { PlusIcon, TrashIcon, ExclamationCircleIcon, BeakerIcon } from '@heroicons/react/24/outline'
import { toast } from 'sonner';

interface ProjectWebhooksProps {
  projectId: string;
}

export function ProjectWebhooks({ projectId }: ProjectWebhooksProps) {
  const [webhookUrl, setWebhookUrl] = useState('');
  const [webhookSecret, setWebhookSecret] = useState('');
  const [isEnabled, setIsEnabled] = useState(false);
  const [isTesting, setIsTesting] = useState(false);

  const handleSaveWebhook = async () => {
    try {
      // TODO: Implement webhook save API call
      toast.success('Webhook configuration saved');
    } catch (error) {
      toast.error('Failed to save webhook configuration');
    }
  };

  const handleTestWebhook = async () => {
    if (!webhookUrl) {
      toast.error('Please enter a webhook URL first');
      return;
    }

    setIsTesting(true);
    try {
      // TODO: Implement webhook test API call
      await new Promise(resolve => setTimeout(resolve, 2000)); // Mock delay
      toast.success('Webhook test successful');
    } catch (error) {
      toast.error('Webhook test failed');
    } finally {
      setIsTesting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold">Webhook Configuration</h3>
        <p className="text-sm text-muted-foreground">
          Configure webhooks to receive real-time notifications about your project events.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Webhook Settings</CardTitle>
          <CardDescription>
            Configure your webhook endpoint to receive event notifications
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enable Webhooks</Label>
              <p className="text-sm text-muted-foreground">
                Turn on webhook notifications for this project
              </p>
            </div>
            <Switch
              checked={isEnabled}
              onCheckedChange={setIsEnabled}
            />
          </div>

          {isEnabled && (
            <>
              <div className="space-y-2">
                <Label htmlFor="webhook-url">Webhook URL</Label>
                <Input
                  id="webhook-url"
                  type="url"
                  placeholder="https://your-app.com/webhooks/notifi"
                  value={webhookUrl}
                  onChange={(e) => setWebhookUrl(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="webhook-secret">Webhook Secret (Optional)</Label>
                <Input
                  id="webhook-secret"
                  type="password"
                  placeholder="Enter a secret for webhook verification"
                  value={webhookSecret}
                  onChange={(e) => setWebhookSecret(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Used to verify webhook authenticity. We recommend using a strong, random string.
                </p>
              </div>

              <div className="flex gap-2">
                <Button onClick={handleSaveWebhook}>
                  Save Configuration
                </Button>
                <Button
                  variant="outline"
                  onClick={handleTestWebhook}
                  disabled={isTesting || !webhookUrl}
                >
                  <BeakerIcon className="h-4 w-4 mr-2" />
                  {isTesting ? 'Testing...' : 'Test Webhook'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Webhook Events</CardTitle>
            <CardDescription>
              Choose which events should trigger webhook notifications
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {[
                { id: 'message.sent', label: 'Message Sent', description: 'When a message is successfully sent' },
                { id: 'message.delivered', label: 'Message Delivered', description: 'When a message is delivered to the recipient' },
                { id: 'message.failed', label: 'Message Failed', description: 'When a message fails to send' },
                { id: 'message.bounced', label: 'Message Bounced', description: 'When an email bounces' },
                { id: 'message.opened', label: 'Message Opened', description: 'When an email is opened (email only)' },
                { id: 'message.clicked', label: 'Message Clicked', description: 'When a link in a message is clicked' },
              ].map((event) => (
                <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="space-y-0.5">
                    <div className="font-medium">{event.label}</div>
                    <div className="text-sm text-muted-foreground">{event.description}</div>
                  </div>
                  <Switch defaultChecked />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {isEnabled && (
        <Card>
          <CardHeader>
            <CardTitle>Recent Webhook Deliveries</CardTitle>
            <CardDescription>
              View the status of recent webhook deliveries
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8 text-muted-foreground">
              <ExclamationCircleIcon className="h-8 w-8 mx-auto mb-2" />
              <p>No webhook deliveries yet</p>
              <p className="text-sm">Webhook deliveries will appear here once you start sending messages</p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}