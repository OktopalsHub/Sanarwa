import { Webhook } from '@/lib/icons';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowRightIcon, ArrowDownTrayIcon, ArrowTopRightOnSquareIcon, CodeBracketIcon } from '@heroicons/react/24/outline'

import Link from '@/compat/next-link';

const sdks = [
  {
    name: 'JavaScript/Node.js',
    description: 'Official SDK for JavaScript and Node.js applications',
    href: '/docs/sdks/javascript',
    packageName: '@notifi/sdk',
    popular: true,
    features: ['TypeScript support', 'Promise-based API', 'Webhook validation', 'Template helpers'],
  },
  {
    name: 'Python',
    description: 'Python SDK with Django and Flask integration examples',
    href: '/docs/sdks/python',
    packageName: 'notifi-python',
    popular: true,
    features: ['Async/await support', 'Django integration', 'Flask helpers', 'Type hints'],
  },
  {
    name: 'PHP',
    description: 'PHP SDK with Laravel and Symfony examples',
    href: '/docs/sdks/php',
    packageName: 'notifi/php-sdk',
    features: ['PSR-4 autoloading', 'Laravel service provider', 'Guzzle HTTP client', 'PHPUnit tests'],
  },
  {
    name: 'Java',
    description: 'Java SDK for Spring Boot and standalone applications',
    href: '/docs/sdks/java',
    packageName: 'com.notifi:notifi-java-sdk',
    features: ['Spring Boot starter', 'Reactive support', 'Jackson serialization', 'Maven/Gradle'],
  },
  {
    name: 'Go',
    description: 'Go SDK with context support and structured logging',
    href: '/docs/sdks/go',
    packageName: 'github.com/notifi/go-sdk',
    features: ['Context support', 'Structured logging', 'HTTP/2 client', 'Go modules'],
  },
  {
    name: '.NET',
    description: '.NET SDK for C# applications with async/await support',
    href: '/docs/sdks/dotnet',
    packageName: 'Notifi.SDK',
    features: ['Async/await', 'Dependency injection', 'Configuration binding', 'NuGet package'],
  },
];

export default function SDKsPage() {
  return (
    <div className="space-y-8">
      <div className="space-y-4">
        <h1 className="text-4xl font-bold tracking-tight">SDK Guides</h1>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Choose your preferred programming language to get started with Notifi.
          Our SDKs provide a simple, consistent interface for all communication channels.
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
                <code className="text-sm bg-muted px-2 py-1 rounded">
                  {sdk.packageName}
                </code>
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
        <h2 className="text-2xl font-semibold">Quick Comparison</h2>
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
              <tr className="bg-muted/25">
                <td className="border border-border p-3 font-medium">Python</td>
                <td className="border border-border p-3">pip, poetry</td>
                <td className="border border-border p-3">✅ asyncio</td>
                <td className="border border-border p-3">Django, Flask, FastAPI</td>
              </tr>
              <tr>
                <td className="border border-border p-3 font-medium">PHP</td>
                <td className="border border-border p-3">Composer</td>
                <td className="border border-border p-3">✅ ReactPHP</td>
                <td className="border border-border p-3">Laravel, Symfony</td>
              </tr>
              <tr className="bg-muted/25">
                <td className="border border-border p-3 font-medium">Java</td>
                <td className="border border-border p-3">Maven, Gradle</td>
                <td className="border border-border p-3">✅ CompletableFuture</td>
                <td className="border border-border p-3">Spring Boot, Quarkus</td>
              </tr>
              <tr>
                <td className="border border-border p-3 font-medium">Go</td>
                <td className="border border-border p-3">Go modules</td>
                <td className="border border-border p-3">✅ Goroutines</td>
                <td className="border border-border p-3">Gin, Echo, Fiber</td>
              </tr>
              <tr className="bg-muted/25">
                <td className="border border-border p-3 font-medium">.NET</td>
                <td className="border border-border p-3">NuGet</td>
                <td className="border border-border p-3">✅ Task/async-await</td>
                <td className="border border-border p-3">ASP.NET Core, Blazor</td>
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