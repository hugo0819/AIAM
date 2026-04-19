import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { suspendPassport, resumePassport } from "@/lib/issuer/revoke";
import { verifyPassport } from "@/lib/verifier/verify";
import { checkPassportState } from "@/lib/verifier/stateCheck";

export const dynamic = "force-dynamic";

export async function GET(
  _: NextRequest,
  { params }: { params: { id: string } },
) {
  const p = await prisma.passport.findUnique({
    where: { id: params.id },
    include: { agent: { include: { owner: true } }, revocation: true, parent: true, children: true },
  });
  if (!p) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 同时跑一次验签和状态检查，把诊断结果一起返回（用于详情页展示「健康度」）
  const verify = await verifyPassport(p.jwt);
  const state = await checkPassportState(p.id);

  return NextResponse.json({
    id: p.id,
    agent: {
      id: p.agent.id,
      name: p.agent.name,
      avatarUrl: p.agent.avatarUrl,
      owner: { email: p.agent.owner.email, displayName: p.agent.owner.displayName },
    },
    parentId: p.parentId,
    childrenIds: p.children.map((c) => c.id),
    jwt: p.jwt,
    capabilities: JSON.parse(p.capabilities),
    constraints: JSON.parse(p.constraints),
    dataClearance: JSON.parse(p.dataClearance),
    riskTier: p.riskTier,
    delegationDepth: p.delegationDepth,
    delegationMax: p.delegationMax,
    status: p.status,
    issuedAt: p.issuedAt.toISOString(),
    expiresAt: p.expiresAt.toISOString(),
    revocation: p.revocation && {
      reason: p.revocation.reason,
      operatorId: p.revocation.operatorId,
      revokedAt: p.revocation.revokedAt.toISOString(),
    },
    diagnostics: {
      verify,
      state,
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await req.json()) as { action?: "suspend" | "resume" };
  if (body.action === "suspend") {
    await suspendPassport(params.id);
    return NextResponse.json({ status: "SUSPENDED" });
  }
  if (body.action === "resume") {
    await resumePassport(params.id);
    return NextResponse.json({ status: "ACTIVE" });
  }
  return NextResponse.json({ error: "unknown action" }, { status: 400 });
}
