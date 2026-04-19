import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const passportId = searchParams.get("passportId");

  const events = await prisma.auditEvent.findMany({
    where: passportId ? { passportId } : undefined,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { passport: { include: { agent: true } }, tool: true },
  });

  return NextResponse.json({
    items: events.map((e) => ({
      id: e.id,
      passportId: e.passportId,
      agentId: e.passport.agentId,
      agentName: e.passport.agent.name,
      toolId: e.toolId,
      toolName: e.tool?.displayName,
      phase: e.phase,
      decision: e.decision,
      policyHits: JSON.parse(e.policyHits),
      argsRaw: e.argsRaw ? JSON.parse(e.argsRaw) : undefined,
      argsMasked: e.argsMasked ? JSON.parse(e.argsMasked) : undefined,
      responseRaw: e.responseRaw ? JSON.parse(e.responseRaw) : undefined,
      responseMasked: e.responseMasked ? JSON.parse(e.responseMasked) : undefined,
      latencyMs: e.latencyMs,
      riskScore: e.riskScore,
      parentEventId: e.parentEventId,
      note: e.note,
      createdAt: e.createdAt.toISOString(),
    })),
  });
}
