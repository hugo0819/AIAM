import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status");
  const rows = await prisma.approvalRequest.findMany({
    where: status ? { status } : undefined,
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      passport: { include: { agent: true } },
    },
  });
  return NextResponse.json({
    items: rows.map((r) => ({
      id: r.id,
      passportId: r.passportId,
      agentId: r.passport.agentId,
      agentName: r.passport.agent.name,
      approverId: r.approverId,
      reason: r.reason,
      payloadDigest: r.payloadDigest,
      args: JSON.parse(r.argsSnapshot),
      status: r.status,
      expiresAt: r.expiresAt.toISOString(),
      decidedAt: r.decidedAt?.toISOString(),
      createdAt: r.createdAt.toISOString(),
    })),
  });
}
