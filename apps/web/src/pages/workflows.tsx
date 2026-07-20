'use client';

import { Send, User } from '@/lib/icons';

import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WorkflowCanvas } from '@/components/workflows';
import { Workflow } from '@/lib/types/workflow';
import { PlusIcon, QueueListIcon } from '@heroicons/react/24/outline'

import { useState } from 'react';

// Sample workflow data
const sampleWorkflow: Workflow = {
  id: 'workflow-1',
  name: 'Welcome Email Sequence',
  description: 'Automated welcome email sequence for new users',
  status: 'draft',
  nodes: [
    {
      id: 'trigger-1',
      type: 'trigger',
      position: { x: 100, y: 200 },
      data: {
        label: 'User Signup',
        description: 'Triggered when a user signs up',
        config: {
          type: 'event',
          eventName: 'user.signup',
        },
      },
      connections: ['action-1'],
    },
    {
      id: 'action-1',
      type: 'action',
      position: { x: 400, y: 200 },
      data: {
        label: 'Welcome Email',
        description: 'Send welcome email to new user',
        config: {
          type: 'email',
          templateId: 'welcome-template',
          subject: 'Welcome to our platform!',
        },
      },
      connections: ['delay-1'],
    },
    {
      id: 'delay-1',
      type: 'delay',
      position: { x: 700, y: 200 },
      data: {
        label: 'Wait 1 Day',
        description: 'Wait 24 hours before next action',
        config: {
          duration: 1,
          unit: 'days',
        },
      },
      connections: ['action-2'],
    },
    {
      id: 'action-2',
      type: 'action',
      position: { x: 1000, y: 200 },
      data: {
        label: 'Follow-up Email',
        description: 'Send follow-up email with tips',
        config: {
          type: 'email',
          templateId: 'tips-template',
          subject: 'Getting started tips',
        },
      },
      connections: [],
    },
  ],
  connections: [
    {
      id: 'conn-1',
      sourceNodeId: 'trigger-1',
      targetNodeId: 'action-1',
    },
    {
      id: 'conn-2',
      sourceNodeId: 'action-1',
      targetNodeId: 'delay-1',
    },
    {
      id: 'conn-3',
      sourceNodeId: 'delay-1',
      targetNodeId: 'action-2',
    },
  ],
  analytics: {
    totalExecutions: 0,
    successRate: 0,
    averageExecutionTime: 0,
    nodeExecutions: {},
  },
  version: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  tenantId: 'tenant-1',
};

export default function WorkflowsPage() {
  const [workflow, setWorkflow] = useState<Workflow>(sampleWorkflow);
  const [showCanvas, setShowCanvas] = useState(false);

  const handleWorkflowUpdate = (updatedWorkflow: Workflow) => {
    setWorkflow(updatedWorkflow);
    console.log('Workflow updated:', updatedWorkflow);
  };

  const handleCreateNew = () => {
    const newWorkflow: Workflow = {
      id: `workflow-${Date.now()}`,
      name: 'New Workflow',
      description: 'A new workflow',
      status: 'draft',
      nodes: [],
      connections: [],
      analytics: {
        totalExecutions: 0,
        successRate: 0,
        averageExecutionTime: 0,
        nodeExecutions: {},
      },
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
      tenantId: 'tenant-1',
    };
    setWorkflow(newWorkflow);
    setShowCanvas(true);
  };

  if (showCanvas) {
    return (
      <div className="h-screen flex flex-col">
        <div className="flex items-center justify-between p-4 border-b">
          <h1 className="text-2xl font-bold">Workflow Builder</h1>
          <Button
            variant="outline"
            onClick={() => setShowCanvas(false)}
          >
            Back to List
          </Button>
        </div>
        <div className="flex-1">
          <WorkflowCanvas
            workflow={workflow}
            onUpdate={handleWorkflowUpdate}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Workflows</h1>
          <p className="text-muted-foreground">
            Create and manage your communication workflows
          </p>
        </div>
        <Button onClick={handleCreateNew} className="flex items-center gap-2">
          <PlusIcon className="h-4 w-4" />
          Create Workflow
        </Button>
      </div>

      <div className="grid gap-6">
        {/* Sample Workflow Card */}
        <Card className="cursor-pointer hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <QueueListIcon className="h-8 w-8 text-primary" />
                <div>
                  <CardTitle>{workflow.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {workflow.description}
                  </p>
                </div>
              </div>
              <Button
                onClick={() => setShowCanvas(true)}
                variant="outline"
              >
                Edit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-4 text-sm text-muted-foreground">
              <span>{workflow.nodes.length} nodes</span>
              <span>{workflow.connections.length} connections</span>
              <span>Status: {workflow.status}</span>
              <span>Version: {workflow.version}</span>
            </div>
          </CardContent>
        </Card>

        {/* Empty State */}
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <QueueListIcon className="h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">No workflows yet</h3>
            <p className="text-muted-foreground text-center mb-4">
              Create your first workflow to start automating your communications
            </p>
            <Button onClick={handleCreateNew} className="flex items-center gap-2">
              <PlusIcon className="h-4 w-4" />
              Create Your First Workflow
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}