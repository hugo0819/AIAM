import { NextRequest, NextResponse } from "next/server";
import { revokePassport } from "@/lib/issuer/revoke";

export const dynamic = "force-dynamic";

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  let body: { reason?: string; operatorId?: string; cascade?: boolean } = {};
  try {
    body = await req.json();
  } catch {
    // empty body OK
  }

  try {
    const result = await revokePassport({
      passportId: params.id,
      reason: body.reason ?? "管理员手动吊销",
      operatorId: body.operatorId ?? "user:admin",
      cascade: body.cascade !== false,
    });
    return NextResponse.json({ revokedIds: result.revokedIds });
  } catch (err) {
    const message = err instanceof Error ? err.message : "revoke failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
