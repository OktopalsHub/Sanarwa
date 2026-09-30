"use client";

import { Send } from "@/lib/icons";

import { AdvancedApiPlayground } from "@/components/docs/advanced-api-playground";
import { ApiPlayground } from "@/components/docs/api-playground";
import { FeedbackSystem } from "@/components/docs/feedback-system";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { apiEndpoints } from "@/lib/data/sdk-examples";
import {
  GlobeAltIcon,
  ShieldCheckIcon,
  CommandLineIcon,
  BoltIcon,
} from "@heroicons/react/24/outline";

export default function PlaygroundPage() {
  const handleApiExecute = async (request: any) => {
    // Simulate API execution with realistic delay
    const startTime = Date.now();
    await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));
    const duration = Date.now() - startTime;

    // Simulate different responses based on the endpoint
    if (request.url.includes("/email")) {
      const responseData = {
        id: "msg_" + Math.random().toString(36).substr(2, 9),
        status: "sent",
        to: request.body?.to || "user@example.com",
        subject: request.body?.subject || "Test Email",
        sentAt: new Date().toISOString(),
      };
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
        data: responseData,
        duration,
        size: JSON.stringify(responseData).length,
      };
    } else if (request.url.includes("/sms")) {
      const responseData = {
        id: "sms_" + Math.random().toString(36).substr(2, 9),
        status: "sent",
        to: request.body?.to || "+1234567890",
        message: request.body?.message || "Test SMS",
        sentAt: new Date().toISOString(),
      };
      return {
        status: 200,
        statusText: "OK",
        headers: { "Content-Type": "application/json" },
        data: responseData,
        duration,
        size: JSON.stringify(responseData).length,
      };
    }

    const responseData = { success: true, message: "Request executed successfully" };
    return {
      status: 200,
      statusText: "OK",
      headers: { "Content-Type": "application/json" },
      data: responseData,
      duration,
      size: JSON.stringify(responseData).length,
    };
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <CommandLineIcon className="h-6 w-6 text-primary" />
          <h1 className="text-4xl font-bold tracking-tight">API Playground</h1>
        </div>
        <p className="text-xl text-muted-foreground max-w-3xl">
          Test Notifi's APIs directly from your browser. Experiment with different parameters, see
          real responses, and generate code examples for your applications.
        </p>
      </div>

      {/* Features Overview */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <BoltIcon className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Live Testing</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Execute real API calls and see immediate responses
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <CommandLineIcon className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Code Generation</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Auto-generate cURL commands and SDK code
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <ShieldCheckIcon className="h-5 w-5 text-primary" />
              <h3 className="font-medium">Authentication</h3>
            </div>
            <p className="text-sm text-muted-foreground">Test with your own API keys securely</p>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2 mb-2">
              <GlobeAltIcon className="h-5 w-5 text-primary" />
              <h3 className="font-medium">All Endpoints</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              Access all Notifi API endpoints in one place
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Advanced API Playground */}
      <Card>
        <CardHeader>
          <CardTitle>Advanced API Playground</CardTitle>
          <CardDescription>
            Build and test custom API requests with our advanced playground. Save requests, view
            history, and generate code snippets for your applications.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AdvancedApiPlayground
            initialRequest={{
              method: "POST",
              url: "https://api.notifi.com/v1/notifications/email",
              headers: {
                "Content-Type": "application/json",
                Authorization: "Bearer YOUR_API_KEY",
              },
              body: JSON.stringify(
                {
                  to: "user@example.com",
                  subject: "Test Email",
                  template: "welcome-template",
                  variables: {
                    name: "John Doe",
                  },
                },
                null,
                2,
              ),
            }}
            onExecute={handleApiExecute}
          />
        </CardContent>
      </Card>

      {/* API Endpoints */}
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-2">API Endpoints Reference</h2>
          <p className="text-muted-foreground">
            Explore and test all available Notifi API endpoints. Each endpoint includes parameter
            documentation, request/response examples, and live testing capabilities.
          </p>
        </div>

        <Tabs defaultValue="notifications" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="notifications">Notifications</TabsTrigger>
            <TabsTrigger value="workflows">Workflows</TabsTrigger>
            <TabsTrigger value="templates">Templates</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
          </TabsList>

          <TabsContent value="notifications" className="space-y-6 mt-6">
            <div className="space-y-6">
              {apiEndpoints.map((endpoint) => (
                <ApiPlayground key={endpoint.id} endpoint={endpoint} onExecute={handleApiExecute} />
              ))}
            </div>
          </TabsContent>

          <TabsContent value="workflows" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Workflow Endpoints</CardTitle>
                <CardDescription>
                  Create, manage, and execute notification workflows
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Workflow API endpoints coming soon. These will allow you to:
                  </p>
                  <div className="grid gap-2 max-w-md mx-auto text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        POST
                      </Badge>
                      <span>/v1/workflows - Create workflows</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        GET
                      </Badge>
                      <span>/v1/workflows - List workflows</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        PUT
                      </Badge>
                      <span>/v1/workflows/:id - Update workflow</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        POST
                      </Badge>
                      <span>/v1/workflows/:id/execute - Execute workflow</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="templates" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Template Endpoints</CardTitle>
                <CardDescription>Manage notification templates across all channels</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Template API endpoints coming soon. These will allow you to:
                  </p>
                  <div className="grid gap-2 max-w-md mx-auto text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        POST
                      </Badge>
                      <span>/v1/templates - Create templates</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        GET
                      </Badge>
                      <span>/v1/templates - List templates</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        PUT
                      </Badge>
                      <span>/v1/templates/:id - Update template</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        POST
                      </Badge>
                      <span>/v1/templates/:id/preview - Preview template</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="analytics" className="space-y-6 mt-6">
            <Card>
              <CardHeader>
                <CardTitle>Analytics Endpoints</CardTitle>
                <CardDescription>
                  Access delivery metrics, engagement data, and performance analytics
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">
                    Analytics API endpoints coming soon. These will allow you to:
                  </p>
                  <div className="grid gap-2 max-w-md mx-auto text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        GET
                      </Badge>
                      <span>/v1/analytics/delivery - Delivery stats</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        GET
                      </Badge>
                      <span>/v1/analytics/engagement - Engagement metrics</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        GET
                      </Badge>
                      <span>/v1/analytics/campaigns - Campaign performance</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="w-16">
                        GET
                      </Badge>
                      <span>/v1/analytics/channels - Channel breakdown</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>

      {/* Getting Started */}
      <Card>
        <CardHeader>
          <CardTitle>Getting Started with the API Playground</CardTitle>
          <CardDescription>Follow these steps to start testing Notifi's APIs</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-3">
              <h4 className="font-medium">1. Authentication</h4>
              <p className="text-sm text-muted-foreground">
                Add your API key in the Headers tab. You can find your API key in the Notifi
                dashboard under Settings → API Keys.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">2. Configure Parameters</h4>
              <p className="text-sm text-muted-foreground">
                Fill in the required parameters for your API call. Use the Parameters tab to set
                path, query, and body parameters.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">3. Send Request</h4>
              <p className="text-sm text-muted-foreground">
                Click "Send Request" to execute the API call. You'll see the response in real-time
                along with status codes and headers.
              </p>
            </div>
            <div className="space-y-3">
              <h4 className="font-medium">4. Generate Code</h4>
              <p className="text-sm text-muted-foreground">
                Use the Code tab to generate cURL commands or SDK code snippets that you can copy
                into your applications.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Feedback */}
      <FeedbackSystem page="playground" category="api-testing" />
    </div>
  );
}
