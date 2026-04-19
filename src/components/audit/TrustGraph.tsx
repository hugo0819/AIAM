"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ReactFlow, {
  Background,
  Controls,
  MiniMap,
  Node,
  Edge,
  MarkerType,
  Handle,
  Position,
} from "reactflow";
import "reactflow/dist/style.css";
import { IdCard, User, Bot, Wrench } from "lucide-react";
import { cn } from "@/lib/utils";

interface TrustNodeData {
  label: string;
  kind: "user" | "agent" | "passport" | "tool";
  meta?: Record<string, unknown>;
}

interface TrustGraphProps {
  className?: string;
  refreshKey?: number;
}

const ICONS = {
  user: User,
  agent: Bot,
  passport: IdCard,
  tool: Wrench,
};

function GraphNode({ data }: { data: TrustNodeData }) {
  const Icon = ICONS[data.kind];
  const toneClass = {
    user: "border-primary/40 bg-primary/10 text-primary",
    agent: "border-accent/40 bg-accent/10 text-accent",
    passport: "border-info/40 bg-info/10 text-info",
    tool: "border-success/40 bg-success/10 text-success",
  }[data.kind];

  const revoked = data.meta?.revoked === true;
  const status = (data.meta?.status as string) ?? "";

  return (
    <div
      className={cn(
        "min-w-[140px] rounded-lg border-2 px-3 py-2 text-center shadow-lg backdrop-blur",
        toneClass,
        revoked && "border-destructive/60 bg-destructive/10 text-destructive opacity-80",
      )}
    >
      <Handle type="target" position={Position.Left} style={{ opacity: 0.4 }} />
      <Handle type="source" position={Position.Right} style={{ opacity: 0.4 }} />
      <div className="flex items-center gap-2">
        <Icon className="h-3.5 w-3.5 shrink-0" />
        <span className="truncate text-xs font-mono">{data.label}</span>
      </div>
      {(data.meta?.riskTier || status) && (
        <div className="mt-1 text-[9px] uppercase tracking-widest opacity-70">
          {[data.meta?.riskTier, status].filter(Boolean).join(" · ")}
        </div>
      )}
    </div>
  );
}

const nodeTypes = { trust: GraphNode };

interface GraphPayload {
  nodes: Array<{ id: string; type: string; label: string; meta?: Record<string, unknown> }>;
  edges: Array<{
    id: string;
    source: string;
    target: string;
    kind: string;
    label?: string;
    data?: Record<string, unknown>;
  }>;
}

export function TrustGraph({ className, refreshKey = 0 }: TrustGraphProps) {
  const [graph, setGraph] = useState<GraphPayload | null>(null);

  const load = useCallback(async () => {
    const res = await fetch("/api/audit/graph");
    if (res.ok) setGraph(await res.json());
  }, []);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  // 自动布局：按 kind 分列
  const { nodes, edges } = useMemo(() => {
    if (!graph) return { nodes: [] as Node[], edges: [] as Edge[] };

    const byKind: Record<string, GraphPayload["nodes"]> = {
      user: [],
      agent: [],
      passport: [],
      tool: [],
    };
    for (const n of graph.nodes) byKind[n.type]?.push(n);

    const colX: Record<string, number> = { user: 60, agent: 280, passport: 520, tool: 820 };
    const ySpacing = 100;

    const rfNodes: Node[] = graph.nodes.map((n) => {
      const col = byKind[n.type];
      const idx = col.findIndex((x) => x.id === n.id);
      return {
        id: n.id,
        type: "trust",
        position: {
          x: colX[n.type] ?? 0,
          y: 40 + idx * ySpacing,
        },
        data: {
          label: n.label,
          kind: n.type as TrustNodeData["kind"],
          meta: n.meta,
        } as TrustNodeData,
      };
    });

    const edgeColor: Record<string, string> = {
      owns: "hsl(217 91% 60%)",
      holds: "hsl(199 89% 48%)",
      derives: "hsl(262 83% 58%)",
      invokes: "hsl(142 76% 45%)",
    };

    const rfEdges: Edge[] = graph.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      animated: e.kind === "invokes",
      style: {
        stroke: edgeColor[e.kind] ?? "hsl(215 20% 50%)",
        strokeWidth: e.kind === "derives" ? 2.5 : 1.5,
      },
      labelStyle: { fill: "hsl(215 20% 65%)", fontSize: 10 },
      labelBgStyle: { fill: "hsl(224 25% 9%)" },
      markerEnd: { type: MarkerType.ArrowClosed, color: edgeColor[e.kind] ?? "gray" },
    }));

    return { nodes: rfNodes, edges: rfEdges };
  }, [graph]);

  return (
    <div className={cn("h-[560px] w-full rounded-lg border border-border bg-card/40", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        proOptions={{ hideAttribution: true }}
      >
        <Background color="hsl(var(--border))" gap={24} />
        <Controls className="!bg-card !border-border" />
        <MiniMap
          className="!bg-card !border !border-border"
          nodeColor={(n) => {
            const kind = (n.data as TrustNodeData)?.kind;
            return (
              {
                user: "hsl(217 91% 60%)",
                agent: "hsl(262 83% 58%)",
                passport: "hsl(199 89% 48%)",
                tool: "hsl(142 76% 45%)",
              }[kind] ?? "gray"
            );
          }}
        />
      </ReactFlow>
    </div>
  );
}
