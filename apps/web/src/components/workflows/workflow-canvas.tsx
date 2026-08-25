"use client";

import { Button } from "@/components/ui/button";
import { Workflow, WorkflowConnection, WorkflowNode, WorkflowPosition } from "@/lib/types/workflow";
import { cn } from "@/lib/utils";
import {
  closestCenter,
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  MouseSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import { restrictToWindowEdges } from "@dnd-kit/modifiers";
import { ArrowPathIcon, MagnifyingGlassIcon } from "@heroicons/react/24/outline";
import React, { useCallback, useMemo, useState } from "react";
import { WorkflowConnections } from "./workflow-connections";
import { WorkflowNodeComponent } from "./workflow-node";
import { WorkflowNodeConfig } from "./workflow-node-config";
import { WorkflowNodePalette } from "./workflow-node-palette";
import { WorkflowPreview } from "./workflow-preview";
import { WorkflowTestRunner } from "./workflow-test-runner";
import { WorkflowToolbar } from "./workflow-toolbar";

interface WorkflowCanvasProps {
  workflow: Workflow;
  onUpdate: (workflow: Workflow) => void;
  readonly?: boolean;
  className?: string;
}

const GRID_SIZE = 20;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 2;
const ZOOM_STEP = 0.25;

export function WorkflowCanvas({
  workflow,
  onUpdate,
  readonly = false,
  className,
}: WorkflowCanvasProps) {
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [draggedNode, setDraggedNode] = useState<WorkflowNode | null>(null);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionStart, setConnectionStart] = useState<string | null>(null);
  const [configNodeId, setConfigNodeId] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [showTestRunner, setShowTestRunner] = useState(false);

  // Configure sensors for drag and drop
  const mouseSensor = useSensor(MouseSensor, {
    activationConstraint: {
      distance: 8,
    },
  });
  const touchSensor = useSensor(TouchSensor, {
    activationConstraint: {
      delay: 200,
      tolerance: 8,
    },
  });
  const sensors = useSensors(mouseSensor, touchSensor);

  // Handle zoom controls
  const handleZoomIn = useCallback(() => {
    setZoom((prev) => Math.min(prev + ZOOM_STEP, MAX_ZOOM));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoom((prev) => Math.max(prev - ZOOM_STEP, MIN_ZOOM));
  }, []);

  const handleResetView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  // Handle node drag start
  const handleDragStart = useCallback(
    (event: DragStartEvent) => {
      const { active } = event;
      const node = workflow.nodes.find((n) => n.id === active.id);
      if (node) {
        setDraggedNode(node);
        setIsDragging(true);
      }
    },
    [workflow.nodes],
  );

  // Handle node drag end
  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, delta } = event;

      if (readonly) return;

      const nodeId = active.id as string;
      const node = workflow.nodes.find((n) => n.id === nodeId);

      if (node && delta) {
        const updatedNodes = workflow.nodes.map((n) =>
          n.id === nodeId
            ? {
                ...n,
                position: {
                  x: n.position.x + delta.x / zoom,
                  y: n.position.y + delta.y / zoom,
                },
              }
            : n,
        );

        onUpdate({
          ...workflow,
          nodes: updatedNodes,
        });
      }

      setDraggedNode(null);
      setIsDragging(false);
    },
    [workflow, onUpdate, readonly, zoom],
  );

  // Handle adding new node from palette
  const handleAddNode = useCallback(
    (nodeType: string, position: WorkflowPosition) => {
      if (readonly) return;

      const newNode: WorkflowNode = {
        id: `node-${Date.now()}`,
        type: nodeType as any,
        position,
        data: {
          label: `New ${nodeType}`,
          config: {} as any,
        },
        connections: [],
      };

      onUpdate({
        ...workflow,
        nodes: [...workflow.nodes, newNode],
      });
    },
    [workflow, onUpdate, readonly],
  );

  // Handle node selection
  const handleNodeSelect = useCallback((nodeId: string) => {
    setSelectedNodeId(nodeId);
  }, []);

  // Handle node configuration
  const handleNodeConfigure = useCallback((nodeId: string) => {
    setConfigNodeId(nodeId);
  }, []);

  const handleNodeConfigSave = useCallback(
    (updatedNode: WorkflowNode) => {
      const updatedNodes = workflow.nodes.map((n) => (n.id === updatedNode.id ? updatedNode : n));

      onUpdate({
        ...workflow,
        nodes: updatedNodes,
      });
    },
    [workflow, onUpdate],
  );

  // Handle node deletion
  const handleNodeDelete = useCallback(
    (nodeId: string) => {
      if (readonly) return;

      const updatedNodes = workflow.nodes.filter((n) => n.id !== nodeId);
      const updatedConnections = workflow.connections.filter(
        (c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId,
      );

      onUpdate({
        ...workflow,
        nodes: updatedNodes,
        connections: updatedConnections,
      });

      if (selectedNodeId === nodeId) {
        setSelectedNodeId(null);
      }
    },
    [workflow, onUpdate, readonly, selectedNodeId],
  );

  // Handle connection creation
  const handleConnectionStart = useCallback(
    (nodeId: string) => {
      if (readonly) return;
      setIsConnecting(true);
      setConnectionStart(nodeId);
    },
    [readonly],
  );

  const handleConnectionEnd = useCallback(
    (targetNodeId: string) => {
      if (readonly || !connectionStart || connectionStart === targetNodeId) {
        setIsConnecting(false);
        setConnectionStart(null);
        return;
      }

      // Check if connection already exists
      const existingConnection = workflow.connections.find(
        (c) => c.sourceNodeId === connectionStart && c.targetNodeId === targetNodeId,
      );

      if (!existingConnection) {
        const newConnection: WorkflowConnection = {
          id: `connection-${Date.now()}`,
          sourceNodeId: connectionStart,
          targetNodeId: targetNodeId,
        };

        onUpdate({
          ...workflow,
          connections: [...workflow.connections, newConnection],
        });
      }

      setIsConnecting(false);
      setConnectionStart(null);
    },
    [workflow, onUpdate, readonly, connectionStart],
  );

  // Handle canvas click (deselect nodes)
  const handleCanvasClick = useCallback(
    (event: React.MouseEvent) => {
      if (event.target === event.currentTarget) {
        setSelectedNodeId(null);
        if (isConnecting) {
          setIsConnecting(false);
          setConnectionStart(null);
        }
      }
    },
    [isConnecting],
  );

  // Grid background style
  const gridStyle = useMemo(
    () => ({
      backgroundImage: `
      linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
      linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
    `,
      backgroundSize: `${GRID_SIZE * zoom}px ${GRID_SIZE * zoom}px`,
      backgroundPosition: `${pan.x}px ${pan.y}px`,
    }),
    [zoom, pan.x, pan.y],
  );

  return (
    <div className={cn("relative h-full w-full overflow-hidden", className)}>
      {/* Toolbar */}
      <WorkflowToolbar
        workflow={workflow}
        onSave={() => onUpdate(workflow)}
        onPreview={() => setShowPreview(true)}
        onTest={() => setShowTestRunner(true)}
        readonly={readonly}
        className="absolute top-4 left-4 z-10"
      />

      {/* Zoom Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
        <Button variant="outline" size="icon" onClick={handleZoomIn} disabled={zoom >= MAX_ZOOM}>
          <MagnifyingGlassIcon className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleZoomOut} disabled={zoom <= MIN_ZOOM}>
          <MagnifyingGlassIcon className="h-4 w-4" />
        </Button>
        <Button variant="outline" size="icon" onClick={handleResetView}>
          <ArrowPathIcon className="h-4 w-4" />
        </Button>
        <div className="text-xs text-muted-foreground text-center">{Math.round(zoom * 100)}%</div>
      </div>

      {/* Node Palette */}
      {!readonly && (
        <WorkflowNodePalette onAddNode={handleAddNode} className="absolute bottom-4 left-4 z-10" />
      )}

      {/* Canvas */}
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToWindowEdges]}
      >
        <div
          className="h-full w-full cursor-grab active:cursor-grabbing"
          style={gridStyle}
          onClick={handleCanvasClick}
        >
          <div
            className="relative h-full w-full"
            style={{
              transform: `scale(${zoom}) translate(${pan.x}px, ${pan.y}px)`,
              transformOrigin: "0 0",
            }}
          >
            {/* Connections */}
            <WorkflowConnections
              connections={workflow.connections}
              nodes={workflow.nodes}
              isConnecting={isConnecting}
              connectionStart={connectionStart}
            />

            {/* Nodes */}
            {workflow.nodes.map((node) => (
              <WorkflowNodeComponent
                key={node.id}
                node={node}
                isSelected={selectedNodeId === node.id}
                isConnecting={isConnecting}
                onSelect={handleNodeSelect}
                onDelete={handleNodeDelete}
                onConfigure={handleNodeConfigure}
                onConnectionStart={handleConnectionStart}
                onConnectionEnd={handleConnectionEnd}
                readonly={readonly}
              />
            ))}
          </div>
        </div>

        {/* Drag Overlay */}
        <DragOverlay>
          {draggedNode && (
            <WorkflowNodeComponent
              node={draggedNode}
              isSelected={false}
              isConnecting={false}
              onSelect={() => {}}
              onDelete={() => {}}
              onConfigure={() => {}}
              onConnectionStart={() => {}}
              onConnectionEnd={() => {}}
              readonly={true}
              isDragging={true}
            />
          )}
        </DragOverlay>
      </DndContext>

      {/* Node Configuration Panel */}
      <WorkflowNodeConfig
        node={configNodeId ? workflow.nodes.find((n) => n.id === configNodeId) || null : null}
        isOpen={!!configNodeId}
        onClose={() => setConfigNodeId(null)}
        onSave={handleNodeConfigSave}
      />

      {/* Workflow Preview */}
      <WorkflowPreview
        workflow={workflow}
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onTest={() => {
          setShowPreview(false);
          setShowTestRunner(true);
        }}
      />

      {/* Workflow Test Runner */}
      <WorkflowTestRunner
        workflow={workflow}
        isOpen={showTestRunner}
        onClose={() => setShowTestRunner(false)}
      />
    </div>
  );
}
