"use client";

import { WorkflowConnection, WorkflowNode } from "@/lib/types/workflow";
import React, { useMemo } from "react";

interface WorkflowConnectionsProps {
  connections: WorkflowConnection[];
  nodes: WorkflowNode[];
  isConnecting?: boolean;
  connectionStart?: string | null;
}

interface ConnectionPath {
  id: string;
  path: string;
  sourceNode: WorkflowNode;
  targetNode: WorkflowNode;
}

export function WorkflowConnections({
  connections,
  nodes,
  isConnecting = false,
  connectionStart = null,
}: WorkflowConnectionsProps) {
  const connectionPaths = useMemo(() => {
    const paths: ConnectionPath[] = [];

    connections.forEach((connection) => {
      const sourceNode = nodes.find((n) => n.id === connection.sourceNodeId);
      const targetNode = nodes.find((n) => n.id === connection.targetNodeId);

      if (sourceNode && targetNode) {
        const sourceX = sourceNode.position.x + 192;
        const sourceY = sourceNode.position.y + 60;
        const targetX = targetNode.position.x;
        const targetY = targetNode.position.y + 60;

        const path = createCurvedPath(sourceX, sourceY, targetX, targetY);

        paths.push({
          id: connection.id,
          path,
          sourceNode,
          targetNode,
        });
      }
    });

    return paths;
  }, [connections, nodes]);

  return (
    <svg className="absolute inset-0 pointer-events-none" style={{ zIndex: 1 }}>
      <defs>
        <marker id="arrowhead" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--muted-foreground))" />
        </marker>

        <marker
          id="arrowhead-active"
          markerWidth="10"
          markerHeight="7"
          refX="9"
          refY="3.5"
          orient="auto"
        >
          <polygon points="0 0, 10 3.5, 0 7" fill="hsl(var(--primary))" />
        </marker>
      </defs>

      {connectionPaths.map((connectionPath) => (
        <g key={connectionPath.id}>
          <path
            d={connectionPath.path}
            stroke="hsl(var(--muted-foreground))"
            strokeWidth="2"
            fill="none"
            markerEnd="url(#arrowhead)"
            className="transition-colors duration-200 hover:stroke-primary"
          />
        </g>
      ))}

      {isConnecting && connectionStart && (
        <TempConnectionLine sourceNodeId={connectionStart} nodes={nodes} />
      )}
    </svg>
  );
}

function TempConnectionLine({
  sourceNodeId,
  nodes,
}: {
  sourceNodeId: string;
  nodes: WorkflowNode[];
}) {
  const [mousePosition, setMousePosition] = React.useState({ x: 0, y: 0 });

  React.useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY });
    };

    document.addEventListener("mousemove", handleMouseMove);
    return () => document.removeEventListener("mousemove", handleMouseMove);
  }, []);

  const sourceNode = nodes.find((n) => n.id === sourceNodeId);
  if (!sourceNode) return null;

  const sourceX = sourceNode.position.x + 192;
  const sourceY = sourceNode.position.y + 60;

  const path = createCurvedPath(sourceX, sourceY, mousePosition.x, mousePosition.y);

  return (
    <path
      d={path}
      stroke="hsl(var(--primary))"
      strokeWidth="2"
      strokeDasharray="5,5"
      fill="none"
      markerEnd="url(#arrowhead-active)"
    />
  );
}

function createCurvedPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): string {
  const dx = targetX - sourceX;
  const dy = targetY - sourceY;

  const controlPointOffset = Math.abs(dx) * 0.5;
  const cp1x = sourceX + controlPointOffset;
  const cp1y = sourceY;
  const cp2x = targetX - controlPointOffset;
  const cp2y = targetY;

  return `M ${sourceX} ${sourceY} C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${targetX} ${targetY}`;
}
