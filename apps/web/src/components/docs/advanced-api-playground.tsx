"use client";

import { Send, User } from "@/lib/icons";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "@/lib/utils/toast";
import {
  CheckIcon,
  ClockIcon,
  DocumentDuplicateIcon,
  ArrowDownTrayIcon,
  ArrowPathIcon,
  PlayIcon,
  BookmarkIcon,
  ShareIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";
import { useState } from "react";
import { CodeBlock } from "./code-block";

interface ApiRequest {
  id: string;
  name: string;
  method: string;
  url: string;
  headers: Record<string, string>;
  body?: string;
  timestamp: Date;
}

interface ApiResponse {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  data: any;
  duration: number;
  size: number;
}

interface AdvancedApiPlaygroundProps {
  initialRequest?: Partial<ApiRequest>;
  onExecute?: (request: ApiRequest) => Promise<ApiResponse>;
}

const commonHeaders = {
  "Content-Type": "application/json",
  Accept: "application/json",
  "User-Agent": "Notifi-Playground/1.0",
};

const httpMethods = ["GET", "POST", "PUT", "DELETE", "PATCH", "HEAD", "OPTIONS"];

export function AdvancedApiPlayground({ initialRequest, onExecute }: AdvancedApiPlaygroundProps) {
  const [request, setRequest] = useState<ApiRequest>({
    id: crypto.randomUUID(),
    name: "New Request",
    method: "GET",
    url: "https://api.notifi.com/v1/",
    headers: { ...commonHeaders },
    timestamp: new Date(),
    ...initialRequest,
  });

  const [response, setResponse] = useState<ApiResponse | null>(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [history, setHistory] = useState<ApiRequest[]>([]);
  const [savedRequests, setSavedRequests] = useState<ApiRequest[]>([]);
  const [copied, setCopied] = useState<string>("");

  const handleExecute = async () => {
    setIsExecuting(true);
    setResponse(null);

    try {
      const startTime = Date.now();

      if (onExecute) {
        const result = await onExecute(request);
        setResponse(result);
      } else {
        // Simulate API call
        await new Promise((resolve) => setTimeout(resolve, 500 + Math.random() * 1500));

        const mockResponse: ApiResponse = {
          status: 200,
          statusText: "OK",
          headers: {
            "content-type": "application/json",
            "x-ratelimit-remaining": "99",
            "x-ratelimit-reset": String(Math.floor(Date.now() / 1000) + 3600),
          },
          data: {
            success: true,
            message: "Mock response from playground",
            timestamp: new Date().toISOString(),
            request: {
              method: request.method,
              url: request.url,
            },
          },
          duration: Date.now() - startTime,
          size: 1024,
        };

        setResponse(mockResponse);
      }

      // Add to history
      const historyItem = { ...request, timestamp: new Date() };
      setHistory((prev) => [historyItem, ...prev.slice(0, 9)]); // Keep last 10
    } catch (error) {
      const errorResponse: ApiResponse = {
        status: 500,
        statusText: "Internal Server Error",
        headers: {},
        data: {
          error: error instanceof Error ? error.message : "Unknown error",
          timestamp: new Date().toISOString(),
        },
        duration: Date.now() - Date.now(),
        size: 0,
      };
      setResponse(errorResponse);
    } finally {
      setIsExecuting(false);
    }
  };

  const handleSaveRequest = () => {
    const savedRequest = {
      ...request,
      id: crypto.randomUUID(),
      name: request.name || `${request.method} ${new URL(request.url).pathname}`,
      timestamp: new Date(),
    };

    setSavedRequests((prev) => [savedRequest, ...prev]);
    toast.success("Request saved successfully");
  };

  const handleLoadRequest = (savedRequest: ApiRequest) => {
    setRequest({ ...savedRequest, id: crypto.randomUUID() });
    setResponse(null);
  };

  const handleCopy = async (text: string, type: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(type);
      toast.success(`${type} copied to clipboard`);
      setTimeout(() => setCopied(""), 2000);
    } catch (err) {
      toast.error("Failed to copy");
    }
  };

  const generateCurlCommand = () => {
    let curl = `curl -X ${request.method} "${request.url}"`;

    Object.entries(request.headers).forEach(([key, value]) => {
      if (value) {
        curl += ` \\\n  -H "${key}: ${value}"`;
      }
    });

    if (request.body && ["POST", "PUT", "PATCH"].includes(request.method)) {
      curl += ` \\\n  -d '${request.body}'`;
    }

    return curl;
  };

  const generateCodeSnippet = (language: string) => {
    switch (language) {
      case "javascript":
        return `fetch('${request.url}', {
  method: '${request.method}',
  headers: ${JSON.stringify(request.headers, null, 2)},${request.body ? `\n  body: ${JSON.stringify(request.body)}` : ""}
})
.then(response => response.json())
.then(data => console.log(data))
.catch(error => console.error('Error:', error));`;

      case "python":
        return `import requests
import json

url = "${request.url}"
headers = ${JSON.stringify(request.headers, null, 2).replace(/"/g, "'")}
${request.body ? `data = ${JSON.stringify(request.body, null, 2)}` : ""}

response = requests.${request.method.toLowerCase()}(url, headers=headers${request.body ? ", json=data" : ""})
print(response.json())`;

      case "curl":
        return generateCurlCommand();

      default:
        return generateCurlCommand();
    }
  };

  const exportResponse = () => {
    if (!response) return;

    const exportData = {
      request: {
        method: request.method,
        url: request.url,
        headers: request.headers,
        body: request.body,
      },
      response: {
        status: response.status,
        headers: response.headers,
        data: response.data,
      },
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `api-response-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Request Builder */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>API Request Builder</CardTitle>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={handleSaveRequest}>
                <BookmarkIcon className="h-4 w-4 mr-1" />
                Save
              </Button>
              <Button size="sm" variant="outline">
                <ShareIcon className="h-4 w-4 mr-1" />
                Share
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Request Name */}
          <div className="space-y-2">
            <Label>Request Name</Label>
            <Input
              value={request.name}
              onChange={(e) => setRequest((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Enter request name"
            />
          </div>

          {/* Method and URL */}
          <div className="flex gap-2">
            <div className="w-32">
              <Label>Method</Label>
              <Select
                value={request.method}
                onValueChange={(value) => setRequest((prev) => ({ ...prev, method: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {httpMethods.map((method) => (
                    <SelectItem key={method} value={method}>
                      <Badge variant={method === "GET" ? "secondary" : "default"}>{method}</Badge>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex-1">
              <Label>URL</Label>
              <Input
                value={request.url}
                onChange={(e) => setRequest((prev) => ({ ...prev, url: e.target.value }))}
                placeholder="https://api.notifi.com/v1/..."
              />
            </div>
          </div>

          {/* Headers */}
          <div className="space-y-2">
            <Label>Headers</Label>
            <div className="space-y-2">
              {Object.entries(request.headers).map(([key, value], index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    placeholder="Header name"
                    value={key}
                    onChange={(e) => {
                      const newHeaders = { ...request.headers };
                      delete newHeaders[key];
                      newHeaders[e.target.value] = value;
                      setRequest((prev) => ({ ...prev, headers: newHeaders }));
                    }}
                  />
                  <Input
                    placeholder="Header value"
                    value={value}
                    onChange={(e) => {
                      setRequest((prev) => ({
                        ...prev,
                        headers: { ...prev.headers, [key]: e.target.value },
                      }));
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      const newHeaders = { ...request.headers };
                      delete newHeaders[key];
                      setRequest((prev) => ({ ...prev, headers: newHeaders }));
                    }}
                  >
                    <TrashIcon className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setRequest((prev) => ({
                    ...prev,
                    headers: { ...prev.headers, "": "" },
                  }));
                }}
              >
                Add Header
              </Button>
            </div>
          </div>

          {/* Request Body */}
          {["POST", "PUT", "PATCH"].includes(request.method) && (
            <div className="space-y-2">
              <Label>Request Body</Label>
              <Textarea
                value={request.body || ""}
                onChange={(e) => setRequest((prev) => ({ ...prev, body: e.target.value }))}
                placeholder="Enter JSON request body"
                rows={6}
                className="font-mono text-sm"
              />
            </div>
          )}

          {/* Execute Button */}
          <Button onClick={handleExecute} disabled={isExecuting || !request.url} className="w-full">
            {isExecuting ? (
              <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <PlayIcon className="h-4 w-4 mr-2" />
            )}
            {isExecuting ? "Executing..." : "Send Request"}
          </Button>
        </CardContent>
      </Card>

      {/* Response */}
      {response && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                Response
                <Badge variant={response.status < 400 ? "default" : "destructive"}>
                  {response.status} {response.statusText}
                </Badge>
                <Badge variant="outline" className="text-xs">
                  <ClockIcon className="h-3 w-3 mr-1" />
                  {response.duration}ms
                </Badge>
              </CardTitle>
              <Button size="sm" variant="outline" onClick={exportResponse}>
                <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                Export
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="body" className="w-full">
              <TabsList>
                <TabsTrigger value="body">Response Body</TabsTrigger>
                <TabsTrigger value="headers">Headers</TabsTrigger>
                <TabsTrigger value="raw">Raw</TabsTrigger>
              </TabsList>

              <TabsContent value="body" className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Response Data</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(JSON.stringify(response.data, null, 2), "Response")}
                  >
                    {copied === "Response" ? (
                      <CheckIcon className="h-3 w-3" />
                    ) : (
                      <DocumentDuplicateIcon className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <CodeBlock language="json" showLineNumbers={false}>
                  {JSON.stringify(response.data, null, 2)}
                </CodeBlock>
              </TabsContent>

              <TabsContent value="headers" className="space-y-2">
                <div className="space-y-2">
                  {Object.entries(response.headers).map(([key, value]) => (
                    <div key={key} className="flex justify-between py-1 border-b">
                      <span className="font-medium text-sm">{key}</span>
                      <span className="text-sm text-muted-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </TabsContent>

              <TabsContent value="raw" className="space-y-2">
                <CodeBlock language="http" showLineNumbers={false}>
                  {`HTTP/1.1 ${response.status} ${response.statusText}\n${Object.entries(
                    response.headers,
                  )
                    .map(([key, value]) => `${key}: ${value}`)
                    .join("\n")}\n\n${JSON.stringify(response.data, null, 2)}`}
                </CodeBlock>
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      )}

      {/* Code Generation */}
      <Card>
        <CardHeader>
          <CardTitle>Code Generation</CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="curl" className="w-full">
            <TabsList>
              <TabsTrigger value="curl">cURL</TabsTrigger>
              <TabsTrigger value="javascript">JavaScript</TabsTrigger>
              <TabsTrigger value="python">Python</TabsTrigger>
            </TabsList>

            {["curl", "javascript", "python"].map((lang) => (
              <TabsContent key={lang} value={lang} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium capitalize">{lang} Code</span>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleCopy(generateCodeSnippet(lang), `${lang} code`)}
                  >
                    {copied === `${lang} code` ? (
                      <CheckIcon className="h-3 w-3" />
                    ) : (
                      <DocumentDuplicateIcon className="h-3 w-3" />
                    )}
                  </Button>
                </div>
                <CodeBlock language={lang === "curl" ? "bash" : lang} showLineNumbers={false}>
                  {generateCodeSnippet(lang)}
                </CodeBlock>
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* History and Saved Requests */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* History */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ClockIcon className="h-5 w-5" />
              Recent Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {history.length > 0 ? (
              <div className="space-y-2">
                {history.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-accent"
                    onClick={() => handleLoadRequest(item)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.method}
                        </Badge>
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {new URL(item.url).pathname}
                      </p>
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {item.timestamp.toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No recent requests</p>
            )}
          </CardContent>
        </Card>

        {/* Saved Requests */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <BookmarkIcon className="h-5 w-5" />
              Saved Requests
            </CardTitle>
          </CardHeader>
          <CardContent>
            {savedRequests.length > 0 ? (
              <div className="space-y-2">
                {savedRequests.map((item, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 border rounded cursor-pointer hover:bg-accent"
                    onClick={() => handleLoadRequest(item)}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline" className="text-xs">
                          {item.method}
                        </Badge>
                        <span className="text-sm font-medium">{item.name}</span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {new URL(item.url).pathname}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSavedRequests((prev) => prev.filter((_, i) => i !== index));
                      }}
                    >
                      <TrashIcon className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No saved requests</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
