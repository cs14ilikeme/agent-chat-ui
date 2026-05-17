"use client";

import React from "react";
import { cn } from "@/lib/utils";
import type { TaskEvent } from "@/lib/gago-types";

// --- Types ---

interface DagNode {
  id: string;
  label: string;
  status: "pending" | "running" | "done" | "failed" | "skipped";
  kind: string;
  ts?: string;
}

interface DagEdge {
  from: string;
  to: string;
}

interface TaskDagProps {
  events: TaskEvent[];
  className?: string;
  direction?: "TB" | "LR"; // top-to-bottom or left-to-right
}

// --- Helpers ---

/** Infer DAG nodes from task events */
function buildDag(events: TaskEvent[]): { nodes: DagNode[]; edges: DagEdge[] } {
  if (!events || events.length === 0) {
    return { nodes: [], edges: [] };
  }

  const nodes: DagNode[] = [];
  const seen = new Set<string>();

  for (const evt of events) {
    const id = `${evt.kind}-${nodes.length}`;
    if (seen.has(evt.kind + evt.ts)) continue;
    seen.add(evt.kind + evt.ts);

    let status: DagNode["status"] = "done";
    const kindLower = evt.kind.toLowerCase();
    if (kindLower.includes("fail") || kindLower.includes("error")) status = "failed";
    else if (kindLower.includes("start") || kindLower.includes("running") || kindLower.includes("dispatch")) status = "running";
    else if (kindLower.includes("pending") || kindLower.includes("queue")) status = "pending";
    else if (kindLower.includes("skip")) status = "skipped";

    nodes.push({
      id,
      label: formatLabel(evt.kind),
      status,
      kind: evt.kind,
      ts: evt.ts,
    });
  }

  // Sequential edges
  const edges: DagEdge[] = [];
  for (let i = 1; i < nodes.length; i++) {
    edges.push({ from: nodes[i - 1].id, to: nodes[i].id });
  }

  return { nodes, edges };
}

function formatLabel(kind: string): string {
  return kind
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .slice(0, 20);
}

// --- Layout ---

const NODE_W = 140;
const NODE_H = 44;
const GAP_X = 60;
const GAP_Y = 70;
const PADDING = 20;

function layoutNodes(nodes: DagNode[], direction: "TB" | "LR") {
  const positions: Record<string, { x: number; y: number }> = {};
  nodes.forEach((node, i) => {
    if (direction === "LR") {
      positions[node.id] = { x: PADDING + i * (NODE_W + GAP_X), y: PADDING + 20 };
    } else {
      positions[node.id] = { x: PADDING + 20, y: PADDING + i * (NODE_H + GAP_Y) };
    }
  });
  return positions;
}

// --- Status colors ---

const STATUS_COLORS: Record<DagNode["status"], { fill: string; stroke: string; text: string }> = {
  pending: { fill: "#f3f4f6", stroke: "#9ca3af", text: "#6b7280" },
  running: { fill: "#dbeafe", stroke: "#3b82f6", text: "#1d4ed8" },
  done: { fill: "#dcfce7", stroke: "#22c55e", text: "#166534" },
  failed: { fill: "#fee2e2", stroke: "#ef4444", text: "#991b1b" },
  skipped: { fill: "#f5f5f4", stroke: "#a8a29e", text: "#78716c" },
};

// --- Component ---

export function TaskDag({ events, className, direction = "TB" }: TaskDagProps) {
  const { nodes, edges } = React.useMemo(() => buildDag(events), [events]);
  const positions = React.useMemo(() => layoutNodes(nodes, direction), [nodes, direction]);

  if (nodes.length === 0) {
    return (
      <div className={cn("flex items-center justify-center text-muted-foreground text-sm py-8", className)}>
        暂无流程数据
      </div>
    );
  }

  // Calculate SVG dimensions
  const allPos = Object.values(positions);
  const svgW = Math.max(...allPos.map((p) => p.x)) + NODE_W + PADDING * 2;
  const svgH = Math.max(...allPos.map((p) => p.y)) + NODE_H + PADDING * 2;

  return (
    <div className={cn("overflow-auto rounded-lg border bg-background", className)}>
      <svg width={svgW} height={svgH} className="min-w-full">
        <defs>
          <marker id="dag-arrow" markerWidth="8" markerHeight="6" refX="8" refY="3" orient="auto">
            <polygon points="0 0, 8 3, 0 6" fill="#6b7280" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge) => {
          const from = positions[edge.from];
          const to = positions[edge.to];
          if (!from || !to) return null;

          let x1: number, y1: number, x2: number, y2: number;
          if (direction === "LR") {
            x1 = from.x + NODE_W;
            y1 = from.y + NODE_H / 2;
            x2 = to.x;
            y2 = to.y + NODE_H / 2;
          } else {
            x1 = from.x + NODE_W / 2;
            y1 = from.y + NODE_H;
            x2 = to.x + NODE_W / 2;
            y2 = to.y;
          }

          return (
            <line
              key={`${edge.from}-${edge.to}`}
              x1={x1} y1={y1} x2={x2} y2={y2}
              stroke="#9ca3af"
              strokeWidth={1.5}
              markerEnd="url(#dag-arrow)"
            />
          );
        })}

        {/* Nodes */}
        {nodes.map((node) => {
          const pos = positions[node.id];
          if (!pos) return null;
          const colors = STATUS_COLORS[node.status];

          return (
            <g key={node.id}>
              <rect
                x={pos.x} y={pos.y}
                width={NODE_W} height={NODE_H}
                rx={8} ry={8}
                fill={colors.fill}
                stroke={colors.stroke}
                strokeWidth={2}
              />
              {/* Status dot */}
              <circle
                cx={pos.x + 14} cy={pos.y + NODE_H / 2}
                r={5}
                fill={colors.stroke}
              />
              {/* Label */}
              <text
                x={pos.x + 26} y={pos.y + NODE_H / 2 + 4}
                fontSize={11}
                fill={colors.text}
                fontFamily="system-ui, sans-serif"
              >
                {node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

// --- Wrapper with title for use in task detail ---

export function TaskDagPanel({ events, className }: { events: TaskEvent[]; className?: string }) {
  if (!events || events.length < 2) return null;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="5" cy="6" r="3" /><circle cx="19" cy="6" r="3" /><circle cx="12" cy="18" r="3" />
          <line x1="5" y1="9" x2="12" y2="15" /><line x1="19" y1="9" x2="12" y2="15" />
        </svg>
        执行流程图
      </div>
      <TaskDag events={events} direction="LR" />
    </div>
  );
}
