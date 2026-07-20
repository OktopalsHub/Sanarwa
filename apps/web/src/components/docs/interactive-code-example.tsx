'use client';

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

interface CodeExample {
  id: string;
  title: string;
  description: string;
  language: string;
  code: string;
  parameters?: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    defaultValue?: string;
  }[];
  expectedOutput?: string;
}

interface InteractiveCodeExampleProps {
  example: CodeExample;
  onRun?: (code: string, parameters: Record<string, any>) => Promise<any>;
}

export function InteractiveCodeExample({ example, onRun }: InteractiveCodeExampleProps) {
  const [isRunning, setIsRunning] = useState(false);
  const [output, setOutput] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(example.code);
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  const handleRun = async () => {
    if (!onRun) return;

    setIsRunning(true);
    setError('');
    setOutput('');

    try {
      const result = await onRun(example.code, parameters);
      setOutput(JSON.stringify(result, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setIsRunning(false);
    }
  };

  const handleParameterChange = (name: string, value: any) => {
    setParameters(prev => ({ ...prev, [name]: value }));
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-lg">{example.title}</CardTitle>
            <p className="text-sm text-muted-foreground mt-1">{example.description}</p>
          </div>
          <Badge variant="outline">{example.language}</Badge>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="code" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="code">Code</TabsTrigger>
            <TabsTrigger value="parameters">Parameters</TabsTrigger>
            <TabsTrigger value="output">Output</TabsTrigger>
          </TabsList>

          <TabsContent value="code" className="space-y-4">
            <div className="relative">
              <CodeBlock
                language={example.language}
                showLineNumbers
              >
                {example.code}
              </CodeBlock>
              <div className="absolute top-2 right-2 flex gap-2">
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
                {onRun && (
                  <Button
                    size="sm"
                    onClick={handleRun}
                    disabled={isRunning}
                    className="h-8 px-3"
                  >
                    {isRunning ? (
                      <ArrowPathIcon className="h-3 w-3 animate-spin" />
                    ) : (
                      <PlayIcon className="h-3 w-3" />
                    )}
                    {isRunning ? 'Running...' : 'Run'}
                  </Button>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="parameters" className="space-y-4">
            {example.parameters && example.parameters.length > 0 ? (
              <div className="space-y-4">
                {example.parameters.map((param) => (
                  <div key={param.name} className="space-y-2">
                    <Label htmlFor={param.name} className="flex items-center gap-2">
                      {param.name}
                      {param.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    </Label>
                    <div className="space-y-1">
                      {param.type === 'string' ? (
                        <Input
                          id={param.name}
                          placeholder={param.defaultValue || `Enter ${param.name}`}
                          value={parameters[param.name] || ''}
                          onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        />
                      ) : param.type === 'text' ? (
                        <Textarea
                          id={param.name}
                          placeholder={param.defaultValue || `Enter ${param.name}`}
                          value={parameters[param.name] || ''}
                          onChange={(e) => handleParameterChange(param.name, e.target.value)}
                          rows={3}
                        />
                      ) : (
                        <Input
                          id={param.name}
                          type={param.type}
                          placeholder={param.defaultValue || `Enter ${param.name}`}
                          value={parameters[param.name] || ''}
                          onChange={(e) => handleParameterChange(param.name, e.target.value)}
                        />
                      )}
                      <p className="text-xs text-muted-foreground">{param.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No parameters required for this example.</p>
            )}
          </TabsContent>

          <TabsContent value="output" className="space-y-4">
            {error ? (
              <div className="flex items-start gap-2 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                <ExclamationCircleIcon className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="font-medium text-destructive">Error</p>
                  <pre className="text-sm text-destructive/80 mt-1 whitespace-pre-wrap">{error}</pre>
                </div>
              </div>
            ) : output ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Response:</p>
                <CodeBlock
                  language="json"
                  showLineNumbers={false}
                >
                  {output}
                </CodeBlock>
              </div>
            ) : example.expectedOutput ? (
              <div className="space-y-2">
                <p className="text-sm font-medium">Expected Output:</p>
                <CodeBlock
                  language="json"
                  showLineNumbers={false}
                >
                  {example.expectedOutput}
                </CodeBlock>
              </div>
            ) : (
              <p className="text-muted-foreground">
                {onRun ? 'Click "Run" to see the output.' : 'Output will be shown here when available.'}
              </p>
            )}
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}