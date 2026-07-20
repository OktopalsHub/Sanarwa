'use client';

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
import { ScrollArea } from '@/components/ui/scroll-area';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { WorkflowValidator } from '@/lib/services/workflow-validation';
import { Workflow, WorkflowNode } from '@/lib/types/workflow';
import { ExclamationTriangleIcon, ArrowRightIcon, CheckCircleIcon, ClockIcon, EyeIcon, PlayIcon, StopIcon, XMarkIcon } from '@heroicons/react/24/outline'
import { useMemo, useState } from 'react';

interface WorkflowPreviewProps {
  workflow: Workflow;
  isOpen: boolean;
  onClose: () => void;
  onTest?: (workflow: Workflow) => void;
}

interface SimulationStep {
  nodeId: string;
  node: WorkflowNode;
  status: 'pending' | 'running' | 'completed' | 'failed';
  startTime?: Date;
  endTime?: Date;
  output?: any;
  error?: string;
}

export function WorkflowPreview({
  workflow,
  isOpen,
  onClose,
  onTest,
}: WorkflowPreviewProps) {
  const [activeTab, setActiveTab] = useState('overview');
  const [isSimulating, setIsSimulating] = useState(false);
  const [simulationSteps, setSimulationSteps] = useState<SimulationStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  // Validate workflow
  const validationResult = useMemo(() => {
    return WorkflowValidator.validate(workflow);
  }, [workflow]);

  // Generate execution order
  const executionOrder = useMemo(() => {
    const order: WorkflowNode[] = [];
    const visited = new Set<string>();

    // Start with trigger nodes
    const triggerNodes = workflow.nodes.filter(node => node.type === 'trigger');

    const traverse = (nodeId: string) => {
      if (visited.has(nodeId)) return;

      const node = workflow.nodes.find(n => n.id === nodeId);
      if (!node) return;

      visited.add(nodeId);
      order.push(node);

      // Find connected nodes
      const connections = workflow.connections.filter(c => c.sourceNodeId === nodeId);
      connections.forEach(conn => traverse(conn.targetNodeId));
    };

    triggerNodes.forEach(trigger => traverse(trigger.id));

    return order;
  }, [workflow]);

  const startSimulation = () => {
    if (!validationResult.isValid) return;

    setIsSimulating(true);
    setCurrentStepIndex(0);

    const steps: SimulationStep[] = executionOrder.map(node => ({
      nodeId: node.id,
      node,
      status: 'pending',
    }));

    setSimulationSteps(steps);

    // Simulate execution
    simulateExecution(steps);
  };

  const simulateExecution = async (steps: SimulationStep[]) => {
    for (let i = 0; i < steps.length; i++) {
      setCurrentStepIndex(i);

      // Update step to running
      setSimulationSteps(prev => prev.map((step, index) =>
        index === i
          ? { ...step, status: 'running', startTime: new Date() }
          : step
      ));

      // Simulate processing time
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));

      // Simulate success/failure (90% success rate)
      const success = Math.random() > 0.1;

      setSimulationSteps(prev => prev.map((step, index) =>
        index === i
          ? {
            ...step,
            status: success ? 'completed' : 'failed',
            endTime: new Date(),
            output: success ? generateMockOutput(step.node) : undefined,
            error: success ? undefined : 'Simulated error for testing'
          }
          : step
      ));

      if (!success) break;
    }

    setIsSimulating(false);
  };

  const generateMockOutput = (node: WorkflowNode) => {
    switch (node.type) {
      case 'trigger':
        return { triggered: true, timestamp: new Date().toISOString() };
      case 'action':
        const config = node.data.config as any;
        if (config.type === 'email') {
          return { sent: true, messageId: `msg_${Math.random().toString(36).substr(2, 9)}` };
        }
        return { executed: true };
      case 'condition':
        return { result: Math.random() > 0.5, value: Math.random() * 100 };
      case 'delay':
        return { delayed: true, duration: (node.data.config as any).duration };
      default:
        return { processed: true };
    }
  };

  const stopSimulation = () => {
    setIsSimulating(false);
  };

  const resetSimulation = () => {
    setIsSimulating(false);
    setSimulationSteps([]);
    setCurrentStepIndex(0);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-hidden">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="flex items-center gap-2">
                <EyeIcon className="h-5 w-5" />
                Workflow Preview
              </DialogTitle>
              <DialogDescription>
                Preview and test your workflow before activation
              </DialogDescription>
            </div>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <XMarkIcon className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="validation">Validation</TabsTrigger>
            <TabsTrigger value="simulation">Simulation</TabsTrigger>
            <TabsTrigger value="execution">Execution Order</TabsTrigger>
          </TabsList>

          <div className="mt-4 h-[500px]">
            <TabsContent value="overview" className="h-full">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-lg">{workflow.name}</CardTitle>
                      {workflow.description && (
                        <p className="text-sm text-muted-foreground">
                          {workflow.description}
                        </p>
                      )}
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <p className="text-sm font-medium">Status</p>
                          <Badge variant="outline">{workflow.status}</Badge>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Version</p>
                          <p className="text-sm text-muted-foreground">v{workflow.version}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Nodes</p>
                          <p className="text-sm text-muted-foreground">{workflow.nodes.length}</p>
                        </div>
                        <div>
                          <p className="text-sm font-medium">Connections</p>
                          <p className="text-sm text-muted-foreground">{workflow.connections.length}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Node Summary</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {workflow.nodes.map(node => (
                          <div key={node.id} className="flex items-center justify-between p-2 border rounded">
                            <div className="flex items-center gap-2">
                              <Badge variant="secondary">{node.type}</Badge>
                              <span className="text-sm">{node.data.label}</span>
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {node.connections.length} connections
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="validation" className="h-full">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        {validationResult.isValid ? (
                          <CheckCircleIcon className="h-5 w-5 text-green-500" />
                        ) : (
                          <ExclamationTriangleIcon className="h-5 w-5 text-red-500" />
                        )}
                        Validation Result
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground mb-4">
                        {validationResult.isValid
                          ? 'Your workflow is valid and ready to run.'
                          : 'Your workflow has validation issues that need to be addressed.'
                        }
                      </p>

                      {validationResult.errors.length > 0 && (
                        <div className="space-y-2 mb-4">
                          <h4 className="text-sm font-medium text-red-600">Errors</h4>
                          {validationResult.errors.map(error => (
                            <div key={error.id} className="p-2 border border-red-200 rounded bg-red-50">
                              <p className="text-sm text-red-800">{error.message}</p>
                            </div>
                          ))}
                        </div>
                      )}

                      {validationResult.warnings.length > 0 && (
                        <div className="space-y-2">
                          <h4 className="text-sm font-medium text-yellow-600">Warnings</h4>
                          {validationResult.warnings.map(warning => (
                            <div key={warning.id} className="p-2 border border-yellow-200 rounded bg-yellow-50">
                              <p className="text-sm text-yellow-800">{warning.message}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>

            <TabsContent value="simulation" className="h-full">
              <div className="space-y-4 h-full">
                <div className="flex items-center gap-2">
                  <Button
                    onClick={startSimulation}
                    disabled={isSimulating || !validationResult.isValid}
                    className="flex items-center gap-2"
                  >
                    <PlayIcon className="h-4 w-4" />
                    Start Simulation
                  </Button>
                  <Button
                    variant="outline"
                    onClick={stopSimulation}
                    disabled={!isSimulating}
                    className="flex items-center gap-2"
                  >
                    <StopIcon className="h-4 w-4" />
                    Stop
                  </Button>
                  <Button
                    variant="outline"
                    onClick={resetSimulation}
                    className="flex items-center gap-2"
                  >
                    Reset
                  </Button>
                </div>

                <ScrollArea className="flex-1">
                  <div className="space-y-2">
                    {simulationSteps.map((step, index) => (
                      <Card key={step.nodeId} className={cn(
                        "transition-colors",
                        index === currentStepIndex && isSimulating && "border-primary",
                        step.status === 'completed' && "border-green-500",
                        step.status === 'failed' && "border-red-500"
                      )}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Badge variant="outline">{step.node.type}</Badge>
                              <span className="text-sm font-medium">{step.node.data.label}</span>
                            </div>
                            <div className="flex items-center gap-2">
                              {step.status === 'running' && (
                                <ClockIcon className="h-4 w-4 animate-spin text-blue-500" />
                              )}
                              {step.status === 'completed' && (
                                <CheckCircleIcon className="h-4 w-4 text-green-500" />
                              )}
                              {step.status === 'failed' && (
                                <ExclamationTriangleIcon className="h-4 w-4 text-red-500" />
                              )}
                              <Badge variant={
                                step.status === 'completed' ? 'default' :
                                  step.status === 'failed' ? 'destructive' :
                                    step.status === 'running' ? 'secondary' : 'outline'
                              }>
                                {step.status}
                              </Badge>
                            </div>
                          </div>

                          {step.output && (
                            <div className="mt-2 p-2 bg-muted rounded text-xs">
                              <pre>{JSON.stringify(step.output, null, 2)}</pre>
                            </div>
                          )}

                          {step.error && (
                            <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-800">
                              {step.error}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </ScrollArea>
              </div>
            </TabsContent>

            <TabsContent value="execution" className="h-full">
              <ScrollArea className="h-full">
                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Execution Order</CardTitle>
                      <p className="text-xs text-muted-foreground">
                        The order in which nodes will be executed
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2">
                        {executionOrder.map((node, index) => (
                          <div key={node.id} className="flex items-center gap-2">
                            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs">
                              {index + 1}
                            </div>
                            <Badge variant="outline">{node.type}</Badge>
                            <span className="text-sm">{node.data.label}</span>
                            {index < executionOrder.length - 1 && (
                              <ArrowRightIcon className="h-3 w-3 text-muted-foreground ml-auto" />
                            )}
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </ScrollArea>
            </TabsContent>
          </div>
        </Tabs>

        <div className="flex justify-end gap-2 pt-4 border-t">
          {onTest && (
            <Button
              onClick={() => onTest(workflow)}
              disabled={!validationResult.isValid}
              className="flex items-center gap-2"
            >
              Run Test
            </Button>
          )}
          <Button variant="outline" onClick={onClose}>
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}