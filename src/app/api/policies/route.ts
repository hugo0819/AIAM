import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const policies = await prisma.policy.findMany({ orderBy: { priority: "asc" } });
  return NextResponse.json({
    items: policies.map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description,
      enabled: p.enabled,
      priority: p.priority,
      rule: JSON.parse(p.rule),
      createdAt: p.createdAt.toISOString(),
    })),
  });
}
