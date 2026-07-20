import { ErrorScenarios } from '@/components/docs/error-scenarios';
import { FeedbackSystem } from '@/components/docs/feedback-system';
import { TroubleshootingGuide } from '@/components/docs/troubleshooting-guide';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { troubleshootingItems } from '@/lib/data/troubleshooting-data';
import { ExclamationTriangleIcon, BugAntIcon, ArrowTopRightOnSquareIcon, QuestionMarkCircleIcon, ChatBubbleLeftRightIcon } from '@heroicons/react/24/outline'

import Link from '@/compat/next-link';

export default function TroubleshootingPage() {
  const categoryStats = troubleshootingItems.reduce((acc, item) => {
    acc[item.category] = (acc[item.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const severityStats = troubleshootingItems.reduce((acc, item) => {
    acc[item.severity] = (acc[item.severity] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <QuestionMarkCircleIcon className="h-6 w-6 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">Troubleshooting Guide</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Find solutions to common issues, error messages, and integration problems.
          Search by category, severity, or keywords to quickly find the help you need.
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <ExclamationTriangleIcon className="h-5 w-5 text-orange-500" />
              <h3 className="font-medium">Total Issues</h3>
            </div>
            <p className="text-2xl font-bold">{troubleshootingItems.length}</p>
            <p className="text-sm text-muted-foreground">
              Common problems and solutions
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-5 bg-red-100 rounded-full flex items-center justify-center">
                <div className="h-2 w-2 bg-red-500 rounded-full" />
              </div>
              <h3 className="font-medium">Critical Issues</h3>
            </div>
            <p className="text-2xl font-bold">{severityStats.critical || 0}</p>
            <p className="text-sm text-muted-foreground">
              High-priority problems
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <div className="h-5 w-5 bg-blue-100 rounded-full flex items-center justify-center">
                <div className="h-2 w-2 bg-blue-500 rounded-full" />
              </div>
              <h3 className="font-medium">Categories</h3>
            </div>
            <p className="text-2xl font-bold">{Object.keys(categoryStats).length}</p>
            <p className="text-sm text-muted-foreground">
              Different problem areas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <ChatBubbleLeftRightIcon className="h-5 w-5 text-green-500" />
              <h3 className="font-medium">Solutions</h3>
            </div>
            <p className="text-2xl font-bold">
              {troubleshootingItems.reduce((acc, item) => acc + item.solutions.length, 0)}
            </p>
            <p className="text-sm text-muted-foreground">
              Step-by-step solutions
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Category Overview */}
      <Card>
        <CardHeader>
          <CardTitle>Issue Categories</CardTitle>
          <CardDescription>
            Browse troubleshooting guides by category to find relevant solutions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Object.entries(categoryStats).map(([category, count]) => (
              <div key={category} className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <h4 className="font-medium capitalize">{category.replace('-', ' ')}</h4>
                  <p className="text-sm text-muted-foreground">{count} issues</p>
                </div>
                <Badge variant="secondary">{count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Common Issues Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Most Common Issues</CardTitle>
          <CardDescription>
            Quick access to the most frequently encountered problems
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2">
            <Link
              href="#auth-invalid-api-key"
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <div>
                <h4 className="font-medium">Invalid API Key Error</h4>
                <p className="text-sm text-muted-foreground">Authentication issues and 401 errors</p>
              </div>
              <Badge variant="destructive">High</Badge>
            </Link>

            <Link
              href="#email-delivery-failed"
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <div>
                <h4 className="font-medium">Email Delivery Failures</h4>
                <p className="text-sm text-muted-foreground">Emails not reaching recipients</p>
              </div>
              <Badge variant="outline">Medium</Badge>
            </Link>

            <Link
              href="#rate-limit-exceeded"
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <div>
                <h4 className="font-medium">Rate Limit Exceeded</h4>
                <p className="text-sm text-muted-foreground">429 errors and request throttling</p>
              </div>
              <Badge variant="outline">Medium</Badge>
            </Link>

            <Link
              href="#sdk-installation-issues"
              className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
            >
              <div>
                <h4 className="font-medium">SDK Installation Problems</h4>
                <p className="text-sm text-muted-foreground">Package installation and import issues</p>
              </div>
              <Badge variant="outline">Medium</Badge>
            </Link>
          </div>
        </CardContent>
      </Card>

      {/* Troubleshooting Content */}
      <Tabs defaultValue="guide" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="guide" className="flex items-center gap-2">
            <QuestionMarkCircleIcon className="h-4 w-4" />
            Troubleshooting Guide
          </TabsTrigger>
          <TabsTrigger value="errors" className="flex items-center gap-2">
            <BugAntIcon className="h-4 w-4" />
            Error Scenarios
          </TabsTrigger>
        </TabsList>

        <TabsContent value="guide" className="mt-6">
          <TroubleshootingGuide items={troubleshootingItems} />
        </TabsContent>

        <TabsContent value="errors" className="mt-6">
          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2">Common Error Scenarios</h3>
              <p className="text-muted-foreground">
                Detailed error scenarios with HTTP status codes, error messages, and step-by-step solutions.
                Each scenario includes code examples and prevention strategies.
              </p>
            </div>
            <ErrorScenarios />
          </div>
        </TabsContent>
      </Tabs>

      {/* Additional Resources */}
      <Card>
        <CardHeader>
          <CardTitle>Additional Resources</CardTitle>
          <CardDescription>
            More ways to get help and support
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <a
              href="/docs/api"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <ArrowTopRightOnSquareIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">API Documentation</h4>
                <p className="text-sm text-muted-foreground">Complete API reference</p>
              </div>
            </a>

            <a
              href="/docs/examples"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <ArrowTopRightOnSquareIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Code Examples</h4>
                <p className="text-sm text-muted-foreground">Interactive examples</p>
              </div>
            </a>

            <a
              href="mailto:support@notifi.com"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Contact Support</h4>
                <p className="text-sm text-muted-foreground">Get personalized help</p>
              </div>
            </a>

            <a
              href="https://status.notifi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <div className="h-2 w-2 bg-green-500 rounded-full" />
              </div>
              <div>
                <h4 className="font-medium">System Status</h4>
                <p className="text-sm text-muted-foreground">Check service health</p>
              </div>
            </a>

            <a
              href="/docs/best-practices"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <ArrowTopRightOnSquareIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Best Practices</h4>
                <p className="text-sm text-muted-foreground">Implementation tips</p>
              </div>
            </a>

            <a
              href="https://community.notifi.com"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-4 border rounded-lg hover:bg-accent transition-colors"
            >
              <div className="h-10 w-10 bg-primary/10 rounded-lg flex items-center justify-center">
                <ChatBubbleLeftRightIcon className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Community Forum</h4>
                <p className="text-sm text-muted-foreground">Ask the community</p>
              </div>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Feedback */}
      <FeedbackSystem
        page="troubleshooting"
        category="support"
      />
    </div>
  );
}