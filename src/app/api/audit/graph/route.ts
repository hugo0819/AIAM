import { NextResponse } from "next/server";
import { buildTrustGraph } from "@/lib/audit/chain";

export const dynamic = "force-dynamic";

export async function GET() {
  const graph = await buildTrustGraph();
  return NextResponse.json(graph);
}
