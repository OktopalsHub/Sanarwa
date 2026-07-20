'use client';

import { Send } from '@/lib/icons';

import { CodeRunner } from '@/components/docs/code-runner';
import { FeedbackSystem } from '@/components/docs/feedback-system';
import { InteractiveCodeExample } from '@/components/docs/interactive-code-example';
import { SdkTester } from '@/components/docs/sdk-tester';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { sdkExamples } from '@/lib/data/sdk-examples';
import { PlayIcon, BoltIcon, BookOpenIcon, CodeBracketIcon, BeakerIcon } from '@heroicons/react/24/outline'


export default function ExamplesPage() {
  const handleRunExample = async (code: string, parameters: Record<string, any>) => {
    // Simulate API execution
    await new Promise(resolve => setTimeout(resolve, 1500));

    // Return mock response based on the code content
    if (code.includes('email.send')) {
      return {
        id: 'msg_' + Math.random().toString(36).substr(2, 9),
        status: 'sent',
        to: parameters.to || 'user@example.com',
        subject: parameters.subject || 'Test Email',
        sentAt: new Date().toISOString()
      };
    } else if (code.includes('sms.send')) {
      return {
        id: 'sms_' + Math.random().toString(36).substr(2, 9),
        status: 'sent',
        to: parameters.to || '+1234567890',
        message: parameters.message || 'Test SMS',
        sentAt: new Date().toISOString()
      };
    } else if (code.includes('workflows.create')) {
      return {
        id: 'wf_' + Math.random().toString(36).substr(2, 9),
        name: parameters.name || 'Test Workflow',
        status: 'active',
        createdAt: new Date().toISOString()
      };
    }

    return { success: true, message: 'Code executed successfully' };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <PlayIcon className="h-6 w-6 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">Interactive Examples</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Try out Notifi's APIs and SDKs with live, runnable code examples.
          Modify parameters and see real-time results.
        </p>
      </div>

      {/* Quick Start Examples */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CodeBracketIcon className="h-5 w-5" />
            Quick Start Examples
          </CardTitle>
          <CardDescription>
            Get started quickly with these common use cases. Each example is fully interactive and runnable.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="javascript" className="w-full">
            <TabsList className="grid w-full grid-cols-6">
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
              <TabsTrigger value="php">PHP</TabsTrigger>
              <TabsTrigger value="java">Java</TabsTrigger>
              <TabsTrigger value="go">Go</TabsTrigger>
              <TabsTrigger value="dotnet">.NET</TabsTrigger>
            </TabsList>

            <TabsContent value="javascript" className="space-y-6 mt-6">
              {sdkExamples.javascript.map((example) => (
                <InteractiveCodeExample
                  key={example.id}
                  example={example}
                  onRun={handleRunExample}
                />
              ))}
            </TabsContent>

            <TabsContent value="python" className="space-y-6 mt-6">
              {sdkExamples.python.map((example) => (
                <InteractiveCodeExample
                  key={example.id}
                  example={example}
                  onRun={handleRunExample}
                />
              ))}
            </TabsContent>

            <TabsContent value="php" className="space-y-6 mt-6">
              {sdkExamples.php.map((example) => (
                <InteractiveCodeExample
                  key={example.id}
                  example={example}
                  onRun={handleRunExample}
                />
              ))}
            </TabsContent>

            <TabsContent value="java" className="space-y-6 mt-6">
              {sdkExamples.java.map((example) => (
                <InteractiveCodeExample
                  key={example.id}
                  example={example}
                  onRun={handleRunExample}
                />
              ))}
            </TabsContent>

            <TabsContent value="go" className="space-y-6 mt-6">
              {sdkExamples.go.map((example) => (
                <InteractiveCodeExample
                  key={example.id}
                  example={example}
                  onRun={handleRunExample}
                />
              ))}
            </TabsContent>

            <TabsContent value="dotnet" className="space-y-6 mt-6">
              {sdkExamples.dotnet.map((example) => (
                <InteractiveCodeExample
                  key={example.id}
                  example={example}
                  onRun={handleRunExample}
                />
              ))}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Live Code Runner */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BoltIcon className="h-5 w-5" />
            Live Code Runner
          </CardTitle>
          <CardDescription>
            Write and execute code directly in your browser with our interactive code runner.
            Test your integration logic in a safe sandbox environment.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CodeRunner
            language="javascript"
            title="Try Notifi SDK"
            description="Write and run JavaScript code using the Notifi SDK"
            initialCode={`// Import the Notifi SDK
import { NotifiClient } from '@notifi/sdk';

// Initialize the client
const client = new NotifiClient({
  apiKey: 'your-api-key', // Use sandbox key for testing
  baseUrl: 'https://api-sandbox.notifi.com'
});

// Send a test email
async function sendTestEmail() {
  try {
    const result = await client.email.send({
      to: 'test@example.com',
      subject: 'Hello from Notifi!',
      template: 'welcome-template',
      variables: {
        name: 'Developer',
        company: 'Your Company'
      }
    });
    
    console.log('Email sent successfully:', result);
    return result;
  } catch (error) {
    console.error('Failed to send email:', error);
    throw error;
  }
}

// Execute the function
sendTestEmail();`}
          />
        </CardContent>
      </Card>

      {/* SDK Test Suite */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BeakerIcon className="h-5 w-5" />
            SDK Test Suite
          </CardTitle>
          <CardDescription>
            Comprehensive testing environment for all SDK features. Test different scenarios,
            validate your integration, and debug issues with our interactive test suite.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <SdkTester />
        </CardContent>
      </Card>

      {/* Advanced Examples */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">Advanced Use Cases</h2>
          <p className="text-muted-foreground">
            More complex examples showing advanced features and integrations.
          </p>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Multi-Channel Campaigns</CardTitle>
              <CardDescription>
                Create campaigns that span multiple communication channels
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary">Email</Badge>
                <Badge variant="secondary">SMS</Badge>
                <Badge variant="secondary">Push</Badge>
                <Badge variant="secondary">In-App</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Learn how to orchestrate notifications across email, SMS, push notifications,
                and in-app messages for maximum reach and engagement.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Workflow Automation</CardTitle>
              <CardDescription>
                Build automated notification workflows with triggers and conditions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary">Triggers</Badge>
                <Badge variant="secondary">Conditions</Badge>
                <Badge variant="secondary">Delays</Badge>
                <Badge variant="secondary">A/B Testing</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Create sophisticated workflows that respond to user actions,
                time-based triggers, and custom business logic.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Template Personalization</CardTitle>
              <CardDescription>
                Dynamic content and personalization with variables
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary">Variables</Badge>
                <Badge variant="secondary">Conditional Content</Badge>
                <Badge variant="secondary">Localization</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Use template variables, conditional content blocks, and localization
                to create personalized experiences for your users.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Analytics & Tracking</CardTitle>
              <CardDescription>
                Monitor delivery, engagement, and conversion metrics
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2 mb-4">
                <Badge variant="secondary">Delivery Tracking</Badge>
                <Badge variant="secondary">Engagement</Badge>
                <Badge variant="secondary">Conversions</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Track message delivery, user engagement, and conversion rates
                to optimize your communication strategy.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Learning Resources */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpenIcon className="h-5 w-5" />
            Learning Resources
          </CardTitle>
          <CardDescription>
            Additional resources to help you master Notifi's platform
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <a href="/docs/tutorials" className="block p-4 border rounded-lg hover:bg-accent transition-colors">
              <h4 className="font-medium mb-2">Step-by-Step Tutorials</h4>
              <p className="text-sm text-muted-foreground">
                Guided tutorials for common integration scenarios
              </p>
            </a>
            <a href="/docs/api" className="block p-4 border rounded-lg hover:bg-accent transition-colors">
              <h4 className="font-medium mb-2">API Reference</h4>
              <p className="text-sm text-muted-foreground">
                Complete API documentation with interactive playground
              </p>
            </a>
            <a href="/docs/best-practices" className="block p-4 border rounded-lg hover:bg-accent transition-colors">
              <h4 className="font-medium mb-2">Best Practices</h4>
              <p className="text-sm text-muted-foreground">
                Tips and recommendations for optimal implementation
              </p>
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Feedback */}
      <FeedbackSystem
        page="examples"
        category="documentation"
      />
    </div>
  );
}