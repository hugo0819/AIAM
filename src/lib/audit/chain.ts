import { prisma } from "@/lib/prisma";

export interface TrustNode {
  id: string;
  type: "user" | "agent" | "passport" | "tool";
  label: string;
  meta?: Record<string, unknown>;
}

export interface TrustEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  kind: "owns" | "holds" | "derives" | "invokes";
  data?: Record<string, unknown>;
}

export interface TrustGraphData {
  nodes: TrustNode[];
  edges: TrustEdge[];
}

/**
 * 构造信任图谱数据：
 *   User → Agent → Passport（含派生树） → Tool
 */
export async function buildTrustGraph(): Promise<TrustGraphData> {
  const [users, agents, passports, tools, events] = await Promise.all([
    prisma.user.findMany(),
    prisma.agent.findMany(),
    prisma.passport.findMany({ include: { revocation: true } }),
    prisma.tool.findMany(),
    prisma.auditEvent.findMany({
      where: { decision: { in: ["EXECUTED"] } },
      orderBy: { createdAt: "desc" },
      take: 200,
    }),
  ]);

  const nodes: TrustNode[] = [];
  const edges: TrustEdge[] = [];

  for (const u of users) {
    nodes.push({ id: `user:${u.id}`, type: "user", label: u.displayName });
  }

  for (const a of agents) {
    nodes.push({
      id: `agent:${a.id}`,
      type: "agent",
      label: a.name,
      meta: { riskTier: a.riskTier, status: a.status },
    });
    edges.push({
      id: `edge:owns:${a.id}`,
      source: `user:${a.ownerId}`,
      target: `agent:${a.id}`,
      kind: "owns",
      label: "owns",
    });
  }

  for (const p of passports) {
    nodes.push({
      id: `passport:${p.id}`,
      type: "passport",
      label: p.id.slice(0, 8) + "…",
      meta: {
        status: p.status,
        riskTier: p.riskTier,
        depth: p.delegationDepth,
        revoked: !!p.revocation,
      },
    });
    edges.push({
      id: `edge:holds:${p.id}`,
      source: `agent:${p.agentId}`,
      target: `passport:${p.id}`,
      kind: "holds",
      label: "holds",
    });
    if (p.parentId) {
      edges.push({
        id: `edge:derives:${p.parentId}-${p.id}`,
        source: `passport:${p.parentId}`,
        target: `passport:${p.id}`,
        kind: "derives",
        label: "derives",
      });
    }
  }

  // 只展示被调用过的工具节点（减少噪声）
  const invokedTools = new Set(events.map((e) => e.toolId).filter(Boolean) as string[]);
  for (const t of tools) {
    if (!invokedTools.has(t.id)) continue;
    nodes.push({ id: `tool:${t.id}`, type: "tool", label: t.displayName });
  }

  // 聚合 (passport, tool) invoke 次数
  const invokeCounts = new Map<string, number>();
  for (const e of events) {
    if (!e.toolId) continue;
    const key = `${e.passportId}|${e.toolId}`;
    invokeCounts.set(key, (invokeCounts.get(key) ?? 0) + 1);
  }
  Array.from(invokeCounts.entries()).forEach(([key, count]) => {
    const [pid, tid] = key.split("|");
    edges.push({
      id: `edge:invokes:${pid}-${tid}`,
      source: `passport:${pid}`,
      target: `tool:${tid}`,
      kind: "invokes",
      label: `invokes × ${count}`,
      data: { count },
    });
  });

  return { nodes, edges };
}
