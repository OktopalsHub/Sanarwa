// Workflow validation service

import { Workflow, WorkflowNode } from "@/lib/types/workflow";

export interface ValidationError {
  id: string;
  type: "error" | "warning";
  message: string;
  nodeId?: string;
  connectionId?: string;
}

export interface ValidationResult {
  isValid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
}

export class WorkflowValidator {
  static validate(workflow: Workflow): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Check for basic workflow structure
    if (workflow.nodes.length === 0) {
      errors.push({
        id: "no-nodes",
        type: "error",
        message: "Workflow must have at least one node",
      });
    }

    // Check for trigger nodes
    const triggerNodes = workflow.nodes.filter((node) => node.type === "trigger");
    if (triggerNodes.length === 0) {
      errors.push({
        id: "no-trigger",
        type: "error",
        message: "Workflow must have at least one trigger node",
      });
    }

    // Check for orphaned nodes (nodes with no connections)
    const connectedNodeIds = new Set<string>();
    workflow.connections.forEach((conn) => {
      connectedNodeIds.add(conn.sourceNodeId);
      connectedNodeIds.add(conn.targetNodeId);
    });

    workflow.nodes.forEach((node) => {
      if (node.type !== "trigger" && !connectedNodeIds.has(node.id)) {
        warnings.push({
          id: `orphaned-${node.id}`,
          type: "warning",
          message: `Node "${node.data.label}" is not connected to any other nodes`,
          nodeId: node.id,
        });
      }
    });

    // Check for invalid connections
    workflow.connections.forEach((conn) => {
      const sourceNode = workflow.nodes.find((n) => n.id === conn.sourceNodeId);
      const targetNode = workflow.nodes.find((n) => n.id === conn.targetNodeId);

      if (!sourceNode) {
        errors.push({
          id: `invalid-source-${conn.id}`,
          type: "error",
          message: `Connection references non-existent source node`,
          connectionId: conn.id,
        });
      }

      if (!targetNode) {
        errors.push({
          id: `invalid-target-${conn.id}`,
          type: "error",
          message: `Connection references non-existent target node`,
          connectionId: conn.id,
        });
      }

      // Check for self-connections
      if (conn.sourceNodeId === conn.targetNodeId) {
        errors.push({
          id: `self-connection-${conn.id}`,
          type: "error",
          message: `Node cannot connect to itself`,
          connectionId: conn.id,
        });
      }
    });

    // Validate individual nodes
    workflow.nodes.forEach((node) => {
      const nodeErrors = this.validateNode(node);
      errors.push(...nodeErrors.filter((e) => e.type === "error"));
      warnings.push(...nodeErrors.filter((e) => e.type === "warning"));
    });

    // Check for circular dependencies
    const circularDependencies = this.detectCircularDependencies(workflow);
    if (circularDependencies.length > 0) {
      errors.push({
        id: "circular-dependency",
        type: "error",
        message: `Circular dependency detected: ${circularDependencies.join(" -> ")}`,
      });
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  private static validateNode(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];

    // Check for empty labels
    if (!node.data.label || node.data.label.trim() === "") {
      errors.push({
        id: `empty-label-${node.id}`,
        type: "warning",
        message: `Node has no label`,
        nodeId: node.id,
      });
    }

    // Validate node-specific configurations
    switch (node.type) {
      case "trigger":
        errors.push(...this.validateTriggerNode(node));
        break;
      case "action":
        errors.push(...this.validateActionNode(node));
        break;
      case "condition":
        errors.push(...this.validateConditionNode(node));
        break;
      case "delay":
        errors.push(...this.validateDelayNode(node));
        break;
      case "split":
        errors.push(...this.validateSplitNode(node));
        break;
    }

    return errors;
  }

  private static validateTriggerNode(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = node.data.config as any;

    if (!config.type) {
      errors.push({
        id: `trigger-no-type-${node.id}`,
        type: "error",
        message: `Trigger node must have a type configured`,
        nodeId: node.id,
      });
      return errors;
    }

    switch (config.type) {
      case "event":
        if (!config.eventName) {
          errors.push({
            id: `trigger-no-event-${node.id}`,
            type: "error",
            message: `Event trigger must have an event name`,
            nodeId: node.id,
          });
        }
        break;
      case "time":
        if (!config.schedule) {
          errors.push({
            id: `trigger-no-schedule-${node.id}`,
            type: "error",
            message: `Time trigger must have a schedule`,
            nodeId: node.id,
          });
        }
        break;
      case "api":
        if (!config.apiEndpoint) {
          errors.push({
            id: `trigger-no-endpoint-${node.id}`,
            type: "error",
            message: `API trigger must have an endpoint`,
            nodeId: node.id,
          });
        }
        break;
      case "webhook":
        if (!config.webhookUrl) {
          errors.push({
            id: `trigger-no-webhook-${node.id}`,
            type: "error",
            message: `Webhook trigger must have a URL`,
            nodeId: node.id,
          });
        }
        break;
    }

    return errors;
  }

  private static validateActionNode(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = node.data.config as any;

    if (!config.type) {
      errors.push({
        id: `action-no-type-${node.id}`,
        type: "error",
        message: `Action node must have a type configured`,
        nodeId: node.id,
      });
      return errors;
    }

    switch (config.type) {
      case "email":
        if (!config.templateId && !config.message) {
          errors.push({
            id: `email-no-content-${node.id}`,
            type: "error",
            message: `Email action must have a template or message`,
            nodeId: node.id,
          });
        }
        break;
      case "sms":
        if (!config.templateId && !config.message) {
          errors.push({
            id: `sms-no-content-${node.id}`,
            type: "error",
            message: `SMS action must have a template or message`,
            nodeId: node.id,
          });
        }
        break;
      case "webhook":
        if (!config.webhookUrl) {
          errors.push({
            id: `webhook-no-url-${node.id}`,
            type: "error",
            message: `Webhook action must have a URL`,
            nodeId: node.id,
          });
        }
        break;
    }

    return errors;
  }

  private static validateConditionNode(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = node.data.config as any;

    if (!config.field) {
      errors.push({
        id: `condition-no-field-${node.id}`,
        type: "error",
        message: `Condition node must have a field to evaluate`,
        nodeId: node.id,
      });
    }

    if (!config.operator) {
      errors.push({
        id: `condition-no-operator-${node.id}`,
        type: "error",
        message: `Condition node must have an operator`,
        nodeId: node.id,
      });
    }

    if (config.value === undefined || config.value === "") {
      errors.push({
        id: `condition-no-value-${node.id}`,
        type: "warning",
        message: `Condition node should have a comparison value`,
        nodeId: node.id,
      });
    }

    return errors;
  }

  private static validateDelayNode(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = node.data.config as any;

    if (!config.duration || config.duration <= 0) {
      errors.push({
        id: `delay-invalid-duration-${node.id}`,
        type: "error",
        message: `Delay node must have a positive duration`,
        nodeId: node.id,
      });
    }

    if (!config.unit) {
      errors.push({
        id: `delay-no-unit-${node.id}`,
        type: "error",
        message: `Delay node must have a time unit`,
        nodeId: node.id,
      });
    }

    return errors;
  }

  private static validateSplitNode(node: WorkflowNode): ValidationError[] {
    const errors: ValidationError[] = [];
    const config = node.data.config as any;

    if (!config.type) {
      errors.push({
        id: `split-no-type-${node.id}`,
        type: "error",
        message: `Split node must have a type configured`,
        nodeId: node.id,
      });
    }

    if (config.type === "ab_test" && (config.percentage < 0 || config.percentage > 100)) {
      errors.push({
        id: `split-invalid-percentage-${node.id}`,
        type: "error",
        message: `A/B test percentage must be between 0 and 100`,
        nodeId: node.id,
      });
    }

    return errors;
  }

  private static detectCircularDependencies(workflow: Workflow): string[] {
    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    // Build adjacency list
    const adjacencyList = new Map<string, string[]>();
    workflow.nodes.forEach((node) => {
      adjacencyList.set(node.id, []);
    });

    workflow.connections.forEach((conn) => {
      const sourceConnections = adjacencyList.get(conn.sourceNodeId) || [];
      sourceConnections.push(conn.targetNodeId);
      adjacencyList.set(conn.sourceNodeId, sourceConnections);
    });

    // DFS to detect cycles
    const dfs = (nodeId: string): boolean => {
      visited.add(nodeId);
      recursionStack.add(nodeId);
      path.push(nodeId);

      const neighbors = adjacencyList.get(nodeId) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) {
            return true;
          }
        } else if (recursionStack.has(neighbor)) {
          // Found a cycle
          const cycleStart = path.indexOf(neighbor);
          return true;
        }
      }

      recursionStack.delete(nodeId);
      path.pop();
      return false;
    };

    // Check all nodes for cycles
    for (const node of workflow.nodes) {
      if (!visited.has(node.id)) {
        if (dfs(node.id)) {
          return path;
        }
      }
    }

    return [];
  }
}
