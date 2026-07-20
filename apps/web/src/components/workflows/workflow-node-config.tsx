'use client';

import { Send, Webhook } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  ActionConfig,
  ConditionConfig,
  DelayConfig,
  SplitConfig,
  TriggerConfig,
  WorkflowNode,
} from '@/lib/types/workflow';
import { EyeIcon, BookmarkIcon, BeakerIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import * as z from 'zod';

interface WorkflowNodeConfigProps {
  node: WorkflowNode | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (node: WorkflowNode) => void;
  onTest?: (node: WorkflowNode) => void;
  onPreview?: (node: WorkflowNode) => void;
}

// Validation schemas for different node types
const triggerConfigSchema = z.object({
  type: z.enum(['event', 'time', 'api', 'webhook']),
  eventName: z.string().optional(),
  schedule: z.string().optional(),
  apiEndpoint: z.string().optional(),
  webhookUrl: z.string().url().optional(),
});

const actionConfigSchema = z.object({
  type: z.enum(['email', 'sms', 'push', 'in_app', 'voice', 'webhook']),
  templateId: z.string().optional(),
  message: z.string().optional(),
  subject: z.string().optional(),
  recipients: z.array(z.string()).optional(),
  webhookUrl: z.string().url().optional(),
  headers: z.record(z.string(), z.string()).optional(),
});

const conditionConfigSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: z.enum(['equals', 'not_equals', 'contains', 'not_contains', 'greater_than', 'less_than', 'exists', 'not_exists']),
  value: z.union([z.string(), z.number(), z.boolean()]),
  trueNodeId: z.string().optional(),
  falseNodeId: z.string().optional(),
});

const delayConfigSchema = z.object({
  duration: z.number().min(1, 'Duration must be at least 1'),
  unit: z.enum(['minutes', 'hours', 'days']),
});

const splitConfigSchema = z.object({
  type: z.enum(['ab_test', 'random']),
  percentage: z.number().min(0).max(100).optional(),
  branches: z.array(z.object({
    id: z.string(),
    label: z.string(),
    percentage: z.number(),
    nodeId: z.string(),
  })),
});

export function WorkflowNodeConfig({
  node,
  isOpen,
  onClose,
  onSave,
  onTest,
  onPreview,
}: WorkflowNodeConfigProps) {
  const [activeTab, setActiveTab] = useState('general');

  if (!node) return null;

  const handleSave = (updatedNode: WorkflowNode) => {
    onSave(updatedNode);
    onClose();
  };

  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent className="w-[600px] sm:max-w-[600px] overflow-y-auto">
        <SheetHeader>
          <div className="flex items-center justify-between">
            <div>
              <SheetTitle className="flex items-center gap-2">
                Configure Node
                <Badge variant="outline">{node.type}</Badge>
              </SheetTitle>
              <SheetDescription>
                Configure the settings for this {node.type} node
              </SheetDescription>
            </div>
            <div className="flex gap-2">
              {onTest && (
                <Button variant="outline" size="sm" onClick={() => onTest(node)}>
                  <BeakerIcon className="h-3 w-3 mr-1" />
                  Test
                </Button>
              )}
              {onPreview && (
                <Button variant="outline" size="sm" onClick={() => onPreview(node)}>
                  <EyeIcon className="h-3 w-3 mr-1" />
                  Preview
                </Button>
              )}
            </div>
          </div>
        </SheetHeader>

        <div className="mt-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="general">General</TabsTrigger>
              <TabsTrigger value="config">Configuration</TabsTrigger>
            </TabsList>

            <TabsContent value="general" className="space-y-4">
              <GeneralNodeConfig node={node} onSave={handleSave} />
            </TabsContent>

            <TabsContent value="config" className="space-y-4">
              {node.type === 'trigger' && (
                <TriggerNodeConfig node={node} onSave={handleSave} />
              )}
              {node.type === 'action' && (
                <ActionNodeConfig node={node} onSave={handleSave} />
              )}
              {node.type === 'condition' && (
                <ConditionNodeConfig node={node} onSave={handleSave} />
              )}
              {node.type === 'delay' && (
                <DelayNodeConfig node={node} onSave={handleSave} />
              )}
              {node.type === 'split' && (
                <SplitNodeConfig node={node} onSave={handleSave} />
              )}
            </TabsContent>
          </Tabs>
        </div>
      </SheetContent>
    </Sheet>
  );
}

// General node configuration component
function GeneralNodeConfig({
  node,
  onSave,
}: {
  node: WorkflowNode;
  onSave: (node: WorkflowNode) => void;
}) {
  const [label, setLabel] = useState(node.data.label);
  const [description, setDescription] = useState(node.data.description || '');

  const handleSave = () => {
    onSave({
      ...node,
      data: {
        ...node.data,
        label,
        description,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">General Settings</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="label">Label</Label>
          <Input
            id="label"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Enter node label"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Enter node description"
            rows={3}
          />
        </div>

        <Button onClick={handleSave} className="w-full">
          <BookmarkIcon className="h-3 w-3 mr-1" />
          Save Changes
        </Button>
      </CardContent>
    </Card>
  );
}

// Trigger node configuration
function TriggerNodeConfig({
  node,
  onSave,
}: {
  node: WorkflowNode;
  onSave: (node: WorkflowNode) => void;
}) {
  const config = node.data.config as TriggerConfig;
  const [triggerType, setTriggerType] = useState(config.type || 'event');
  const [eventName, setEventName] = useState(config.eventName || '');
  const [schedule, setSchedule] = useState(config.schedule || '');
  const [apiEndpoint, setApiEndpoint] = useState(config.apiEndpoint || '');
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl || '');

  const handleSave = () => {
    const updatedConfig: TriggerConfig = {
      type: triggerType as any,
      ...(triggerType === 'event' && { eventName }),
      ...(triggerType === 'time' && { schedule }),
      ...(triggerType === 'api' && { apiEndpoint }),
      ...(triggerType === 'webhook' && { webhookUrl }),
    };

    onSave({
      ...node,
      data: {
        ...node.data,
        config: updatedConfig,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Trigger Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Trigger Type</Label>
          <Select value={triggerType} onValueChange={(value) => setTriggerType(value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="event">Event Trigger</SelectItem>
              <SelectItem value="time">Time Trigger</SelectItem>
              <SelectItem value="api">API Trigger</SelectItem>
              <SelectItem value="webhook">Webhook Trigger</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {triggerType === 'event' && (
          <div className="space-y-2">
            <Label htmlFor="eventName">Event Name</Label>
            <Input
              id="eventName"
              value={eventName}
              onChange={(e) => setEventName(e.target.value)}
              placeholder="e.g., user.signup, order.completed"
            />
          </div>
        )}

        {triggerType === 'time' && (
          <div className="space-y-2">
            <Label htmlFor="schedule">Schedule (Cron Expression)</Label>
            <Input
              id="schedule"
              value={schedule}
              onChange={(e) => setSchedule(e.target.value)}
              placeholder="e.g., 0 9 * * 1 (Every Monday at 9 AM)"
            />
          </div>
        )}

        {triggerType === 'api' && (
          <div className="space-y-2">
            <Label htmlFor="apiEndpoint">API Endpoint</Label>
            <Input
              id="apiEndpoint"
              value={apiEndpoint}
              onChange={(e) => setApiEndpoint(e.target.value)}
              placeholder="e.g., /api/trigger/workflow"
            />
          </div>
        )}

        {triggerType === 'webhook' && (
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/webhook"
            />
          </div>
        )}

        <Button onClick={handleSave} className="w-full">
          <BookmarkIcon className="h-3 w-3 mr-1" />
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}

// Action node configuration
function ActionNodeConfig({
  node,
  onSave,
}: {
  node: WorkflowNode;
  onSave: (node: WorkflowNode) => void;
}) {
  const config = node.data.config as ActionConfig;
  const [actionType, setActionType] = useState(config.type || 'email');
  const [templateId, setTemplateId] = useState(config.templateId || '');
  const [message, setMessage] = useState(config.message || '');
  const [subject, setSubject] = useState(config.subject || '');
  const [webhookUrl, setWebhookUrl] = useState(config.webhookUrl || '');

  const handleSave = () => {
    const updatedConfig: ActionConfig = {
      type: actionType as any,
      ...(templateId && { templateId }),
      ...(message && { message }),
      ...(subject && { subject }),
      ...(webhookUrl && { webhookUrl }),
    };

    onSave({
      ...node,
      data: {
        ...node.data,
        config: updatedConfig,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Action Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Action Type</Label>
          <Select value={actionType} onValueChange={(value) => setActionType(value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="email">Send Email</SelectItem>
              <SelectItem value="sms">Send SMS</SelectItem>
              <SelectItem value="push">Push Notification</SelectItem>
              <SelectItem value="in_app">In-App Message</SelectItem>
              <SelectItem value="voice">Voice Call</SelectItem>
              <SelectItem value="webhook">Webhook</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {(actionType === 'email' || actionType === 'sms' || actionType === 'push' || actionType === 'in_app') && (
          <>
            <div className="space-y-2">
              <Label htmlFor="templateId">Template</Label>
              <Select value={templateId} onValueChange={setTemplateId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select a template" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="welcome-template">Welcome Template</SelectItem>
                  <SelectItem value="notification-template">Notification Template</SelectItem>
                  <SelectItem value="reminder-template">Reminder Template</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {actionType === 'email' && (
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Email subject"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Message content"
                rows={4}
              />
            </div>
          </>
        )}

        {actionType === 'webhook' && (
          <div className="space-y-2">
            <Label htmlFor="webhookUrl">Webhook URL</Label>
            <Input
              id="webhookUrl"
              value={webhookUrl}
              onChange={(e) => setWebhookUrl(e.target.value)}
              placeholder="https://example.com/webhook"
            />
          </div>
        )}

        <Button onClick={handleSave} className="w-full">
          <BookmarkIcon className="h-3 w-3 mr-1" />
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}

// Condition node configuration
function ConditionNodeConfig({
  node,
  onSave,
}: {
  node: WorkflowNode;
  onSave: (node: WorkflowNode) => void;
}) {
  const config = node.data.config as ConditionConfig;
  const [field, setField] = useState(config.field || '');
  const [operator, setOperator] = useState(config.operator || 'equals');
  const [value, setValue] = useState(String(config.value || ''));

  const handleSave = () => {
    const updatedConfig: ConditionConfig = {
      field,
      operator: operator as any,
      value,
    };

    onSave({
      ...node,
      data: {
        ...node.data,
        config: updatedConfig,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Condition Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="field">Field</Label>
          <Input
            id="field"
            value={field}
            onChange={(e) => setField(e.target.value)}
            placeholder="e.g., user.email, order.total"
          />
        </div>

        <div className="space-y-2">
          <Label>Operator</Label>
          <Select value={operator} onValueChange={(value) => setOperator(value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="equals">Equals</SelectItem>
              <SelectItem value="not_equals">Not Equals</SelectItem>
              <SelectItem value="contains">Contains</SelectItem>
              <SelectItem value="not_contains">Not Contains</SelectItem>
              <SelectItem value="greater_than">Greater Than</SelectItem>
              <SelectItem value="less_than">Less Than</SelectItem>
              <SelectItem value="exists">Exists</SelectItem>
              <SelectItem value="not_exists">Not Exists</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label htmlFor="value">Value</Label>
          <Input
            id="value"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Comparison value"
          />
        </div>

        <Button onClick={handleSave} className="w-full">
          <BookmarkIcon className="h-3 w-3 mr-1" />
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}

// Delay node configuration
function DelayNodeConfig({
  node,
  onSave,
}: {
  node: WorkflowNode;
  onSave: (node: WorkflowNode) => void;
}) {
  const config = node.data.config as DelayConfig;
  const [duration, setDuration] = useState(config.duration || 1);
  const [unit, setUnit] = useState(config.unit || 'minutes');

  const handleSave = () => {
    const updatedConfig: DelayConfig = {
      duration,
      unit: unit as any,
    };

    onSave({
      ...node,
      data: {
        ...node.data,
        config: updatedConfig,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Delay Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="duration">Duration</Label>
          <Input
            id="duration"
            type="number"
            min="1"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>

        <div className="space-y-2">
          <Label>Unit</Label>
          <Select value={unit} onValueChange={(value) => setUnit(value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="minutes">Minutes</SelectItem>
              <SelectItem value="hours">Hours</SelectItem>
              <SelectItem value="days">Days</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button onClick={handleSave} className="w-full">
          <BookmarkIcon className="h-3 w-3 mr-1" />
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}

// Split node configuration
function SplitNodeConfig({
  node,
  onSave,
}: {
  node: WorkflowNode;
  onSave: (node: WorkflowNode) => void;
}) {
  const config = node.data.config as SplitConfig;
  const [splitType, setSplitType] = useState(config.type || 'ab_test');
  const [percentage, setPercentage] = useState(config.percentage || 50);

  const handleSave = () => {
    const updatedConfig: SplitConfig = {
      type: splitType as any,
      percentage,
      branches: config.branches || [],
    };

    onSave({
      ...node,
      data: {
        ...node.data,
        config: updatedConfig,
      },
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm">Split Configuration</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label>Split Type</Label>
          <Select value={splitType} onValueChange={(value) => setSplitType(value as any)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ab_test">A/B Test</SelectItem>
              <SelectItem value="random">Random Split</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {splitType === 'ab_test' && (
          <div className="space-y-2">
            <Label htmlFor="percentage">A Branch Percentage</Label>
            <Input
              id="percentage"
              type="number"
              min="0"
              max="100"
              value={percentage}
              onChange={(e) => setPercentage(Number(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              B Branch will get {100 - percentage}%
            </p>
          </div>
        )}

        <Button onClick={handleSave} className="w-full">
          <BookmarkIcon className="h-3 w-3 mr-1" />
          Save Configuration
        </Button>
      </CardContent>
    </Card>
  );
}