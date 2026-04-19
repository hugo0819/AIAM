import { NextRequest, NextResponse } from "next/server";
import { derivePassport } from "@/lib/issuer/derive";
import type { Capability, DataClearance, PassportConstraints, RiskTier } from "@/types/passport";

export const dynamic = "force-dynamic";

interface DeriveBody {
  childAgentId: string;
  capabilities: Capability[];
  constraints?: PassportConstraints;
  dataClearance?: DataClearance[];
  riskTier?: RiskTier;
  ttlHours?: number;
}

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await req.json()) as DeriveBody;
  if (!body.childAgentId) {
    return NextResponse.json({ error: "childAgentId required" }, { status: 400 });
  }
  if (!Array.isArray(body.capabilities) || body.capabilities.length === 0) {
    return NextResponse.json(
      { error: "capabilities must be non-empty" },
      { status: 400 },
    );
  }

  try {
    const result = await derivePassport({
      parentPassportId: params.id,
      childAgentId: body.childAgentId,
      capabilities: body.capabilities,
      constraints: body.constraints,
      dataClearance: body.dataClearance,
      riskTier: body.riskTier,
      ttlHours: body.ttlHours,
    });
    return NextResponse.json({
      id: result.passportId,
      jwt: result.jwt,
      payload: result.payload,
    });
  } catch (err) {
    const e = err as Error & { code?: string };
    return NextResponse.json(
      { error: e.message, code: e.code },
      { status: 400 },
    );
  }
}
