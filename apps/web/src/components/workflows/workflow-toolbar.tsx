'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Workflow } from '@/lib/types/workflow';
import { cn } from '@/lib/utils';
import { EyeIcon, PauseIcon, PlayIcon, BookmarkIcon, Cog6ToothIcon, StopIcon, ClockIcon, BeakerIcon } from '@heroicons/react/24/outline'

interface WorkflowToolbarProps {
  workflow: Workflow;
  onSave?: () => void;
  onPlay?: () => void;
  onPause?: () => void;
  onStop?: () => void;
  onPreview?: () => void;
  onTest?: () => void;
  onSettings?: () => void;
  onHistory?: () => void;
  readonly?: boolean;
  className?: string;
}

export function WorkflowToolbar({
  workflow,
  onSave,
  onPlay,
  onPause,
  onStop,
  onPreview,
  onTest,
  onSettings,
  onHistory,
  readonly = false,
  className,
}: WorkflowToolbarProps) {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-500';
      case 'paused':
        return 'bg-yellow-500';
      case 'draft':
        return 'bg-gray-500';
      case 'archived':
        return 'bg-red-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'active':
        return 'Active';
      case 'paused':
        return 'Paused';
      case 'draft':
        return 'Draft';
      case 'archived':
        return 'Archived';
      default:
        return 'Unknown';
    }
  };

  return (
    <div className={cn("flex items-center gap-2 p-2 bg-background border rounded-lg shadow-sm", className)}>
      {/* Workflow Info */}
      <div className="flex items-center gap-2 mr-4">
        <h3 className="font-medium text-sm">{workflow.name}</h3>
        <Badge variant="outline" className="flex items-center gap-1">
          <div className={cn("w-2 h-2 rounded-full", getStatusColor(workflow.status))} />
          {getStatusText(workflow.status)}
        </Badge>
        <Badge variant="secondary" className="text-xs">
          v{workflow.version}
        </Badge>
      </div>

      {/* Action Buttons */}
      <div className="flex items-center gap-1">
        {!readonly && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={onSave}
              className="flex items-center gap-1"
            >
              <BookmarkIcon className="h-3 w-3" />
              Save
            </Button>

            {workflow.status === 'draft' || workflow.status === 'paused' ? (
              <Button
                variant="default"
                size="sm"
                onClick={onPlay}
                className="flex items-center gap-1"
              >
                <PlayIcon className="h-3 w-3" />
                Start
              </Button>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={onPause}
                className="flex items-center gap-1"
              >
                <PauseIcon className="h-3 w-3" />
                Pause
              </Button>
            )}

            {workflow.status === 'active' && (
              <Button
                variant="outline"
                size="sm"
                onClick={onStop}
                className="flex items-center gap-1"
              >
                <StopIcon className="h-3 w-3" />
                Stop
              </Button>
            )}
          </>
        )}

        <Button
          variant="outline"
          size="sm"
          onClick={onPreview}
          className="flex items-center gap-1"
        >
          <EyeIcon className="h-3 w-3" />
          Preview
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onTest}
          className="flex items-center gap-1"
        >
          <BeakerIcon className="h-3 w-3" />
          Test
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onHistory}
          className="flex items-center gap-1"
        >
          <ClockIcon className="h-3 w-3" />
          History
        </Button>

        <Button
          variant="outline"
          size="sm"
          onClick={onSettings}
          className="flex items-center gap-1"
        >
          <Cog6ToothIcon className="h-3 w-3" />
          Settings
        </Button>
      </div>

      {/* Workflow Stats */}
      <div className="flex items-center gap-4 ml-4 text-xs text-muted-foreground">
        <span>{workflow.nodes.length} nodes</span>
        <span>{workflow.connections.length} connections</span>
        {workflow.analytics && (
          <span>{workflow.analytics.totalExecutions} executions</span>
        )}
      </div>
    </div>
  );
}