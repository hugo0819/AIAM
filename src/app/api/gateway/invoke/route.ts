import { NextRequest, NextResponse } from "next/server";
import { invokeThroughGateway } from "@/lib/gateway/pipeline";

export const dynamic = "force-dynamic";

interface InvokeBody {
  passportJwt?: string;
  passportId?: string; // 便于 Demo：允许通过 id 找到 JWT（仅演示）
  tool: string;
  args: Record<string, unknown>;
  ctxOverride?: {
    timeOfDay?: "morning" | "afternoon" | "evening" | "night";
    hour?: number;
  };
  parentEventId?: string;
  resolvedApprovalId?: string;
}

export async function POST(req: NextRequest) {
  const body = (await req.json()) as InvokeBody;
  let jwt = body.passportJwt;

  if (!jwt && body.passportId) {
    const { prisma } = await import("@/lib/prisma");
    const p = await prisma.passport.findUnique({ where: { id: body.passportId } });
    if (!p) {
      return NextResponse.json({ error: "passport not found" }, { status: 404 });
    }
    jwt = p.jwt;
  }

  if (!jwt) {
    return NextResponse.json(
      { error: "passportJwt or passportId required" },
      { status: 400 },
    );
  }
  if (!body.tool) {
    return NextResponse.json({ error: "tool required" }, { status: 400 });
  }

  const result = await invokeThroughGateway({
    passportJwt: jwt,
    tool: body.tool,
    args: body.args ?? {},
    ctxOverride: body.ctxOverride,
    parentEventId: body.parentEventId,
    resolvedApprovalId: body.resolvedApprovalId,
  });

  return NextResponse.json(result);
}
