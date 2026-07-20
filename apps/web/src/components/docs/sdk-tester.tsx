'use client';

import { Phone, Send } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { toast } from '@/lib/utils/toast';
import { ExclamationCircleIcon, CheckCircleIcon, ClockIcon, DocumentDuplicateIcon, ArrowDownTrayIcon, ArrowPathIcon, PlayIcon, Cog6ToothIcon, BoltIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';
import { CodeBlock } from './code-block';

interface SdkTest {
  id: string;
  name: string;
  description: string;
  category: 'email' | 'sms' | 'push' | 'workflow' | 'template' | 'analytics';
  difficulty: 'beginner' | 'intermediate' | 'advanced';
  parameters: {
    name: string;
    type: string;
    required: boolean;
    description: string;
    defaultValue?: any;
    options?: string[];
  }[];
  expectedResult: string;
  codeTemplate: string;
}

interface TestResult {
  success: boolean;
  data?: any;
  error?: string;
  duration: number;
  logs: string[];
}

interface SdkTesterProps {
  tests?: SdkTest[];
  onRunTest?: (test: SdkTest, parameters: Record<string, any>) => Promise<TestResult>;
}

const defaultTests: SdkTest[] = [
  {
    id: 'email-send-basic',
    name: 'Send Basic Email',
    description: 'Send a simple email notification using the SDK',
    category: 'email',
    difficulty: 'beginner',
    parameters: [
      {
        name: 'to',
        type: 'email',
        required: true,
        description: 'Recipient email address',
        defaultValue: 'test@example.com'
      },
      {
        name: 'subject',
        type: 'string',
        required: true,
        description: 'Email subject line',
        defaultValue: 'Test Email from SDK'
      },
      {
        name: 'content',
        type: 'text',
        required: true,
        description: 'Email content',
        defaultValue: 'Hello! This is a test email sent using the Notifi SDK.'
      }
    ],
    expectedResult: 'Email sent successfully with message ID',
    codeTemplate: `const result = await client.email.send({
  to: "{{to}}",
  subject: "{{subject}}",
  content: "{{content}}"
});`
  },
  {
    id: 'email-template',
    name: 'Send Templated Email',
    description: 'Send an email using a predefined template with variables',
    category: 'email',
    difficulty: 'intermediate',
    parameters: [
      {
        name: 'to',
        type: 'email',
        required: true,
        description: 'Recipient email address',
        defaultValue: 'user@example.com'
      },
      {
        name: 'template',
        type: 'select',
        required: true,
        description: 'Template to use',
        defaultValue: 'welcome-template',
        options: ['welcome-template', 'newsletter-template', 'notification-template']
      },
      {
        name: 'variables',
        type: 'json',
        required: false,
        description: 'Template variables (JSON)',
        defaultValue: '{"name": "John Doe", "company": "Acme Corp"}'
      }
    ],
    expectedResult: 'Templated email sent with rendered content',
    codeTemplate: `const result = await client.email.send({
  to: "{{to}}",
  template: "{{template}}",
  variables: {{variables}}
});`
  },
  {
    id: 'sms-send',
    name: 'Send SMS Message',
    description: 'Send an SMS notification to a phone number',
    category: 'sms',
    difficulty: 'beginner',
    parameters: [
      {
        name: 'to',
        type: 'tel',
        required: true,
        description: 'Phone number (E.164 format)',
        defaultValue: '+1234567890'
      },
      {
        name: 'message',
        type: 'text',
        required: true,
        description: 'SMS message content',
        defaultValue: 'Hello! This is a test SMS from Notifi.'
      }
    ],
    expectedResult: 'SMS sent successfully',
    codeTemplate: `const result = await client.sms.send({
  to: "{{to}}",
  message: "{{message}}"
});`
  },
  {
    id: 'workflow-create',
    name: 'Create Workflow',
    description: 'Create a multi-step notification workflow',
    category: 'workflow',
    difficulty: 'advanced',
    parameters: [
      {
        name: 'name',
        type: 'string',
        required: true,
        description: 'Workflow name',
        defaultValue: 'Test Workflow'
      },
      {
        name: 'trigger',
        type: 'select',
        required: true,
        description: 'Trigger type',
        defaultValue: 'manual',
        options: ['manual', 'event', 'schedule']
      },
      {
        name: 'steps',
        type: 'json',
        required: true,
        description: 'Workflow steps (JSON)',
        defaultValue: '[{"type": "email", "delay": 0, "template": "welcome-email"}]'
      }
    ],
    expectedResult: 'Workflow created and activated',
    codeTemplate: `const result = await client.workflows.create({
  name: "{{name}}",
  trigger: { type: "{{trigger}}" },
  steps: {{steps}}
});`
  }
];

export function SdkTester({ tests = defaultTests, onRunTest }: SdkTesterProps) {
  const [selectedTest, setSelectedTest] = useState<SdkTest>(() => {
    return tests[0] ?? defaultTests[0] ?? {
      id: 'default',
      name: 'Default Test',
      description: 'Default test case',
      category: 'email',
      difficulty: 'beginner',
      parameters: [],
      expectedResult: 'Default result',
      codeTemplate: 'console.log("Hello World");'
    };
  });
  const [parameters, setParameters] = useState<Record<string, any>>({});
  const [result, setResult] = useState<TestResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [environment, setEnvironment] = useState<'sandbox' | 'live'>('sandbox');
  const [apiKey, setApiKey] = useState('');

  const handleParameterChange = (name: string, value: any) => {
    setParameters(prev => ({ ...prev, [name]: value }));
  };

  const handleRunTest = async () => {
    setIsRunning(true);
    setResult(null);

    try {
      const startTime = Date.now();

      if (onRunTest) {
        const testResult = await onRunTest(selectedTest, parameters);
        setResult(testResult);
      } else {
        // Simulate test execution
        const logs = [
          'Initializing SDK client...',
          `Environment: ${environment}`,
          'Validating parameters...',
          'Executing test...'
        ];

        // Simulate processing time
        await new Promise(resolve => setTimeout(resolve, 1500 + Math.random() * 1000));

        const mockResult: TestResult = {
          success: true,
          data: {
            id: `test_${Date.now()}`,
            status: 'completed',
            message: selectedTest.expectedResult,
            parameters,
            timestamp: new Date().toISOString()
          },
          duration: Date.now() - startTime,
          logs: [...logs, 'Test completed successfully']
        };

        setResult(mockResult);
      }
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : 'Test execution failed',
        duration: Date.now() - Date.now(),
        logs: ['Test execution failed']
      });
    } finally {
      setIsRunning(false);
    }
  };

  const generateCode = () => {
    let code = selectedTest.codeTemplate;

    // Replace template variables
    Object.entries(parameters).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      let replacement = value;

      if (typeof value === 'object') {
        replacement = JSON.stringify(value);
      } else if (typeof value === 'string' && !code.includes(`"${placeholder}"`)) {
        replacement = `"${value}"`;
      }

      code = code.replace(new RegExp(placeholder, 'g'), replacement);
    });

    return code;
  };

  const handleCopyCode = async () => {
    try {
      await navigator.clipboard.writeText(generateCode());
      toast.success('Code copied to clipboard');
    } catch (err) {
      toast.error('Failed to copy code');
    }
  };

  const exportResult = () => {
    if (!result) return;

    const exportData = {
      test: {
        id: selectedTest.id,
        name: selectedTest.name,
        category: selectedTest.category
      },
      parameters,
      result,
      code: generateCode(),
      timestamp: new Date().toISOString()
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sdk-test-${selectedTest.id}-${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Initialize parameters when test changes
  useState(() => {
    const initialParams: Record<string, any> = {};
    selectedTest.parameters.forEach(param => {
      if (param.defaultValue !== undefined) {
        initialParams[param.name] = param.defaultValue;
      }
    });
    setParameters(initialParams);
  });

  const difficultyColors = {
    beginner: 'bg-green-100 text-green-800',
    intermediate: 'bg-yellow-100 text-yellow-800',
    advanced: 'bg-red-100 text-red-800'
  };

  const categoryIcons = {
    email: '📧',
    sms: '💬',
    push: '🔔',
    workflow: '🔄',
    template: '📄',
    analytics: '📊'
  };

  return (
    <div className="space-y-6">
      {/* Test Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BoltIcon className="h-5 w-5" />
            SDK Test Suite
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Environment Configuration */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label>Environment</Label>
              <Select value={environment} onValueChange={(value: 'sandbox' | 'live') => setEnvironment(value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="sandbox">
                    <div className="flex items-center gap-2">
                      <div className="h-2 w-2 bg-green-500 rounded-full" />
                      Sandbox (Safe Testing)
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
            </div>

            <div className="space-y-2">
              <Label>API Key</Label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder={environment === 'sandbox' ? 'Optional for sandbox' : 'Required for live'}
              />
            </div>
          </div>

          {/* Test Selection */}
          <div className="space-y-2">
            <Label>Select Test</Label>
            <div className="grid gap-2 md:grid-cols-2 lg:grid-cols-3">
              {tests.map((test) => (
                <div
                  key={test.id}
                  className={`p-3 border rounded-lg cursor-pointer transition-colors ${selectedTest.id === test.id ? 'border-primary bg-primary/5' : 'hover:bg-accent'
                    }`}
                  onClick={() => setSelectedTest(test)}
                >
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{categoryIcons[test.category]}</span>
                    <span className="font-medium text-sm">{test.name}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mb-2">{test.description}</p>
                  <div className="flex gap-1">
                    <Badge variant="outline" className="text-xs capitalize">
                      {test.category}
                    </Badge>
                    <Badge
                      variant="outline"
                      className={`text-xs ${difficultyColors[test.difficulty]}`}
                    >
                      {test.difficulty}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Test Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Cog6ToothIcon className="h-5 w-5" />
            Test Configuration: {selectedTest.name}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="parameters" className="w-full">
            <TabsList>
              <TabsTrigger value="parameters">Parameters</TabsTrigger>
              <TabsTrigger value="code">Generated Code</TabsTrigger>
              <TabsTrigger value="result">Result</TabsTrigger>
            </TabsList>

            <TabsContent value="parameters" className="space-y-4">
              <div className="space-y-4">
                {selectedTest.parameters.map((param) => (
                  <div key={param.name} className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {param.name}
                      {param.required && <Badge variant="destructive" className="text-xs">Required</Badge>}
                    </Label>
                    <div className="space-y-1">
                      {param.type === 'select' && param.options ? (
                        <Select
                          value={parameters[param.name] || param.defaultValue}
                          onValueChange={(value) => handleParameterChange(param.name, value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {param.options.map(option => (
                              <SelectItem key={option} value={option}>
                                {option}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : param.type === 'text' || param.type === 'json' ? (
                        <Textarea
                          value={parameters[param.name] || param.defaultValue || ''}
                          onChange={(e) => handleParameterChange(param.name, e.target.value)}
                          placeholder={param.description}
                          rows={param.type === 'json' ? 4 : 2}
                        />
                      ) : (
                        <Input
                          type={param.type}
                          value={parameters[param.name] || param.defaultValue || ''}
                          onChange={(e) => handleParameterChange(param.name, e.target.value)}
                          placeholder={param.description}
                        />
                      )}
                      <p className="text-xs text-muted-foreground">{param.description}</p>
                    </div>
                  </div>
                ))}
              </div>

              <Button
                onClick={handleRunTest}
                disabled={isRunning}
                className="w-full"
              >
                {isRunning ? (
                  <ArrowPathIcon className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <PlayIcon className="h-4 w-4 mr-2" />
                )}
                {isRunning ? 'Running Test...' : 'Run Test'}
              </Button>
            </TabsContent>

            <TabsContent value="code" className="space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="font-medium">Generated Code</h4>
                <Button size="sm" variant="outline" onClick={handleCopyCode}>
                  <DocumentDuplicateIcon className="h-4 w-4 mr-1" />
                  Copy
                </Button>
              </div>
              <CodeBlock language="javascript" showLineNumbers={false}>
                {generateCode()}
              </CodeBlock>
            </TabsContent>

            <TabsContent value="result" className="space-y-4">
              {result ? (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      {result.success ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500" />
                      ) : (
                        <ExclamationCircleIcon className="h-5 w-5 text-red-500" />
                      )}
                      <span className="font-medium">
                        {result.success ? 'Test Passed' : 'Test Failed'}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        <ClockIcon className="h-3 w-3 mr-1" />
                        {result.duration}ms
                      </Badge>
                    </div>
                    <Button size="sm" variant="outline" onClick={exportResult}>
                      <ArrowDownTrayIcon className="h-4 w-4 mr-1" />
                      Export
                    </Button>
                  </div>

                  {result.error ? (
                    <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
                      <p className="font-medium text-destructive">Error</p>
                      <pre className="text-sm text-destructive/80 mt-1 whitespace-pre-wrap">
                        {result.error}
                      </pre>
                    </div>
                  ) : result.data ? (
                    <div className="space-y-2">
                      <p className="font-medium">Result Data:</p>
                      <CodeBlock language="json" showLineNumbers={false}>
                        {JSON.stringify(result.data, null, 2)}
                      </CodeBlock>
                    </div>
                  ) : null}

                  {result.logs && result.logs.length > 0 && (
                    <div className="space-y-2">
                      <p className="font-medium">Execution Logs:</p>
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
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">
                  Run a test to see the results here.
                </p>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}