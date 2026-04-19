import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decideApproval } from "@/lib/approval/manager";

export const dynamic = "force-dynamic";

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } },
) {
  const row = await prisma.approvalRequest.findUnique({
    where: { id: params.id },
    include: { passport: { include: { agent: true, revocation: true } } },
  });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });

  return NextResponse.json({
    id: row.id,
    passportId: row.passportId,
    agentId: row.passport.agentId,
    agentName: row.passport.agent.name,
    approverId: row.approverId,
    reason: row.reason,
    payloadDigest: row.payloadDigest,
    args: JSON.parse(row.argsSnapshot),
    status: row.status,
    expiresAt: row.expiresAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  });
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await req.json()) as { action?: "approve" | "reject" };
  if (body.action !== "approve" && body.action !== "reject") {
    return NextResponse.json({ error: "invalid action" }, { status: 400 });
  }

  const row = await prisma.approvalRequest.findUnique({
    where: { id: params.id },
  });
  if (!row) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (row.status !== "PENDING") {
    return NextResponse.json(
      { error: `already ${row.status}` },
      { status: 409 },
    );
  }

  const updated = await decideApproval(
    params.id,
    body.action === "approve" ? "APPROVED" : "REJECTED",
  );
  return NextResponse.json(updated);
}
