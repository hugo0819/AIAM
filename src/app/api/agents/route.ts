import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const agents = await prisma.agent.findMany({
    include: { owner: true },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json({
    items: agents.map((a) => ({
      id: a.id,
      name: a.name,
      description: a.description,
      avatarUrl: a.avatarUrl,
      riskTier: a.riskTier,
      status: a.status,
      owner: { id: a.owner.id, email: a.owner.email, displayName: a.owner.displayName },
    })),
  });
}
