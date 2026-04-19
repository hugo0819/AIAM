import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? 50), 200);
  const severity = searchParams.get("severity");
  const ackFilter = searchParams.get("acknowledged");

  const where: Record<string, unknown> = {};
  if (severity) where.severity = severity;
  if (ackFilter === "false") where.acknowledged = false;
  if (ackFilter === "true") where.acknowledged = true;

  const rows = await prisma.riskAlert.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { passport: { include: { agent: true, revocation: true } } },
  });

  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      passportId: r.passportId,
      agentId: r.passport.agentId,
      agentName: r.passport.agent.name,
      passportStatus: r.passport.status,
      passportRevoked: !!r.passport.revocation,
      rule: r.rule,
      severity: r.severity,
      evidence: JSON.parse(r.evidence),
      acknowledged: r.acknowledged,
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
