'use client';

import { Button } from './button';
import { Card } from './card';
import { cn } from './utils';
import { CalendarIcon, ChevronDownIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';

export interface DateRange {
  from: Date;
  to: Date;
}

interface DateRangePickerProps {
  value?: DateRange;
  onChange: (range: DateRange) => void;
  className?: string;
}

const presetRanges = [
  {
    label: 'Last 7 days',
    getValue: () => ({
      from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
      to: new Date(),
    }),
  },
  {
    label: 'Last 30 days',
    getValue: () => ({
      from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
      to: new Date(),
    }),
  },
  {
    label: 'Last 90 days',
    getValue: () => ({
      from: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
      to: new Date(),
    }),
  },
  {
    label: 'This month',
    getValue: () => {
      const now = new Date();
      return {
        from: new Date(now.getFullYear(), now.getMonth(), 1),
        to: new Date(),
      };
    },
  },
  {
    label: 'Last month',
    getValue: () => {
      const now = new Date();
      const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const lastDayOfLastMonth = new Date(now.getFullYear(), now.getMonth(), 0);
      return {
        from: lastMonth,
        to: lastDayOfLastMonth,
      };
    },
  },
];

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const formatDate = (date: Date) => {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const displayValue = value
    ? `${formatDate(value.from)} - ${formatDate(value.to)}`
    : 'Select date range';

  return (
    <div className={cn('relative', className)}>
      <Button
        variant="outline"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full justify-between"
      >
        <div className="flex items-center space-x-2">
          <CalendarIcon className="h-4 w-4" />
          <span>{displayValue}</span>
        </div>
        <ChevronDownIcon className="h-4 w-4" />
      </Button>

      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setIsOpen(false)}
          />
          <Card className="absolute top-full left-0 right-0 z-50 mt-2 p-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Quick select</h4>
              {presetRanges.map((preset) => (
                <Button
                  key={preset.label}
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start"
                  onClick={() => {
                    onChange(preset.getValue());
                    setIsOpen(false);
                  }}
                >
                  {preset.label}
                </Button>
              ))}
            </div>
          </Card>
        </>
      )}
    </div>
  );
}