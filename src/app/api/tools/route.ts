import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const tools = await prisma.tool.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json({
    items: tools.map((t) => ({
      id: t.id,
      category: t.category,
      displayName: t.displayName,
      description: t.description,
      riskTier: t.riskTier,
      sensitiveFields: JSON.parse(t.sensitiveFields ?? "[]"),
    })),
  });
}
