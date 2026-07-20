'use client';

import { Bell, Calendar, Clock, GitBranch, Mail, MessageSquare, Phone, Send, Webhook, Zap } from '@/lib/icons';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { WorkflowPosition } from '@/lib/types/workflow';
import { cn } from '@/lib/utils';
import { BellIcon, CalendarIcon, ChevronDownIcon, ChevronRightIcon, ClockIcon, CodeBracketSquareIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, PhoneIcon, BoltIcon, CursorArrowRaysIcon, LinkIcon } from '@heroicons/react/24/outline'
import React, { useState } from 'react';

interface WorkflowNodePaletteProps {
  onAddNode: (nodeType: string, position: WorkflowPosition) => void;
  className?: string;
}

interface NodeTemplate {
  type: string;
  subtype?: string;
  label: string;
  description: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
}

const NODE_TEMPLATES: Record<string, NodeTemplate[]> = {
  triggers: [
    {
      type: 'trigger',
      subtype: 'event',
      label: 'Event Trigger',
      description: 'Triggered by user actions or system events',
      icon: Zap,
      color: 'text-green-600',
    },
    {
      type: 'trigger',
      subtype: 'time',
      label: 'Time Trigger',
      description: 'Triggered at specific times or intervals',
      icon: Calendar,
      color: 'text-green-600',
    },
    {
      type: 'trigger',
      subtype: 'api',
      label: 'API Trigger',
      description: 'Triggered by API calls',
      icon: Webhook,
      color: 'text-green-600',
    },
  ],
  actions: [
    {
      type: 'action',
      subtype: 'email',
      label: 'Send Email',
      description: 'Send email notifications',
      icon: Mail,
      color: 'text-blue-600',
    },
    {
      type: 'action',
      subtype: 'sms',
      label: 'Send SMS',
      description: 'Send SMS messages',
      icon: MessageSquare,
      color: 'text-blue-600',
    },
    {
      type: 'action',
      subtype: 'push',
      label: 'Push Notification',
      description: 'Send push notifications',
      icon: Bell,
      color: 'text-blue-600',
    },
    {
      type: 'action',
      subtype: 'in_app',
      label: 'In-App Message',
      description: 'Show in-app notifications',
      icon: Bell,
      color: 'text-blue-600',
    },
    {
      type: 'action',
      subtype: 'voice',
      label: 'Voice Call',
      description: 'Make voice calls',
      icon: Phone,
      color: 'text-blue-600',
    },
    {
      type: 'action',
      subtype: 'webhook',
      label: 'Webhook',
      description: 'Send HTTP requests',
      icon: Webhook,
      color: 'text-blue-600',
    },
  ],
  logic: [
    {
      type: 'condition',
      label: 'Condition',
      description: 'Branch based on conditions',
      icon: GitBranch,
      color: 'text-yellow-600',
    },
    {
      type: 'delay',
      label: 'Delay',
      description: 'Wait for a specified time',
      icon: Clock,
      color: 'text-purple-600',
    },
    {
      type: 'split',
      label: 'A/B Split',
      description: 'Split traffic for testing',
      icon: GitBranch,
      color: 'text-orange-600',
    },
  ],
};

export function WorkflowNodePalette({
  onAddNode,
  className,
}: WorkflowNodePaletteProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['triggers', 'actions', 'logic'])
  );
  const [isMinimized, setIsMinimized] = useState(false);

  const toggleSection = (section: string) => {
    const newExpanded = new Set(expandedSections);
    if (newExpanded.has(section)) {
      newExpanded.delete(section);
    } else {
      newExpanded.add(section);
    }
    setExpandedSections(newExpanded);
  };

  const handleNodeDrag = (template: NodeTemplate, event: React.DragEvent) => {
    event.dataTransfer.setData('application/json', JSON.stringify({
      type: template.type,
      subtype: template.subtype,
      label: template.label,
    }));
  };

  const handleNodeClick = (template: NodeTemplate) => {
    // Add node at a default position (center of canvas)
    onAddNode(template.type, { x: 400, y: 300 });
  };

  if (isMinimized) {
    return (
      <Button
        variant="outline"
        onClick={() => setIsMinimized(false)}
        className={cn("flex items-center gap-2", className)}
      >
        <CursorArrowRaysIcon className="h-4 w-4" />
        Node Palette
      </Button>
    );
  }

  return (
    <Card className={cn("w-64", className)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Node Palette</CardTitle>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsMinimized(true)}
            className="h-6 w-6 p-0"
          >
            <ChevronDownIcon className="h-3 w-3" />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-96">
          <div className="p-3 space-y-3">
            {Object.entries(NODE_TEMPLATES).map(([sectionKey, templates]) => (
              <div key={sectionKey}>
                <Button
                  variant="ghost"
                  onClick={() => toggleSection(sectionKey)}
                  className="w-full justify-between p-2 h-auto"
                >
                  <span className="font-medium text-sm capitalize">
                    {sectionKey}
                  </span>
                  {expandedSections.has(sectionKey) ? (
                    <ChevronDownIcon className="h-3 w-3" />
                  ) : (
                    <ChevronRightIcon className="h-3 w-3" />
                  )}
                </Button>

                {expandedSections.has(sectionKey) && (
                  <div className="space-y-1 mt-1">
                    {templates.map((template, index) => (
                      <div
                        key={`${template.type}-${template.subtype || index}`}
                        draggable
                        onDragStart={(e) => handleNodeDrag(template, e)}
                        onClick={() => handleNodeClick(template)}
                        className="flex items-center gap-2 p-2 rounded-md border border-dashed border-muted-foreground/30 hover:border-muted-foreground/60 hover:bg-muted/50 cursor-pointer transition-colors"
                      >
                        <template.icon className={cn("h-4 w-4", template.color)} />
                        <div className="flex-1 min-w-0">
                          <div className="text-xs font-medium truncate">
                            {template.label}
                          </div>
                          <div className="text-xs text-muted-foreground truncate">
                            {template.description}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {sectionKey !== 'logic' && <Separator className="mt-2" />}
              </div>
            ))}
          </div>
        </ScrollArea>

        <div className="p-3 border-t">
          <p className="text-xs text-muted-foreground">
            Drag nodes to canvas or click to add at center
          </p>
        </div>
      </CardContent>
    </Card>
  );
}