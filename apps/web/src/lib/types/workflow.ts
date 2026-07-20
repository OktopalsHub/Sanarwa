// Workflow types for the drag-and-drop workflow builder

export type WorkflowNodeType =
  | 'trigger'
  | 'action'
  | 'condition'
  | 'delay'
  | 'split';

export type TriggerType =
  | 'event'
  | 'time'
  | 'api'
  | 'webhook';

export type ActionType =
  | 'email'
  | 'sms'
  | 'push'
  | 'in_app'
  | 'voice'
  | 'webhook';

export type ConditionOperator =
  | 'equals'
  | 'not_equals'
  | 'contains'
  | 'not_contains'
  | 'greater_than'
  | 'less_than'
  | 'exists'
  | 'not_exists';

export interface WorkflowPosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: WorkflowNodeType;
  position: WorkflowPosition;
  data: WorkflowNodeData;
  connections: string[]; // IDs of connected nodes
}

export interface WorkflowNodeData {
  label: string;
  description?: string;
  config: TriggerConfig | ActionConfig | ConditionConfig | DelayConfig | SplitConfig;
}

export interface TriggerConfig {
  type: TriggerType;
  eventName?: string;
  schedule?: string; // cron expression for time-based triggers
  apiEndpoint?: string;
  webhookUrl?: string;
}

export interface ActionConfig {
  type: ActionType;
  templateId?: string;
  message?: string;
  subject?: string;
  recipients?: string[];
  webhookUrl?: string;
  headers?: Record<string, string>;
}

export interface ConditionConfig {
  field: string;
  operator: ConditionOperator;
  value: string | number | boolean;
  trueNodeId?: string;
  falseNodeId?: string;
}

export interface DelayConfig {
  duration: number;
  unit: 'minutes' | 'hours' | 'days';
}

export interface SplitConfig {
  type: 'ab_test' | 'random';
  percentage?: number; // for A/B testing
  branches: {
    id: string;
    label: string;
    percentage: number;
    nodeId: string;
  }[];
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface Workflow {
  id: string;
  name: string;
  description?: string;
  status: WorkflowStatus;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  analytics: WorkflowAnalytics;
  version: number;
  createdAt: Date;
  updatedAt: Date;
  tenantId: string;
}

export type WorkflowStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface WorkflowAnalytics {
  totalExecutions: number;
  successRate: number;
  averageExecutionTime: number;
  nodeExecutions: Record<string, number>;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  nodeExecutions: WorkflowNodeExecution[];
}

export interface WorkflowNodeExecution {
  nodeId: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  output?: any;
}