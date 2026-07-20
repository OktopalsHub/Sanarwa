'use client';

import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { cn } from '@/lib/utils';
import { EllipsisHorizontalIcon, ArrowPathIcon, ArrowsPointingOutIcon, ArrowsPointingInIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';

interface DashboardWidgetProps {
  title: string;
  children: React.ReactNode;
  className?: string;
  onRefresh?: () => void;
  isLoading?: boolean;
  expandable?: boolean;
}

export function DashboardWidget({
  title,
  children,
  className,
  onRefresh,
  isLoading = false,
  expandable = false,
}: DashboardWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  return (
    <Card
      className={cn(
        'transition-all duration-200',
        isExpanded && 'col-span-full row-span-2',
        className
      )}
    >
      <div className="flex items-center justify-between p-4 border-b">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex items-center space-x-2">
          {onRefresh && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onRefresh}
              disabled={isLoading}
              className="h-8 w-8 p-0"
            >
              <ArrowPathIcon
                className={cn('h-4 w-4', isLoading && 'animate-spin')}
              />
            </Button>
          )}
          {expandable && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsExpanded(!isExpanded)}
              className="h-8 w-8 p-0"
            >
              {isExpanded ? (
                <ArrowsPointingInIcon className="h-4 w-4" />
              ) : (
                <ArrowsPointingOutIcon className="h-4 w-4" />
              )}
            </Button>
          )}
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <EllipsisHorizontalIcon className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="p-4">{children}</div>
    </Card>
  );
}