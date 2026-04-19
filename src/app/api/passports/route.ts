import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { issuePassport } from "@/lib/issuer/sign";
import type {
  Capability,
  DataClearance,
  PassportConstraints,
  RiskTier,
} from "@/types/passport";

export const dynamic = "force-dynamic";

export async function GET() {
  const passports = await prisma.passport.findMany({
    include: { agent: true, revocation: true },
    orderBy: { issuedAt: "desc" },
  });

  return NextResponse.json({
    items: passports.map((p) => ({
      id: p.id,
      agentId: p.agentId,
      agent: {
        id: p.agent.id,
        name: p.agent.name,
        avatarUrl: p.agent.avatarUrl,
      },
      parentId: p.parentId,
      capabilities: JSON.parse(p.capabilities) as Capability[],
      constraints: JSON.parse(p.constraints) as PassportConstraints,
      dataClearance: JSON.parse(p.dataClearance) as DataClearance[],
      riskTier: p.riskTier as RiskTier,
      delegationDepth: p.delegationDepth,
      delegationMax: p.delegationMax,
      status: p.status,
      issuedAt: p.issuedAt.toISOString(),
      expiresAt: p.expiresAt.toISOString(),
      revoked: !!p.revocation,
      revocationReason: p.revocation?.reason,
    })),
  });
}

interface IssueRequestBody {
  agentId: string;
  capabilities: Capability[];
  constraints: PassportConstraints;
  dataClearance: DataClearance[];
  riskTier: RiskTier;
  ttlHours: number;
  delegationMax?: number;
}

export async function POST(req: NextRequest) {
  let body: IssueRequestBody;
  try {
    body = (await req.json()) as IssueRequestBody;
  } catch {
    return NextResponse.json({ error: "invalid JSON body" }, { status: 400 });
  }

  if (!body.agentId) {
    return NextResponse.json({ error: "agentId required" }, { status: 400 });
  }
  if (!Array.isArray(body.capabilities) || body.capabilities.length === 0) {
    return NextResponse.json(
      { error: "capabilities must be non-empty" },
      { status: 400 },
    );
  }
  if (!body.ttlHours || body.ttlHours <= 0) {
    return NextResponse.json({ error: "invalid ttlHours" }, { status: 400 });
  }

  try {
    const result = await issuePassport({
      agentId: body.agentId,
      capabilities: body.capabilities,
      constraints: body.constraints ?? {},
      dataClearance: body.dataClearance ?? ["public"],
      riskTier: body.riskTier ?? "L2",
      ttlHours: body.ttlHours,
      delegationMax: body.delegationMax,
    });

    return NextResponse.json({
      id: result.passportId,
      jwt: result.jwt,
      payload: result.payload,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "issue failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
