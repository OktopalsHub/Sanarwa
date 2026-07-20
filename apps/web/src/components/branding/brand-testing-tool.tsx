'use client';

import { Bell, Mail, MessageSquare } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BrandingConfig } from '@/contexts/branding-context';
import { useBrandApplication } from '@/hooks/use-brand-application';
import { cn } from '@/lib/utils';
import { ExclamationCircleIcon, BellIcon, CheckCircleIcon, EnvelopeIcon, ChatBubbleLeftRightIcon, PlayIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';

interface BrandTestingToolProps {
  branding: BrandingConfig;
  className?: string;
}

export function BrandTestingTool({ branding, className }: BrandTestingToolProps) {
  const { chartColors, accessibilityReport } = useBrandApplication();
  const [testResults, setTestResults] = useState<{
    accessibility: boolean;
    contrast: boolean;
    consistency: boolean;
    usability: boolean;
  } | null>(null);

  const runBrandTests = () => {
    // Simulate running brand tests
    setTimeout(() => {
      setTestResults({
        accessibility: accessibilityReport.isValid,
        contrast: accessibilityReport.issues.length === 0,
        consistency: true,
        usability: true,
      });
    }, 1500);
  };

  const previewStyle = {
    '--test-primary': branding.colors.primary,
    '--test-secondary': branding.colors.secondary,
    '--test-accent': branding.colors.accent,
    '--test-background': branding.colors.background,
    '--test-foreground': branding.colors.foreground,
    '--test-muted': branding.colors.muted || '#f1f5f9',
    '--test-muted-foreground': branding.colors.mutedForeground || '#64748b',
    '--test-border': branding.colors.border || '#e2e8f0',
    '--test-destructive': branding.colors.destructive || '#ef4444',
    '--test-font-family': branding.typography.fontFamily,
    '--test-heading-font': branding.typography.headingFont || branding.typography.fontFamily,
  } as React.CSSProperties;

  return (
    <Card className={cn('p-6', className)} style={previewStyle}>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold">Brand Testing Tool</h3>
            <p className="text-sm text-muted-foreground">
              Test your brand across different scenarios and components
            </p>
          </div>
          <Button onClick={runBrandTests} disabled={!!testResults}>
            <PlayIcon className="h-4 w-4 mr-2" />
            Run Tests
          </Button>
        </div>

        {testResults && (
          <Card className="p-4">
            <h4 className="font-medium mb-3">Test Results</h4>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div className="flex items-center gap-2">
                {testResults.accessibility ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <ExclamationCircleIcon className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Accessibility</span>
              </div>
              <div className="flex items-center gap-2">
                {testResults.contrast ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <ExclamationCircleIcon className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Contrast</span>
              </div>
              <div className="flex items-center gap-2">
                {testResults.consistency ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <ExclamationCircleIcon className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Consistency</span>
              </div>
              <div className="flex items-center gap-2">
                {testResults.usability ? (
                  <CheckCircleIcon className="h-4 w-4 text-green-600" />
                ) : (
                  <ExclamationCircleIcon className="h-4 w-4 text-red-600" />
                )}
                <span className="text-sm">Usability</span>
              </div>
            </div>
          </Card>
        )}

        <Tabs defaultValue="components" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="components">Components</TabsTrigger>
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="emails">Email Templates</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
          </TabsList>

          <TabsContent value="components" className="space-y-6 mt-6">
            {/* Buttons */}
            <div className="space-y-3">
              <h4 className="font-medium">Buttons</h4>
              <div className="flex flex-wrap gap-3">
                <Button style={{ backgroundColor: 'var(--test-primary)', color: 'white' }}>
                  Primary Button
                </Button>
                <Button
                  variant="outline"
                  style={{
                    borderColor: 'var(--test-border)',
                    color: 'var(--test-foreground)'
                  }}
                >
                  Secondary Button
                </Button>
                <Button
                  style={{ backgroundColor: 'var(--test-accent)', color: 'white' }}
                >
                  Accent Button
                </Button>
                <Button
                  variant="destructive"
                  style={{ backgroundColor: 'var(--test-destructive)', color: 'white' }}
                >
                  Destructive
                </Button>
              </div>
            </div>

            {/* Form Elements */}
            <div className="space-y-3">
              <h4 className="font-medium">Form Elements</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label style={{ color: 'var(--test-foreground)' }}>Input Field</Label>
                  <Input
                    placeholder="Enter text here"
                    style={{
                      borderColor: 'var(--test-border)',
                      backgroundColor: 'var(--test-background)',
                      color: 'var(--test-foreground)'
                    }}
                  />
                </div>
                <div className="space-y-2">
                  <Label style={{ color: 'var(--test-foreground)' }}>Progress Bar</Label>
                  <Progress
                    value={65}
                    className="w-full"
                    style={{
                      backgroundColor: 'var(--test-muted)',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Badges */}
            <div className="space-y-3">
              <h4 className="font-medium">Status Badges</h4>
              <div className="flex flex-wrap gap-2">
                <Badge style={{ backgroundColor: 'var(--test-primary)', color: 'white' }}>
                  Active
                </Badge>
                <Badge
                  variant="secondary"
                  style={{
                    backgroundColor: 'var(--test-muted)',
                    color: 'var(--test-muted-foreground)'
                  }}
                >
                  Pending
                </Badge>
                <Badge style={{ backgroundColor: 'var(--test-accent)', color: 'white' }}>
                  Featured
                </Badge>
                <Badge
                  variant="destructive"
                  style={{ backgroundColor: 'var(--test-destructive)', color: 'white' }}
                >
                  Error
                </Badge>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h4 className="font-medium">In-App Notifications</h4>

              {/* Success Notification */}
              <div
                className="p-4 rounded-lg border-l-4 flex items-center gap-3"
                style={{
                  backgroundColor: 'var(--test-background)',
                  borderLeftColor: 'var(--test-primary)',
                  borderColor: 'var(--test-border)'
                }}
              >
                <CheckCircleIcon
                  className="h-5 w-5"
                  style={{ color: 'var(--test-primary)' }}
                />
                <div>
                  <p
                    className="font-medium"
                    style={{ color: 'var(--test-foreground)' }}
                  >
                    Campaign sent successfully!
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--test-muted-foreground)' }}
                  >
                    Your email campaign has been delivered to 1,234 recipients.
                  </p>
                </div>
              </div>

              {/* Warning Notification */}
              <div
                className="p-4 rounded-lg border-l-4 flex items-center gap-3"
                style={{
                  backgroundColor: 'var(--test-background)',
                  borderLeftColor: 'var(--test-accent)',
                  borderColor: 'var(--test-border)'
                }}
              >
                <ExclamationCircleIcon
                  className="h-5 w-5"
                  style={{ color: 'var(--test-accent)' }}
                />
                <div>
                  <p
                    className="font-medium"
                    style={{ color: 'var(--test-foreground)' }}
                  >
                    Low delivery rate detected
                  </p>
                  <p
                    className="text-sm"
                    style={{ color: 'var(--test-muted-foreground)' }}
                  >
                    Consider reviewing your email content and sender reputation.
                  </p>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="emails" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h4 className="font-medium">Email Template Preview</h4>

              <div
                className="p-6 rounded-lg border max-w-md mx-auto"
                style={{
                  backgroundColor: 'var(--test-background)',
                  borderColor: 'var(--test-border)',
                  fontFamily: 'var(--test-font-family)'
                }}
              >
                <div className="text-center mb-4">
                  {branding.logo.light && (
                    <img
                      src={branding.logo.light}
                      alt="Logo"
                      className="h-8 mx-auto mb-4"
                    />
                  )}
                  <h2
                    className="text-xl font-bold"
                    style={{
                      color: 'var(--test-primary)',
                      fontFamily: 'var(--test-heading-font)'
                    }}
                  >
                    Welcome to {branding.name}!
                  </h2>
                </div>

                <div className="space-y-4">
                  <p style={{ color: 'var(--test-foreground)' }}>
                    Thank you for joining our platform. We're excited to help you manage your communications effectively.
                  </p>

                  <div className="text-center">
                    <Button
                      style={{
                        backgroundColor: 'var(--test-primary)',
                        color: 'white',
                        padding: '12px 24px',
                        borderRadius: '6px'
                      }}
                    >
                      Get Started
                    </Button>
                  </div>

                  <div
                    className="text-center text-sm pt-4 border-t"
                    style={{
                      color: 'var(--test-muted-foreground)',
                      borderColor: 'var(--test-border)'
                    }}
                  >
                    © 2024 {branding.name}. All rights reserved.
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="dashboard" className="space-y-6 mt-6">
            <div className="space-y-4">
              <h4 className="font-medium">Dashboard Components</h4>

              {/* Metric Cards */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { icon: Mail, label: 'Emails Sent', value: '12,345', change: '+12%' },
                  { icon: MessageSquare, label: 'SMS Delivered', value: '5,678', change: '+8%' },
                  { icon: Bell, label: 'Push Notifications', value: '9,012', change: '+15%' },
                ].map((metric, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg border"
                    style={{
                      backgroundColor: 'var(--test-background)',
                      borderColor: 'var(--test-border)'
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p
                          className="text-sm"
                          style={{ color: 'var(--test-muted-foreground)' }}
                        >
                          {metric.label}
                        </p>
                        <p
                          className="text-2xl font-bold"
                          style={{ color: 'var(--test-foreground)' }}
                        >
                          {metric.value}
                        </p>
                        <p
                          className="text-sm"
                          style={{ color: 'var(--test-primary)' }}
                        >
                          {metric.change}
                        </p>
                      </div>
                      <div
                        className="p-3 rounded-lg"
                        style={{ backgroundColor: 'var(--test-muted)' }}
                      >
                        <metric.icon
                          className="h-6 w-6"
                          style={{ color: 'var(--test-primary)' }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Chart Colors Preview */}
              <div className="space-y-3">
                <h5 className="font-medium">Chart Color Palette</h5>
                <div className="flex gap-2">
                  {chartColors.slice(0, 8).map((color, index) => (
                    <div
                      key={index}
                      className="w-8 h-8 rounded border border-border"
                      style={{ backgroundColor: color }}
                      title={color}
                    />
                  ))}
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </Card>
  );
}