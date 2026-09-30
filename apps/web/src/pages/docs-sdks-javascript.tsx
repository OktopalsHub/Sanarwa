import { Send } from "@/lib/icons";
import { CodeBlock } from "@/components/docs/code-block";
import { FeedbackSystem } from "@/components/docs/feedback-system";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";

import Link from "@/compat/next-link";

export default function JavaScriptSDKPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CodeBracketIcon className="h-6 w-6 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">JavaScript/Node.js SDK</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Complete integration guide for JavaScript and Node.js applications. Send notifications
          across all channels with our powerful SDK.
        </p>
        <div className="flex gap-2">
          <Badge variant="secondary">JavaScript</Badge>
          <Badge variant="secondary">Node.js</Badge>
          <Badge variant="secondary">TypeScript</Badge>
        </div>
      </div>

      {/* Installation */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ArrowDownTrayIcon className="h-5 w-5" />
            Installation
          </CardTitle>
          <CardDescription>
            Install the Notifi JavaScript SDK using your preferred package manager
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock language="bash" title="npm">
            {`npm install @notifi/sdk`}
          </CodeBlock>
          <CodeBlock language="bash" title="yarn">
            {`yarn add @notifi/sdk`}
          </CodeBlock>
          <CodeBlock language="bash" title="pnpm">
            {`pnpm add @notifi/sdk`}
          </CodeBlock>
        </CardContent>
      </Card>

      {/* Quick Start */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Start</CardTitle>
          <CardDescription>
            Get started with the Notifi SDK in just a few lines of code
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CodeBlock language="javascript" title="Basic Setup">
            {`import { NotifiClient } from '@notifi/sdk';

const client = new NotifiClient({
  apiKey: process.env.NOTIFI_API_KEY,
  baseUrl: 'https://api.notifi.com'
});

// Send your first email
async function sendWelcomeEmail() {
  try {
    const result = await client.email.send({
      to: 'user@example.com',
      subject: 'Welcome to our platform!',
      template: 'welcome-template',
      variables: {
        name: 'John Doe',
        company: 'Acme Corp'
      }
    });
    
    console.log('Email sent:', result.id);
  } catch (error) {
    console.error('Failed to send email:', error);
  }
}`}
          </CodeBlock>
        </CardContent>
      </Card>

      {/* More Examples */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Interactive Examples</CardTitle>
            <CardDescription>Try live, runnable code examples</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/docs/examples"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              View Interactive Examples
            </Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">API Playground</CardTitle>
            <CardDescription>Test APIs directly from your browser</CardDescription>
          </CardHeader>
          <CardContent>
            <Link
              href="/docs/playground"
              className="flex items-center gap-2 text-primary hover:underline"
            >
              <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              Open API Playground
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Feedback */}
      <FeedbackSystem page="javascript-sdk" category="sdk-documentation" />
    </div>
  );
}
