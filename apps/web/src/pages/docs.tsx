import { Send } from "@/lib/icons";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  ArrowRightIcon,
  BoltIcon,
  BookOpenIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";

import Link from "@/compat/next-link";

export default function DocsPage() {
  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">Notifi Documentation</h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Everything you need to integrate multi-channel communication into your application. Send
          emails, SMS, push notifications, in-app messages, and voice calls with our powerful APIs
          and SDKs.
        </p>
      </div>

      {/* Quick Start Cards */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="group hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <BookOpenIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Quick Start</CardTitle>
            </div>
            <CardDescription>Get up and running with Notifi in under 5 minutes</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/docs/quick-start">
              <Button variant="ghost" className="w-full justify-between group-hover:bg-accent">
                Start Building
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <CodeBracketIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">SDK Guides</CardTitle>
            </div>
            <CardDescription>Language-specific integration guides and examples</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/docs/sdks/javascript">
              <Button variant="ghost" className="w-full justify-between group-hover:bg-accent">
                View SDKs
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>

        <Card className="group hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center space-x-2">
              <BoltIcon className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">API Reference</CardTitle>
            </div>
            <CardDescription>Complete API documentation with interactive examples</CardDescription>
          </CardHeader>
          <CardContent>
            <Link href="/docs/api">
              <Button variant="ghost" className="w-full justify-between group-hover:bg-accent">
                Explore API
                <ArrowRightIcon className="h-4 w-4" />
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* Popular Guides */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Popular Guides</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Link href="/docs/examples" className="group">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    Interactive Examples
                  </CardTitle>
                  <Badge variant="secondary">New</Badge>
                </div>
                <CardDescription>
                  Try live, runnable code examples for all SDKs and APIs
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/docs/playground" className="group">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    API Playground
                  </CardTitle>
                  <Badge variant="secondary">New</Badge>
                </div>
                <CardDescription>
                  Test APIs directly from your browser with live responses
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/docs/troubleshooting" className="group">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    Troubleshooting Guide
                  </CardTitle>
                  <Badge variant="secondary">New</Badge>
                </div>
                <CardDescription>
                  Find solutions to common issues and error messages
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>

          <Link href="/docs/sdks/javascript" className="group">
            <Card className="h-full hover:shadow-md transition-shadow">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg group-hover:text-primary transition-colors">
                    JavaScript/Node.js SDK
                  </CardTitle>
                  <Badge variant="secondary">Popular</Badge>
                </div>
                <CardDescription>
                  Complete integration guide for JavaScript and Node.js applications
                </CardDescription>
              </CardHeader>
            </Card>
          </Link>
        </div>
      </div>

      {/* SDK Languages */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Supported Languages</h2>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { name: "JavaScript/Node.js", href: "/docs/sdks/javascript", popular: true },
            { name: "Python", href: "/docs/sdks/python", popular: true },
            { name: "PHP", href: "/docs/sdks/php" },
            { name: "Java", href: "/docs/sdks/java" },
            { name: "Go", href: "/docs/sdks/go" },
            { name: ".NET", href: "/docs/sdks/dotnet" },
          ].map((sdk) => (
            <Link key={sdk.name} href={sdk.href} className="group">
              <div className="flex items-center justify-between p-3 rounded-lg border hover:bg-accent transition-colors">
                <span className="font-medium group-hover:text-primary transition-colors">
                  {sdk.name}
                </span>
                {sdk.popular && (
                  <Badge variant="outline" className="text-xs">
                    Popular
                  </Badge>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Communication Channels */}
      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Communication Channels</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
          {[
            { name: "Email", href: "/docs/channels/email", icon: "📧" },
            { name: "SMS", href: "/docs/channels/sms", icon: "💬" },
            { name: "Push", href: "/docs/channels/push", icon: "🔔" },
            { name: "In-App", href: "/docs/channels/in-app", icon: "📱" },
            { name: "Voice", href: "/docs/channels/voice", icon: "📞" },
          ].map((channel) => (
            <Link key={channel.name} href={channel.href} className="group">
              <Card className="text-center hover:shadow-md transition-shadow">
                <CardContent className="pt-6">
                  <div className="text-2xl mb-2">{channel.icon}</div>
                  <div className="font-medium group-hover:text-primary transition-colors">
                    {channel.name}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
