'use client';

import { User } from '@/lib/icons';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import { Workflow } from '@/lib/types/workflow';
import { ExclamationTriangleIcon, CheckCircleIcon, ClockIcon, ArrowDownTrayIcon, PlayIcon, ArrowPathIcon, XMarkIcon, BeakerIcon } from '@heroicons/react/24/outline'
import { useState } from 'react';

interface WorkflowTestRunnerProps {
  workflow: Workflow;
  isOpen: boolean;
  onClose: () => void;
}

interface TestData {
  [key: string]: any;
}

interface TestResult {
  id: string;
  status: 'running' | 'completed' | 'failed';
  startTime: Date;
  endTime?: Date;
  testData: TestData;
  results: {
    nodeId: string;
    nodeName: string;
    status: 'success' | 'failed' | 'skipped';
    output?: any;
    error?: string;
    executionTime: number;
  }[];
  totalExecutionTime?: number;
  successRate: number;
}

const DEFAULT_TEST_DATA = {
  user: {
    id: 'user_123',
    email: 'test@example.com',
    name: 'Test User',
    signupDate: new Date().toISOString(),
  },
  event: {
    type: 'user.signup',
    timestamp: new Date().toISOString(),
    properties: {
      source: 'web',
      campaign: 'summer_2024',
    },
  },
  order: {
    id: 'order_456',
    total: 99.99,
    currency: 'USD',
    items: [
      { id: 'item_1', name: 'Product A', price: 49.99 },
      { id: 'item_2', name: 'Product B', price: 49.99 },
    ],
  },
};

export function WorkflowTestRunner({
  workflow,
  isOpen,
  onClose,
}: WorkflowTestRunnerProps) {
  const [activeTab, setActiveTab] = useState('setup');
  const [testData, setTestData] = useState<TestData>(DEFAULT_TEST_DATA);
  const [testDataJson, setTestDataJson] = useState(JSON.stringify(DEFAULT_TEST_DATA, null, 2));
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const handleTestDataChange = (value: string) => {
    setTestDataJson(value);
    try {
      const parsed = JSON.parse(value);
      setTestData(parsed);
    } catch (error) {
      // Invalid JSON, keep the string but don't update testData
    }
  };

  const runTest = async () => {
    setIsRunning(true);

    const testResult: TestResult = {
      id: `test_${Date.now()}`,
      status: 'running',
      startTime: new Date(),
      testData,
      results: [],
      successRate: 0,
    };

    setTestResults(prev => [testResult, ...prev]);

    try {
      // Simulate test execution
      const results = await simulateWorkflowExecution(workflow, testData);

      const completedResult: TestResult = {
        ...testResult,
        status: 'completed',
        endTime: new Date(),
        results,
        totalExecutionTime: results.reduce((sum, r) => sum + r.executionTime, 0),
        successRate: (results.filter(r => r.status === 'success').length / results.length) * 100,
      };

      setTestResults(prev => prev.map(r => r.id === testResult.id ? completedResult : r));
    } catch (error) {
      const failedResult: TestResult = {
        ...testResult,
        status: 'failed',
        endTime: new Date(),
        results: [],
        successRate: 0,
      };

      setTestResults(prev => prev.map(r => r.id === testResult.id ? failedResult : r));
    }

    setIsRunning(false);
    setActiveTab('results');
  };

  const simulateWorkflowExecution = async (workflow: Workflow, testData: TestData) => {
    const results: TestResult['results'] = [];

    // Get execution order (simplified - start with triggers)
    const triggerNodes = workflow.nodes.filter(node => node.type === 'trigger');
    const executionQueue = [...triggerNodes];
    const executed = new Set<string>();

    while (executionQueue.length > 0) {
      const currentNode = executionQueue.shift()!;
      if (executed.has(currentNode.id)) continue;

      const startTime = Date.now();

      // Simulate processing delay
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));

      const executionTime = Date.now() - startTime;

      // Simulate success/failure (85% success rate)
      const success = Math.random() > 0.15;

      const result = {
        nodeId: currentNode.id,
        nodeName: currentNode.data.label,
        status: success ? 'success' as const : 'failed' as const,
        output: success ? generateTestOutput(currentNode, testData) : undefined,
        error: success ? undefined : `Simulated error in ${currentNode.data.label}`,
        executionTime,
      };

      results.push(result);
      executed.add(currentNode.id);

      // Add connected nodes to queue if current node succeeded
      if (success) {
        const connections = workflow.connections.filter(c => c.sourceNodeId === currentNode.id);
        connections.forEach(conn => {
          const targetNode = workflow.nodes.find(n => n.id === conn.targetNodeId);
          if (targetNode && !executed.has(targetNode.id)) {
            executionQueue.push(targetNode);
          }
        });
      }
    }

    return results;
  };

  const generateTestOutput = (node: any, testData: TestData) => {
    switch (node.type) {
      case 'trigger':
        return {
          triggered: true,
          eventData: testData.event,
          timestamp: new Date().toISOString(),
        };
      case 'action':
        const config = node.data.config;
        if (config.type === 'email') {
          return {
            messageId: `msg_${Math.random().toString(36).substr(2, 9)}`,
            recipient: testData.user.email,
            subject: config.subject || 'Test Email',
            sent: true,
          };
        } else if (config.type === 'sms') {
          return {
            messageId: `sms_${Math.random().toString(36).substr(2, 9)}`,
            recipient: '+1234567890',
            message: config.message || 'Test SMS',
            sent: true,
          };
        }
        return { executed: true };
      case 'condition':
        const conditionResult = Math.random() > 0.5;
        return {
          field: (node.data.config as any).field,
          operator: (node.data.config as any).operator,
          value: (node.data.config as any).value,
          result: conditionResult,
          actualValue: testData.user.email,
        };
      case 'delay':
        return {
          delayed: true,
          duration: (node.data.config as any).duration,
          unit: (node.data.config as any).unit,
        };
      default:
        return { processed: true };
    }
  };

  const exportResults = (result: TestResult) => {
    const data = {
      workflow: {
        id: workflow.id,
        name: workflow.name,
        version: workflow.version,
      },
      test: {
        id: result.id,
        startTime: result.startTime,
        endTime: result.endTime,
        status: result.status,
        successRate: result.successRate,
        totalExecutionTime: result.totalExecutionTime,
      },
      testData: result.testData,
      results: result.results,
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `workflow-test-${result.id}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <BeakerIcon className="h-5 w-5" />
                Workflow Test Runner
              </DialogTitle>
              <DialogDescription>
                Test your workflow with sample data
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="setup">Test Setup</TabsTrigger>
            <TabsTrigger value="results">Test Results</TabsTrigger>
            <TabsTrigger value="history">Test History</TabsTrigger>
          </TabsList>

          <div className="mt-4 h-[500px]">
            <TabsContent value="setup" className="h-full">
              <div className="space-y-4 h-full">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Test Data</CardTitle>
                    <p className="text-xs text-muted-foreground">
                      Configure the test data that will be used during workflow execution
                    </p>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <Label htmlFor="testData">Test Data (JSON)</Label>
                      <Textarea
                        id="testData"
                        value={testDataJson}
                        onChange={(e) => handleTestDataChange(e.target.value)}
                        className="font-mono text-sm h-64"
                        placeholder="Enter test data as JSON"
                      />
                    </div>
                  </CardContent>
                </Card>

                <div className="flex justify-end gap-2">
                  <Button
                    onClick={() => {
                      setTestDataJson(JSON.stringify(DEFAULT_TEST_DATA, null, 2));
                      setTestData(DEFAULT_TEST_DATA);
                    }}
                    variant="outline"
                    className="flex items-center gap-2"
                  >
                    <ArrowPathIcon className="h-4 w-4" />
                    Reset to Default
                  </Button>
                  <Button
                    onClick={runTest}
                    disabled={isRunning}
                    className="flex items-center gap-2"
                  >
                    {isRunning ? (
                      <ClockIcon className="h-4 w-4 animate-spin" />
                    ) : (
                      <PlayIcon className="h-4 w-4" />
                    )}
                    {isRunning ? 'Running Test...' : 'Run Test'}
                  </Button>
                </div>
              </div>
            </TabsContent>

            <TabsContent value="results" className="h-full">
              <ScrollArea className="h-full">
                {testResults.length === 0 ? (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center">
                      <BeakerIcon className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                      <p className="text-muted-foreground">No test results yet</p>
                      <p className="text-sm text-muted-foreground">Run a test to see results here</p>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {testResults.slice(0, 1).map(result => (
                      <div key={result.id} className="space-y-4">
                        <Card>
                          <CardHeader>
                            <div className="flex items-center justify-between">
                              <CardTitle className="flex items-center gap-2">
                                {result.status === 'completed' && (
                                  <CheckCircleIcon className="h-5 w-5 text-green-500" />
                                )}
                                {result.status === 'failed' && (
                                  <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                                )}
                                {result.status === 'running' && (
                                  <ClockIcon className="h-5 w-5 animate-spin text-blue-500" />
                                )}
                                Test Result
                              </CardTitle>
                              <div className="flex items-center gap-2">
                                <Badge variant={
                                  result.status === 'completed' ? 'default' :
                                    result.status === 'failed' ? 'destructive' : 'secondary'
                                }>
                                  {result.status}
                                </Badge>
                                {result.status === 'completed' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    onClick={() => exportResults(result)}
                                    className="flex items-center gap-1"
                                  >
                                    <ArrowDownTrayIcon className="h-3 w-3" />
                                    Export
                                  </Button>
                                )}
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <div>
                                <p className="text-sm font-medium">Success Rate</p>
                                <p className="text-2xl font-bold text-green-600">
                                  {result.successRate.toFixed(1)}%
                                </p>
                              </div>
                              <div>
                                <p className="text-sm font-medium">Total Time</p>
                                <p className="text-2xl font-bold">
                                  {result.totalExecutionTime ? `${result.totalExecutionTime}ms` : '-'}
                                </p>
                              </div>
                            </div>

                            <div className="space-y-2">
                              <h4 className="text-sm font-medium">Node Results</h4>
                              {result.results.map(nodeResult => (
                                <div key={nodeResult.nodeId} className="p-3 border rounded">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-sm font-medium">{nodeResult.nodeName}</span>
                                      <Badge variant={
                                        nodeResult.status === 'success' ? 'default' :
                                          nodeResult.status === 'failed' ? 'destructive' : 'secondary'
                                      }>
                                        {nodeResult.status}
                                      </Badge>
                                    </div>
                                    <span className="text-xs text-muted-foreground">
                                      {nodeResult.executionTime}ms
                                    </span>
                                  </div>

                                  {nodeResult.output && (
                                    <div className="mt-2 p-2 bg-muted rounded text-xs">
                                      <pre>{JSON.stringify(nodeResult.output, null, 2)}</pre>
                                    </div>
                                  )}

                                  {nodeResult.error && (
                                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                                      {nodeResult.error}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </CardContent>
                        </Card>
                      </div>
                    ))}
                  </div>
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="h-full">
              <ScrollArea className="h-full">
                <div className="space-y-2">
                  {testResults.map(result => (
                    <Card key={result.id} className="cursor-pointer hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {result.status === 'completed' && (
                              <CheckCircleIcon className="h-4 w-4 text-green-500" />
                            )}
                            {result.status === 'failed' && (
                              <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                            )}
                            {result.status === 'running' && (
                              <ClockIcon className="h-4 w-4 animate-spin text-blue-500" />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                Test {result.id.split('_')[1]}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {result.startTime.toLocaleString()}
                              </p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-sm font-medium">
                              {result.successRate.toFixed(1)}% success
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {result.results.length} nodes
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}