import { Webhook } from "@/lib/icons";
import { Badge } from "@sanarwa/ui/badge";
import { Button } from "@sanarwa/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@sanarwa/ui/card";
import {
  ArrowRightIcon,
  ArrowDownTrayIcon,
  ArrowTopRightOnSquareIcon,
  CodeBracketIcon,
} from "@heroicons/react/24/outline";

import Link from "@/compat/next-link";

const sdks = [
  {
    name: "JavaScript / TypeScript",
    description: "Official SDK for JavaScript, TypeScript and Node.js applications",
    href: "/docs/sdks/javascript",
    packageName: "@sanarwa/sdk",
    popular: true,
    features: [
      "TypeScript types included",
      "Promise-based API",
      "Webhook signature validation",
      "Template helpers",
    ],
  },
];

export default function SDKsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">SDK Guides</h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Install the Sanarwa SDK to send over every channel from Node.js. Any language can call the
          REST API directly at /api/v1.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {sdks.map((sdk) => (
          <Card key={sdk.name} className="group hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <CodeBracketIcon className="h-5 w-5 text-primary" />
                  <CardTitle className="text-lg">{sdk.name}</CardTitle>
                </div>
                {sdk.popular && <Badge variant="secondary">Popular</Badge>}
              </div>
              <CardDescription>{sdk.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="text-sm font-medium">Package:</div>
                <code className="text-sm bg-muted px-2 py-1 rounded">{sdk.packageName}</code>
              </div>

              <div className="space-y-2">
                <div className="text-sm font-medium">Features:</div>
                <div className="flex flex-wrap gap-1">
                  {sdk.features.map((feature) => (
                    <Badge key={feature} variant="outline" className="text-xs">
                      {feature}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="flex space-x-2 pt-2">
                <Link href={sdk.href} className="flex-1">
                  <Button className="w-full">
                    Get Started
                    <ArrowRightIcon className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Button variant="outline" size="icon">
                  <ArrowDownTrayIcon className="h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="space-y-6">
        <h2 className="text-2xl font-semibold">Other Languages</h2>
        <p className="text-muted-foreground">
          Python, PHP, Java, Go and .NET SDKs are not available yet. Until then, call the REST API
          directly at <code className="font-mono">/api/v1</code> from any language — the endpoint
          and payload are identical regardless of client.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse border border-border">
            <thead>
              <tr className="bg-muted/50">
                <th className="border border-border p-3 text-left">Language</th>
                <th className="border border-border p-3 text-left">Package Manager</th>
                <th className="border border-border p-3 text-left">Async Support</th>
                <th className="border border-border p-3 text-left">Framework Integration</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td className="border border-border p-3 font-medium">JavaScript/Node.js</td>
                <td className="border border-border p-3">npm, yarn, pnpm</td>
                <td className="border border-border p-3">✅ Promises/async-await</td>
                <td className="border border-border p-3">Express, Next.js, Nuxt</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-2xl font-semibold">Need Help?</h2>
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h3 className="font-semibold">Examples</h3>
                <p className="text-sm text-muted-foreground">
                  Browse code examples and integration patterns
                </p>
                <Link href="/docs/examples">
                  <Button variant="outline" size="sm">
                    View Examples
                    <ArrowTopRightOnSquareIcon className="ml-2 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h3 className="font-semibold">API Reference</h3>
                <p className="text-sm text-muted-foreground">
                  Complete API documentation with interactive examples
                </p>
                <Link href="/docs/api">
                  <Button variant="outline" size="sm">
                    API Docs
                    <ArrowTopRightOnSquareIcon className="ml-2 h-3 w-3" />
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="space-y-2">
                <h3 className="font-semibold">Community</h3>
                <p className="text-sm text-muted-foreground">
                  Get help from our community and support team
                </p>
                <Button variant="outline" size="sm">
                  Join Discord
                  <ArrowTopRightOnSquareIcon className="ml-2 h-3 w-3" />
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
