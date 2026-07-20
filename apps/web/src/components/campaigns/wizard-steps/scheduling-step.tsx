'use client';

import { Calendar, Repeat, Send, Zap } from '@/lib/icons';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import type { RecurringConfig, ScheduleConfig } from '@/lib/types/campaign';
import { CalendarIcon, ClockIcon, GlobeAltIcon, BoltIcon, ArrowPathIcon } from '@heroicons/react/24/outline'
import { useEffect, useState } from 'react';

interface SchedulingStepProps {
  data?: ScheduleConfig;
  onUpdate: (data: ScheduleConfig) => void;
}

const SCHEDULE_TYPES = [
  {
    value: 'immediate' as const,
    label: 'Send Immediately',
    description: 'Send the campaign right after creation',
    icon: Zap,
  },
  {
    value: 'scheduled' as const,
    label: 'Schedule for Later',
    description: 'Choose a specific date and time to send',
    icon: Calendar,
  },
  {
    value: 'recurring' as const,
    label: 'Recurring Schedule',
    description: 'Send on a regular schedule (daily, weekly, monthly)',
    icon: Repeat,
  },
];

const TIMEZONES = [
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Europe/London', label: 'London (GMT/BST)' },
  { value: 'Europe/Paris', label: 'Paris (CET/CEST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEST/AEDT)' },
];

const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday', short: 'Sun' },
  { value: 1, label: 'Monday', short: 'Mon' },
  { value: 2, label: 'Tuesday', short: 'Tue' },
  { value: 3, label: 'Wednesday', short: 'Wed' },
  { value: 4, label: 'Thursday', short: 'Thu' },
  { value: 5, label: 'Friday', short: 'Fri' },
  { value: 6, label: 'Saturday', short: 'Sat' },
];

export function SchedulingStep({ data, onUpdate }: SchedulingStepProps) {
  const [scheduleType, setScheduleType] = useState<'immediate' | 'scheduled' | 'recurring'>(
    data?.type || 'immediate'
  );
  const [scheduledAt, setScheduledAt] = useState<string>(
    data?.scheduledAt ? new Date(data.scheduledAt).toISOString().slice(0, 16) : ''
  );
  const [timezone, setTimezone] = useState<string>(
    data?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone
  );
  const [recurring, setRecurring] = useState<RecurringConfig>(
    data?.recurring || {
      frequency: 'weekly',
      interval: 1,
      daysOfWeek: [1], // Monday
    }
  );

  useEffect(() => {
    const config: ScheduleConfig = {
      type: scheduleType,
      ...(scheduleType === 'scheduled' && scheduledAt && {
        scheduledAt: new Date(scheduledAt),
        timezone,
      }),
      ...(scheduleType === 'recurring' && {
        timezone,
        recurring,
      }),
    };
    onUpdate(config);
  }, [scheduleType, scheduledAt, timezone, recurring, onUpdate]);

  const handleScheduleTypeChange = (type: 'immediate' | 'scheduled' | 'recurring') => {
    setScheduleType(type);
  };

  const updateRecurring = (updates: Partial<RecurringConfig>) => {
    setRecurring(prev => ({ ...prev, ...updates }));
  };

  const toggleDayOfWeek = (day: number) => {
    const currentDays = recurring.daysOfWeek || [];
    const newDays = currentDays.includes(day)
      ? currentDays.filter(d => d !== day)
      : [...currentDays, day].sort();
    updateRecurring({ daysOfWeek: newDays });
  };

  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5); // Minimum 5 minutes from now
    return now.toISOString().slice(0, 16);
  };

  const formatSchedulePreview = () => {
    if (scheduleType === 'immediate') {
      return 'Campaign will be sent immediately after creation';
    }

    if (scheduleType === 'scheduled' && scheduledAt) {
      const date = new Date(scheduledAt);
      return `Campaign will be sent on ${date.toLocaleDateString()} at ${date.toLocaleTimeString()} (${timezone})`;
    }

    if (scheduleType === 'recurring') {
      const { frequency, interval, daysOfWeek, dayOfMonth } = recurring;

      if (frequency === 'daily') {
        return `Campaign will be sent every ${interval === 1 ? 'day' : `${interval} days`}`;
      }

      if (frequency === 'weekly' && daysOfWeek) {
        const dayNames = daysOfWeek.map(d => DAYS_OF_WEEK.find(day => day.value === d)?.short).join(', ');
        return `Campaign will be sent every ${interval === 1 ? 'week' : `${interval} weeks`} on ${dayNames}`;
      }

      if (frequency === 'monthly') {
        return `Campaign will be sent every ${interval === 1 ? 'month' : `${interval} months`}${dayOfMonth ? ` on day ${dayOfMonth}` : ''}`;
      }

      if (frequency === 'yearly') {
        return `Campaign will be sent every ${interval === 1 ? 'year' : `${interval} years`}`;
      }
    }

    return 'Please complete the schedule configuration';
  };

  return (
    <div className="space-y-6">
      {/* Schedule Type Selection */}
      <div className="space-y-4">
        <Label className="text-base font-medium">When to Send</Label>
        <div className="grid gap-4">
          {SCHEDULE_TYPES.map((type) => {
            const Icon = type.icon;
            const isSelected = scheduleType === type.value;

            return (
              <Card
                key={type.value}
                className={`cursor-pointer transition-all hover:shadow-md ${isSelected
                    ? 'ring-2 ring-primary border-primary bg-primary/5'
                    : 'hover:border-primary/50'
                  }`}
                onClick={() => handleScheduleTypeChange(type.value)}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${isSelected ? 'bg-primary text-primary-foreground' : 'bg-muted'
                      }`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <CardTitle className="text-base">{type.label}</CardTitle>
                      <CardDescription>{type.description}</CardDescription>
                    </div>
                  </div>
                </CardHeader>
              </Card>
            );
          })}
        </div>
      </div>

      {/* Scheduled Configuration */}
      {scheduleType === 'scheduled' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CalendarIcon className="w-4 h-4" />
              Schedule Configuration
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="scheduled-datetime">Date & Time</Label>
                <Input
                  id="scheduled-datetime"
                  type="datetime-local"
                  value={scheduledAt}
                  min={getMinDateTime()}
                  onChange={(e) => setScheduledAt(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label>Timezone</Label>
                <Select value={timezone} onValueChange={setTimezone}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIMEZONES.map((tz) => (
                      <SelectItem key={tz.value} value={tz.value}>
                        {tz.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recurring Configuration */}
      {scheduleType === 'recurring' && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ArrowPathIcon className="w-4 h-4" />
              Recurring Schedule
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Frequency */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={recurring.frequency}
                  onValueChange={(value: any) => updateRecurring({ frequency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="daily">Daily</SelectItem>
                    <SelectItem value="weekly">Weekly</SelectItem>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="yearly">Yearly</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Interval</Label>
                <div className="flex items-center gap-2">
                  <span className="text-sm">Every</span>
                  <Input
                    type="number"
                    min="1"
                    max="365"
                    value={recurring.interval}
                    onChange={(e) => updateRecurring({ interval: parseInt(e.target.value) || 1 })}
                    className="w-20"
                  />
                  <span className="text-sm">
                    {recurring.frequency === 'daily' && (recurring.interval === 1 ? 'day' : 'days')}
                    {recurring.frequency === 'weekly' && (recurring.interval === 1 ? 'week' : 'weeks')}
                    {recurring.frequency === 'monthly' && (recurring.interval === 1 ? 'month' : 'months')}
                    {recurring.frequency === 'yearly' && (recurring.interval === 1 ? 'year' : 'years')}
                  </span>
                </div>
              </div>
            </div>

            {/* Days of Week (for weekly) */}
            {recurring.frequency === 'weekly' && (
              <div className="space-y-3">
                <Label>Days of Week</Label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const isSelected = recurring.daysOfWeek?.includes(day.value) || false;
                    return (
                      <Button
                        key={day.value}
                        variant={isSelected ? "default" : "outline"}
                        size="sm"
                        onClick={() => toggleDayOfWeek(day.value)}
                        className="w-12"
                      >
                        {day.short}
                      </Button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Day of Month (for monthly) */}
            {recurring.frequency === 'monthly' && (
              <div className="space-y-2">
                <Label>Day of Month</Label>
                <Input
                  type="number"
                  min="1"
                  max="31"
                  value={recurring.dayOfMonth || ''}
                  onChange={(e) => updateRecurring({ dayOfMonth: parseInt(e.target.value) || undefined })}
                  placeholder="Leave empty for same day as start date"
                />
              </div>
            )}

            {/* End Conditions */}
            <div className="space-y-4">
              <Label>End Conditions</Label>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="end-date">End Date (Optional)</Label>
                  <Input
                    id="end-date"
                    type="date"
                    value={recurring.endDate ? new Date(recurring.endDate).toISOString().slice(0, 10) : ''}
                    onChange={(e) => updateRecurring({
                      endDate: e.target.value ? new Date(e.target.value) : undefined
                    })}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="max-occurrences">Max Occurrences (Optional)</Label>
                  <Input
                    id="max-occurrences"
                    type="number"
                    min="1"
                    value={recurring.maxOccurrences || ''}
                    onChange={(e) => updateRecurring({
                      maxOccurrences: parseInt(e.target.value) || undefined
                    })}
                    placeholder="Unlimited"
                  />
                </div>
              </div>
            </div>

            {/* Timezone */}
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select value={timezone} onValueChange={setTimezone}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map((tz) => (
                    <SelectItem key={tz.value} value={tz.value}>
                      {tz.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Schedule Preview */}
      <Card className="bg-blue-50 border-blue-200 dark:bg-blue-950/20 dark:border-blue-800">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <ClockIcon className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h4 className="font-medium text-blue-700 dark:text-blue-400">
                Schedule Preview
              </h4>
              <p className="text-sm text-blue-600 dark:text-blue-500 mt-1">
                {formatSchedulePreview()}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Timezone Info */}
      <Card className="bg-muted/50">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <GlobeAltIcon className="w-4 h-4 text-muted-foreground mt-0.5" />
            <div className="text-sm text-muted-foreground">
              <p className="font-medium">Timezone Information</p>
              <p className="mt-1">
                All times are displayed in the selected timezone. Recipients in different timezones
                will receive the campaign at the equivalent local time unless timezone optimization
                is configured in audience settings.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}