'use client';

import { Bell, Clock, GitBranch, Mail, MessageSquare, Phone, Zap } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { WorkflowNode, WorkflowNodeType } from '@/lib/types/workflow';
import { cn } from '@/lib/utils';
import { useDraggable } from '@dnd-kit/core';
import { BellIcon, ClockIcon, CodeBracketSquareIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, PhoneIcon, PlusIcon, Cog6ToothIcon, TrashIcon, BoltIcon } from '@heroicons/react/24/outline'
import React from 'react';

interface WorkflowNodeComponentProps {
  node: WorkflowNode;
  isSelected: boolean;
  isConnecting: boolean;
  onSelect: (nodeId: string) => void;
  onDelete: (nodeId: string) => void;
  onConfigure?: (nodeId: string) => void;
  onConnectionStart: (nodeId: string) => void;
  onConnectionEnd: (nodeId: string) => void;
  readonly?: boolean;
  isDragging?: boolean;
}

const NODE_ICONS: Record<WorkflowNodeType, React.ComponentType<{ className?: string }>> = {
  trigger: Zap,
  action: Mail,
  condition: GitBranch,
  delay: Clock,
  split: GitBranch,
};

const NODE_COLORS: Record<WorkflowNodeType, string> = {
  trigger: 'border-green-500 bg-green-50 dark:bg-green-950',
  action: 'border-blue-500 bg-blue-50 dark:bg-blue-950',
  condition: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-950',
  delay: 'border-purple-500 bg-purple-50 dark:bg-purple-950',
  split: 'border-orange-500 bg-orange-50 dark:bg-orange-950',
};

const ACTION_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  sms: MessageSquare,
  push: Bell,
  in_app: Bell,
  voice: Phone,
};

export function WorkflowNodeComponent({
  node,
  isSelected,
  isConnecting,
  onSelect,
  onDelete,
  onConfigure,
  onConnectionStart,
  onConnectionEnd,
  readonly = false,
  isDragging = false,
}: WorkflowNodeComponentProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    isDragging: isDndDragging,
  } = useDraggable({
    id: node.id,
    disabled: readonly,
  });

  const IconComponent = NODE_ICONS[node.type];
  const nodeColorClass = NODE_COLORS[node.type];

  // Get action-specific icon for action nodes
  const getActionIcon = () => {
    if (node.type === 'action' && 'type' in node.data.config) {
      const actionType = (node.data.config as any).type;
      const ActionIcon = ACTION_ICONS[actionType];
      return ActionIcon || Mail;
    }
    return IconComponent;
  };

  const ActualIcon = getActionIcon();

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (isConnecting) {
      onConnectionEnd(node.id);
    } else {
      onSelect(node.id);
    }
  };

  const handleConnectionClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConnectionStart(node.id);
  };

  const handleDeleteClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete(node.id);
  };

  const handleConfigureClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    onConfigure?.(node.id);
  };

  const style = transform ? {
    transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`,
  } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={{
        position: 'absolute',
        left: node.position.x,
        top: node.position.y,
        ...style,
      }}
      className={cn(
        "group cursor-pointer transition-all duration-200",
        isDragging && "opacity-50",
        isDndDragging && "z-50"
      )}
      {...listeners}
      {...attributes}
    >
      <Card
        className={cn(
          "w-48 border-2 transition-all duration-200 hover:shadow-md",
          nodeColorClass,
          isSelected && "ring-2 ring-primary ring-offset-2",
          isConnecting && "ring-2 ring-blue-400 ring-offset-2"
        )}
        onClick={handleClick}
      >
        <CardContent className="p-4">
          {/* Node Header */}
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <ActualIcon className="h-4 w-4" />
              <Badge variant="secondary" className="text-xs">
                {node.type}
              </Badge>
            </div>

            {!readonly && (
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleConfigureClick}
                >
                  <Cog6ToothIcon className="h-3 w-3" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6"
                  onClick={handleDeleteClick}
                >
                  <TrashIcon className="h-3 w-3" />
                </Button>
              </div>
            )}
          </div>

          {/* Node Content */}
          <div className="space-y-2">
            <h4 className="font-medium text-sm truncate">
              {node.data.label}
            </h4>

            {node.data.description && (
              <p className="text-xs text-muted-foreground line-clamp-2">
                {node.data.description}
              </p>
            )}

            {/* Node-specific content */}
            {node.type === 'trigger' && 'type' in node.data.config && (
              <Badge variant="outline" className="text-xs">
                {(node.data.config as any).type}
              </Badge>
            )}

            {node.type === 'action' && 'type' in node.data.config && (
              <Badge variant="outline" className="text-xs">
                {(node.data.config as any).type}
              </Badge>
            )}

            {node.type === 'delay' && 'duration' in node.data.config && (
              <Badge variant="outline" className="text-xs">
                {(node.data.config as any).duration} {(node.data.config as any).unit}
              </Badge>
            )}
          </div>

          {/* Connection Points */}
          {!readonly && (
            <div className="absolute -right-2 top-1/2 -translate-y-1/2">
              <Button
                variant="outline"
                size="icon"
                className="h-6 w-6 rounded-full bg-background opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={handleConnectionClick}
              >
                <PlusIcon className="h-3 w-3" />
              </Button>
            </div>
          )}

          {/* Input connection point */}
          {node.type !== 'trigger' && (
            <div className="absolute -left-2 top-1/2 -translate-y-1/2">
              <div className="h-3 w-3 rounded-full bg-background border-2 border-muted-foreground" />
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}