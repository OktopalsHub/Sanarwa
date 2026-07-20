'use client';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/utils/toast';
import { ExclamationCircleIcon, CheckIcon, DocumentDuplicateIcon, ArrowPathIcon, PlayIcon, Cog6ToothIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import { CodeBlock } from './code-block';

interface CodeRunnerProps {
  language: string;
  initialCode: string;
  title?: string;
  description?: string;
  onRun?: (code: string, config: RunConfig) => Promise<RunResult>;
}

interface RunConfig {
  environment: 'sandbox' | 'live';
  timeout: number;
  apiKey?: string;
  baseUrl?: string;
}

interface RunResult {
  success: boolean;
  output?: string;
  error?: string;
  executionTime?: number;
  logs?: string[];
}

const defaultConfigs: Record<string, RunConfig> = {
  javascript: {
    environment: 'sandbox',
    timeout: 10000,
    baseUrl: 'https://api-sandbox.notifi.com'
  },
  python: {
    environment: 'sandbox',
    timeout: 15000,
    baseUrl: 'https://api-sandbox.notifi.com'
  },
  php: {
    environment: 'sandbox',
    timeout: 15000,
    baseUrl: 'https://api-sandbox.notifi.com'
  }
};

export function CodeRunner({ language, initialCode, title, description, onRun }: CodeRunnerProps) {
  const [code, setCode] = useState(initialCode);
  const [config, setConfig] = useState<RunConfig>(() => {
    return defaultConfigs[language] ?? defaultConfigs.javascript ?? {
      environment: 'sandbox',
      timeout: 10000,
      baseUrl: 'https://api-sandbox.notifi.com'
    };
  });
  const [result, setResult] = useState<RunResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [copied, setCopied] = useState(false);

  const handleRun = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const startTime = Date.now();

      if (onRun) {
        const runResult = await onRun(code, config);
        setResult({
          ...runResult,
          executionTime: Date.now() - startTime
        });
      } else {
        // Simulate code execution for demo
        await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

        setResult({
          success: true,
          output: JSON.stringify({
            message: 'Code executed successfully in sandbox environment',
            timestamp: new Date().toISOString(),
            language,
            environment: config.environment
          }, null, 2),
          executionTime: Date.now() - startTime,
          logs: [
            'Initializing runtime environment...',
            'Loading dependencies...',
            'Executing code...',
            'Code execution completed successfully'
          ]
        });
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
        executionTime: Date.now() - Date.now()
      });
    } finally {
      setIsRunning(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  const handleReset = () => {
    setCode(initialCode);
    setResult(null);
  };

  const updateConfig = (key: keyof RunConfig, value: any) => {
    setConfig(prev => ({ ...prev, [key]: value }));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            {title && <CardTitle className="text-lg">{title}</CardTitle>}
            {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline">{language}</Badge>
            <Badge variant={config.environment === 'live' ? 'destructive' : 'secondary'}>
              {config.environment}
            </Badge>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="code" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="config">Config</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
            <TabsTrigger value="logs">Logs</TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Code Editor</Label>
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleReset}
                    className="h-8 px-3"
                  >
                    <ArrowPathIcon className="h-3 w-3 mr-1" />
                    Reset
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleCopy}
                    className="h-8 w-8 p-0"
                  >
                    {copied ? (
                      <CheckIcon className="h-3 w-3" />
                    ) : (
                      <DocumentDuplicateIcon className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </div>
              <Textarea
                value={code}
                onChange={(e) => setCode(e.target.value)}
                className="font-mono text-sm min-h-[300px]"
                placeholder="Enter your code here..."
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleRun}
                disabled={isRunning || !code.trim()}
                className="flex items-center gap-2"
              >
                {isRunning ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin" />
                ) : (
                  <PlayIcon className="h-4 w-4" />
                )}
                {isRunning ? 'Running...' : 'Run Code'}
              </Button>

              {config.environment === 'live' && (
                <div className="flex items-center gap-2 text-sm text-orange-600">
                  <ExclamationCircleIcon className="h-4 w-4" />
                  <span>Running in live environment</span>
                </div>
              )}
            </div>
          </TabsContent>

          <TabsContent value="config" className="space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>Environment</Label>
                <Select
                  value={config.environment}
                  onValueChange={(value: 'sandbox' | 'live') => updateConfig('environment', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="sandbox">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-green-500 rounded-full" />
                        Sandbox (Safe)
                      </div>
                    </SelectItem>
                    <SelectItem value="live">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-2 bg-red-500 rounded-full" />
                        Live (Real API)
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  {config.environment === 'sandbox'
                    ? 'Safe environment for testing without real API calls'
                    : 'Uses real API - charges may apply'
                  }
                </p>
              </div>

              <div className="space-y-2">
                <Label>Timeout (ms)</Label>
                <Input
                  type="number"
                  value={config.timeout}
                  onChange={(e) => updateConfig('timeout', parseInt(e.target.value))}
                  min={1000}
                  max={30000}
                />
              </div>

              <div className="space-y-2">
                <Label>API Key</Label>
                <Input
                  type="password"
                  value={config.apiKey || ''}
                  onChange={(e) => updateConfig('apiKey', e.target.value)}
                  placeholder="Enter your API key (optional for sandbox)"
                />
                <p className="text-xs text-muted-foreground">
                  Required for live environment, optional for sandbox
                </p>
              </div>

              <div className="space-y-2">
                <Label>Base URL</Label>
                <Input
                  value={config.baseUrl || ''}
                  onChange={(e) => updateConfig('baseUrl', e.target.value)}
                  placeholder="https://api.notifi.com"
                />
              </div>
            </div>

            <div className="p-4 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Cog6ToothIcon className="h-4 w-4" />
                <span className="font-medium">Runtime Configuration</span>
              </div>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• Code runs in isolated {config.environment} environment</p>
                <p>• Maximum execution time: {config.timeout / 1000}s</p>
                <p>• Network access: {config.environment === 'live' ? 'Full' : 'Restricted'}</p>
                <p>• File system: Read-only</p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="output" className="space-y-4">
            {result ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={`h-2 w-2 rounded-full ${result.success ? 'bg-green-500' : 'bg-red-500'}`} />
                    <span className="font-medium">
                      {result.success ? 'Success' : 'Error'}
                    </span>
                    {result.executionTime && (
                      <Badge variant="outline" className="text-xs">
                        {result.executionTime}ms
                      </Badge>
                    )}
                  </div>
                </div>

                {result.error ? (
                  <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                    <div className="flex items-start gap-2">
                      <ExclamationCircleIcon className="h-4 w-4 text-destructive mt-0.5" />
                      <div>
                        <p className="font-medium text-destructive">Execution Error</p>
                        <pre className="text-sm text-destructive/80 mt-1 whitespace-pre-wrap">
                          {result.error}
                        </pre>
                      </div>
                    </div>
                  </div>
                ) : result.output ? (
                  <div className="space-y-2">
                    <p className="text-sm font-medium">Output:</p>
                    <CodeBlock
                      language="json"
                      showLineNumbers={false}
                    >
                      {result.output}
                    </CodeBlock>
                  </div>
                ) : null}
              </div>
            ) : (
              <p className="text-muted-foreground">
                Run your code to see the output here.
              </p>
            )}
          </TabsContent>

          <TabsContent value="logs" className="space-y-4">
            {result?.logs ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Execution Logs:</p>
                <div className="bg-muted/50 rounded-lg p-4 font-mono text-sm">
                  {result.logs.map((log, index) => (
                    <div key={index} className="flex items-start gap-2">
                      <span className="text-muted-foreground text-xs">
                        {String(index + 1).padStart(2, '0')}
                      </span>
                      <span>{log}</span>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <p className="text-muted-foreground">
                Execution logs will appear here when you run your code.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}