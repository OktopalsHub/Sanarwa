'use client';

import { Send } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/utils/toast';
import { ExclamationCircleIcon, CheckIcon, DocumentDuplicateIcon, ArrowPathIcon, PlayIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import { CodeBlock } from './code-block';

interface ApiEndpoint {
  id: string;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  path: string;
  description: string;
  parameters?: {
    name: string;
    type: string;
    in: 'query' | 'path' | 'header' | 'body';
    required: boolean;
    description: string;
    example?: any;
  }[];
  requestBody?: {
    contentType: string;
    schema: any;
    example: any;
  };
  responses: {
    status: number;
    description: string;
    example: any;
  }[];
}

interface ApiPlaygroundProps {
  endpoint: ApiEndpoint;
  baseUrl?: string;
  onExecute?: (request: any) => Promise<any>;
}

export function ApiPlayground({ endpoint, baseUrl = 'https://api.notifi.com', onExecute }: ApiPlaygroundProps) {
  const [isExecuting, setIsExecuting] = useState(false);
  const [response, setResponse] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [requestBody, setRequestBody] = useState<string>('');
  const [headers, setHeaders] = useState<Record<string, string>>({
    'Content-Type': 'application/json',
    'Authorization': 'Bearer YOUR_API_KEY'
  });
  const [copied, setCopied] = useState(false);

  const handleCopy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      toast.success('Copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy');
    }
  };

  const handleExecute = async () => {
    setIsExecuting(true);
    setError('');
    setResponse(null);

    try {
      // Build the request
      let url = `${baseUrl}${endpoint.path}`;

      // Replace path parameters
      Object.entries(parameters).forEach(([key, value]) => {
        if (endpoint.parameters?.find(p => p.name === key && p.in === 'path')) {
          url = url.replace(`{${key}}`, encodeURIComponent(value));
        }
      });

      // Add query parameters
      const queryParams = new URLSearchParams();
      Object.entries(parameters).forEach(([key, value]) => {
        if (endpoint.parameters?.find(p => p.name === key && p.in === 'query') && value) {
          queryParams.append(key, value);
        }
      });
      if (queryParams.toString()) {
        url += `?${queryParams.toString()}`;
      }

      const request = {
        method: endpoint.method,
        url,
        headers,
        body: requestBody ? JSON.parse(requestBody) : undefined
      };

      let result;
      if (onExecute) {
        result = await onExecute(request);
      } else {
        // Simulate API call for demo purposes
        await new Promise(resolve => setTimeout(resolve, 1000));
        result = {
          status: 200,
          data: endpoint.responses.find(r => r.status === 200)?.example || { message: 'Success' }
        };
      }

      setResponse(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsExecuting(false);
    }
  };

  const handleParameterChange = (name: string, value: any) => {
    setParameters(prev => ({ ...prev, [name]: value }));
  };

  const handleHeaderChange = (key: string, value: string) => {
    setHeaders(prev => ({ ...prev, [key]: value }));
  };

  const generateCurlCommand = () => {
    let url = `${baseUrl}${endpoint.path}`;

    // Replace path parameters
    Object.entries(parameters).forEach(([key, value]) => {
      if (endpoint.parameters?.find(p => p.name === key && p.in === 'path')) {
        url = url.replace(`{${key}}`, encodeURIComponent(value));
      }
    });

    // Add query parameters
    const queryParams = new URLSearchParams();
    Object.entries(parameters).forEach(([key, value]) => {
      if (endpoint.parameters?.find(p => p.name === key && p.in === 'query') && value) {
        queryParams.append(key, value);
      }
    });
    if (queryParams.toString()) {
      url += `?${queryParams.toString()}`;
    }

    let curl = `curl -X ${endpoint.method} "${url}"`;

    // Add headers
    Object.entries(headers).forEach(([key, value]) => {
      curl += ` \\\n  -H "${key}: ${value}"`;
    });

    // Add body
    if (requestBody && ['POST', 'PUT', 'PATCH'].includes(endpoint.method)) {
      curl += ` \\\n  -d '${requestBody}'`;
    }

    return curl;
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg flex items-center gap-2">
              <Badge variant={endpoint.method === 'GET' ? 'secondary' : 'default'}>
                {endpoint.method}
              </Badge>
              {endpoint.path}
            </CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{endpoint.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="parameters" className="w-full">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="body">Body</TabsTrigger>
            <TabsTrigger value="headers">Headers</TabsTrigger>
            <TabsTrigger value="response">Response</TabsTrigger>
            <TabsTrigger value="code">Code</TabsTrigger>
          </TabsList>

          <TabsContent value="parameters" className="space-y-4">
            {endpoint.parameters && endpoint.parameters.length > 0 ? (
              <div className="space-y-4">
                {endpoint.parameters.map((param) => (
                  <div key={param.name} className="space-y-2">
                    <Label htmlFor={param.name} className="flex items-center gap-2">
                      {param.name}
                      <Badge variant="outline" className="text-xs">{param.in}</Badge>
                      {param.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    </Label>
                    <div className="space-y-1">
                      <Input
                        id={param.name}
                        placeholder={param.example ? String(param.example) : `Enter ${param.name}`}
                        value={parameters[param.name] || ''}
                        onChange={(e) => handleParameterChange(param.name, e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">{param.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No parameters required for this endpoint.</p>
            )}
          </TabsContent>

          <TabsContent value="body" className="space-y-4">
            {endpoint.requestBody ? (
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Label>Request Body</Label>
                  <Badge variant="outline">{endpoint.requestBody.contentType}</Badge>
                </div>
                <Textarea
                  placeholder="Enter request body (JSON)"
                  value={requestBody || JSON.stringify(endpoint.requestBody.example, null, 2)}
                  onChange={(e) => setRequestBody(e.target.value)}
                  rows={8}
                  className="font-mono text-sm"
                />
              </div>
            ) : (
              <p className="text-muted-foreground">No request body required for this endpoint.</p>
            )}
          </TabsContent>

          <TabsContent value="headers" className="space-y-4">
            <div className="space-y-4">
              {Object.entries(headers).map(([key, value]) => (
                <div key={key} className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Header name"
                    value={key}
                    onChange={(e) => {
                      const newHeaders = { ...headers };
                      delete newHeaders[key];
                      newHeaders[e.target.value] = value;
                      setHeaders(newHeaders);
                    }}
                  />
                  <Input
                    placeholder="Header value"
                    value={value}
                    onChange={(e) => handleHeaderChange(key, e.target.value)}
                  />
                </div>
              ))}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setHeaders(prev => ({ ...prev, '': '' }))}
              >
                Add Header
              </Button>
            </div>
          </TabsContent>

          <TabsContent value="response" className="space-y-4">
            <div className="flex gap-2 mb-4">
              <Button
                onClick={handleExecute}
                disabled={isExecuting}
                className="flex items-center gap-2"
              >
                {isExecuting ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayIcon className="h-4 w-4" />
                )}
                {isExecuting ? 'Executing...' : 'Send Request'}
              </Button>
            </div>

            {error ? (
              <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <ExclamationCircleIcon className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Error</p>
                  <pre className="text-sm text-destructive/80 mt-1 whitespace-pre-wrap">{error}</pre>
                </div>
              </div>
            ) : response ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Response:</p>
                  <Badge variant={response.status < 400 ? 'default' : 'destructive'}>
                    {response.status}
                  </Badge>
                </div>
                <CodeBlock
                  language="json"
                  showLineNumbers={false}
                >
                  {JSON.stringify(response.data || response, null, 2)}
                </CodeBlock>
              </div>
            ) : (
              <div className="space-y-4">
                <p className="text-muted-foreground">Click "Send Request" to see the response.</p>
                <div className="space-y-2">
                  <p className="text-sm font-medium">Expected Responses:</p>
                  {endpoint.responses.map((resp) => (
                    <div key={resp.status} className="border rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant={resp.status < 400 ? 'default' : 'destructive'}>
                          {resp.status}
                        </Badge>
                        <span className="text-sm">{resp.description}</span>
                      </div>
                      <CodeBlock
                        language="json"
                        showLineNumbers={false}
                      >
                        {JSON.stringify(resp.example, null, 2)}
                      </CodeBlock>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="code" className="space-y-4">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <p className="text-sm font-medium">cURL Command:</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleCopy(generateCurlCommand())}
                  className="h-8 w-8 p-0"
                >
                  {copied ? (
                    <CheckIcon className="h-3 w-3" />
                  ) : (
                    <DocumentDuplicateIcon className="h-3 w-3" />
                  )}
                </Button>
              </div>
              <CodeBlock
                language="bash"
                showLineNumbers={false}
              >
                {generateCurlCommand()}
              </CodeBlock>
            </div>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}