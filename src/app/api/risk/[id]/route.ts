import { NextRequest, NextResponse } from "next/server";
import { acknowledgeAlert } from "@/lib/risk/alerter";

export const dynamic = "force-dynamic";

export async function PATCH(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const body = (await req.json().catch(() => ({}))) as { action?: "acknowledge" };
  if (body.action !== "acknowledge") {
    return NextResponse.json({ error: "unknown action" }, { status: 400 });
  }
  await acknowledgeAlert(params.id);
  return NextResponse.json({ ok: true });
}
