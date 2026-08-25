import { createSlice, PayloadAction } from "@reduxjs/toolkit";

export interface WorkflowNode {
  id: string;
  type: "trigger" | "action" | "condition" | "delay" | "split";
  position: { x: number; y: number };
  data: Record<string, any>;
  config?: Record<string, any>;
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface WorkflowState {
  // Current workflow being edited
  currentWorkflow: {
    id: string | null;
    name: string;
    description: string;
    nodes: WorkflowNode[];
    connections: WorkflowConnection[];
    isDirty: boolean;
    lastSaved: number | null;
  };

  // Canvas state
  canvas: {
    zoom: number;
    position: { x: number; y: number };
    selectedNodes: string[];
    selectedConnections: string[];
    draggedNode: string | null;
    isConnecting: boolean;
    connectionStart: { nodeId: string; handle?: string } | null;
  };

  // Node configuration
  nodeConfig: {
    activeNodeId: string | null;
    configPanelOpen: boolean;
    configData: Record<string, any>;
  };

  // Workflow execution
  execution: {
    isRunning: boolean;
    currentStep: string | null;
    executionLog: Array<{
      nodeId: string;
      timestamp: number;
      status: "pending" | "running" | "success" | "error";
      message?: string;
      data?: any;
    }>;
  };

  // History for undo/redo
  history: {
    past: Array<{
      nodes: WorkflowNode[];
      connections: WorkflowConnection[];
    }>;
    future: Array<{
      nodes: WorkflowNode[];
      connections: WorkflowConnection[];
    }>;
    canUndo: boolean;
    canRedo: boolean;
  };
}

const initialState: WorkflowState = {
  currentWorkflow: {
    id: null,
    name: "Untitled Workflow",
    description: "",
    nodes: [],
    connections: [],
    isDirty: false,
    lastSaved: null,
  },
  canvas: {
    zoom: 1,
    position: { x: 0, y: 0 },
    selectedNodes: [],
    selectedConnections: [],
    draggedNode: null,
    isConnecting: false,
    connectionStart: null,
  },
  nodeConfig: {
    activeNodeId: null,
    configPanelOpen: false,
    configData: {},
  },
  execution: {
    isRunning: false,
    currentStep: null,
    executionLog: [],
  },
  history: {
    past: [],
    future: [],
    canUndo: false,
    canRedo: false,
  },
};

export const workflowSlice = createSlice({
  name: "workflow",
  initialState,
  reducers: {
    // Workflow actions
    loadWorkflow: (
      state,
      action: PayloadAction<{
        id: string;
        name: string;
        description: string;
        nodes: WorkflowNode[];
        connections: WorkflowConnection[];
      }>,
    ) => {
      const { id, name, description, nodes, connections } = action.payload;
      state.currentWorkflow = {
        id,
        name,
        description,
        nodes,
        connections,
        isDirty: false,
        lastSaved: Date.now(),
      };
      // Clear history when loading new workflow
      state.history = {
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
      };
    },

    setWorkflowName: (state, action: PayloadAction<string>) => {
      state.currentWorkflow.name = action.payload;
      state.currentWorkflow.isDirty = true;
    },

    setWorkflowDescription: (state, action: PayloadAction<string>) => {
      state.currentWorkflow.description = action.payload;
      state.currentWorkflow.isDirty = true;
    },

    markWorkflowSaved: (state) => {
      state.currentWorkflow.isDirty = false;
      state.currentWorkflow.lastSaved = Date.now();
    },

    // Node actions
    addNode: (state, action: PayloadAction<WorkflowNode>) => {
      // Save current state to history
      state.history.past.push({
        nodes: [...state.currentWorkflow.nodes],
        connections: [...state.currentWorkflow.connections],
      });
      state.history.future = [];
      state.history.canUndo = true;
      state.history.canRedo = false;

      state.currentWorkflow.nodes.push(action.payload);
      state.currentWorkflow.isDirty = true;
    },

    updateNode: (state, action: PayloadAction<{ id: string; updates: Partial<WorkflowNode> }>) => {
      const { id, updates } = action.payload;
      const nodeIndex = state.currentWorkflow.nodes.findIndex((n) => n.id === id);
      if (nodeIndex !== -1) {
        const node = state.currentWorkflow.nodes[nodeIndex];
        if (node) {
          Object.assign(node, updates);
        }
        state.currentWorkflow.isDirty = true;
      }
    },

    removeNode: (state, action: PayloadAction<string>) => {
      const nodeId = action.payload;

      // Save current state to history
      state.history.past.push({
        nodes: [...state.currentWorkflow.nodes],
        connections: [...state.currentWorkflow.connections],
      });
      state.history.future = [];
      state.history.canUndo = true;
      state.history.canRedo = false;

      // Remove node
      state.currentWorkflow.nodes = state.currentWorkflow.nodes.filter((n) => n.id !== nodeId);

      // Remove connections involving this node
      state.currentWorkflow.connections = state.currentWorkflow.connections.filter(
        (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId,
      );

      state.currentWorkflow.isDirty = true;
    },

    // Connection actions
    addConnection: (state, action: PayloadAction<WorkflowConnection>) => {
      // Save current state to history
      state.history.past.push({
        nodes: [...state.currentWorkflow.nodes],
        connections: [...state.currentWorkflow.connections],
      });
      state.history.future = [];
      state.history.canUndo = true;
      state.history.canRedo = false;

      state.currentWorkflow.connections.push(action.payload);
      state.currentWorkflow.isDirty = true;
    },

    removeConnection: (state, action: PayloadAction<string>) => {
      const connectionId = action.payload;

      // Save current state to history
      state.history.past.push({
        nodes: [...state.currentWorkflow.nodes],
        connections: [...state.currentWorkflow.connections],
      });
      state.history.future = [];
      state.history.canUndo = true;
      state.history.canRedo = false;

      state.currentWorkflow.connections = state.currentWorkflow.connections.filter(
        (c) => c.id !== connectionId,
      );
      state.currentWorkflow.isDirty = true;
    },

    // Canvas actions
    setCanvasZoom: (state, action: PayloadAction<number>) => {
      state.canvas.zoom = Math.max(0.1, Math.min(2, action.payload));
    },

    setCanvasPosition: (state, action: PayloadAction<{ x: number; y: number }>) => {
      state.canvas.position = action.payload;
    },

    setSelectedNodes: (state, action: PayloadAction<string[]>) => {
      state.canvas.selectedNodes = action.payload;
    },

    setSelectedConnections: (state, action: PayloadAction<string[]>) => {
      state.canvas.selectedConnections = action.payload;
    },

    setDraggedNode: (state, action: PayloadAction<string | null>) => {
      state.canvas.draggedNode = action.payload;
    },

    startConnection: (state, action: PayloadAction<{ nodeId: string; handle?: string }>) => {
      state.canvas.isConnecting = true;
      state.canvas.connectionStart = action.payload;
    },

    endConnection: (state) => {
      state.canvas.isConnecting = false;
      state.canvas.connectionStart = null;
    },

    // Node configuration actions
    openNodeConfig: (state, action: PayloadAction<string>) => {
      const nodeId = action.payload;
      const node = state.currentWorkflow.nodes.find((n) => n.id === nodeId);
      if (node) {
        state.nodeConfig.activeNodeId = nodeId;
        state.nodeConfig.configPanelOpen = true;
        state.nodeConfig.configData = node.config ? { ...node.config } : {};
      }
    },

    closeNodeConfig: (state) => {
      state.nodeConfig.activeNodeId = null;
      state.nodeConfig.configPanelOpen = false;
      state.nodeConfig.configData = {};
    },

    updateNodeConfig: (state, action: PayloadAction<Record<string, any>>) => {
      state.nodeConfig.configData = { ...state.nodeConfig.configData, ...action.payload };
    },

    saveNodeConfig: (state) => {
      const { activeNodeId, configData } = state.nodeConfig;
      if (activeNodeId) {
        const nodeIndex = state.currentWorkflow.nodes.findIndex((n) => n.id === activeNodeId);
        if (nodeIndex !== -1) {
          if (state.currentWorkflow.nodes[nodeIndex]) {
            state.currentWorkflow.nodes[nodeIndex].config = { ...configData };
          }
          state.currentWorkflow.isDirty = true;
        }
      }
    },

    // Execution actions
    startExecution: (state) => {
      state.execution.isRunning = true;
      state.execution.currentStep = null;
      state.execution.executionLog = [];
    },

    stopExecution: (state) => {
      state.execution.isRunning = false;
      state.execution.currentStep = null;
    },

    setCurrentExecutionStep: (state, action: PayloadAction<string | null>) => {
      state.execution.currentStep = action.payload;
    },

    addExecutionLog: (
      state,
      action: PayloadAction<{
        nodeId: string;
        status: "pending" | "running" | "success" | "error";
        message?: string;
        data?: any;
      }>,
    ) => {
      state.execution.executionLog.push({
        ...action.payload,
        timestamp: Date.now(),
      });
    },

    // History actions (undo/redo)
    undo: (state) => {
      if (state.history.past.length > 0) {
        const previous = state.history.past.pop()!;

        // Save current state to future
        state.history.future.unshift({
          nodes: [...state.currentWorkflow.nodes],
          connections: [...state.currentWorkflow.connections],
        });

        // Restore previous state
        state.currentWorkflow.nodes = previous.nodes;
        state.currentWorkflow.connections = previous.connections;
        state.currentWorkflow.isDirty = true;

        // Update history flags
        state.history.canUndo = state.history.past.length > 0;
        state.history.canRedo = true;
      }
    },

    redo: (state) => {
      if (state.history.future.length > 0) {
        const next = state.history.future.shift()!;

        // Save current state to past
        state.history.past.push({
          nodes: [...state.currentWorkflow.nodes],
          connections: [...state.currentWorkflow.connections],
        });

        // Restore next state
        state.currentWorkflow.nodes = next.nodes;
        state.currentWorkflow.connections = next.connections;
        state.currentWorkflow.isDirty = true;

        // Update history flags
        state.history.canUndo = true;
        state.history.canRedo = state.history.future.length > 0;
      }
    },

    // Clear workflow
    clearWorkflow: (state) => {
      state.currentWorkflow = {
        id: null,
        name: "Untitled Workflow",
        description: "",
        nodes: [],
        connections: [],
        isDirty: false,
        lastSaved: null,
      };
      state.canvas = {
        zoom: 1,
        position: { x: 0, y: 0 },
        selectedNodes: [],
        selectedConnections: [],
        draggedNode: null,
        isConnecting: false,
        connectionStart: null,
      };
      state.nodeConfig = {
        activeNodeId: null,
        configPanelOpen: false,
        configData: {},
      };
      state.execution = {
        isRunning: false,
        currentStep: null,
        executionLog: [],
      };
      state.history = {
        past: [],
        future: [],
        canUndo: false,
        canRedo: false,
      };
    },
  },
});

export const {
  loadWorkflow,
  setWorkflowName,
  setWorkflowDescription,
  markWorkflowSaved,
  addNode,
  updateNode,
  removeNode,
  addConnection,
  removeConnection,
  setCanvasZoom,
  setCanvasPosition,
  setSelectedNodes,
  setSelectedConnections,
  setDraggedNode,
  startConnection,
  endConnection,
  openNodeConfig,
  closeNodeConfig,
  updateNodeConfig,
  saveNodeConfig,
  startExecution,
  stopExecution,
  setCurrentExecutionStep,
  addExecutionLog,
  undo,
  redo,
  clearWorkflow,
} = workflowSlice.actions;

// Selectors
export const selectCurrentWorkflow = (state: { workflow: WorkflowState }) =>
  state.workflow.currentWorkflow;
export const selectWorkflowNodes = (state: { workflow: WorkflowState }) =>
  state.workflow.currentWorkflow.nodes;
export const selectWorkflowConnections = (state: { workflow: WorkflowState }) =>
  state.workflow.currentWorkflow.connections;
export const selectWorkflowIsDirty = (state: { workflow: WorkflowState }) =>
  state.workflow.currentWorkflow.isDirty;
export const selectCanvasState = (state: { workflow: WorkflowState }) => state.workflow.canvas;
export const selectNodeConfig = (state: { workflow: WorkflowState }) => state.workflow.nodeConfig;
export const selectExecutionState = (state: { workflow: WorkflowState }) =>
  state.workflow.execution;
export const selectHistoryState = (state: { workflow: WorkflowState }) => state.workflow.history;
