import { prisma } from "@/lib/prisma";

export type StateCheckCode =
  | "ok"
  | "not_found"
  | "suspended"
  | "expired"
  | "revoked"
  | "agent_suspended";

export interface StateCheckResult {
  code: StateCheckCode;
  detail?: string;
}

export async function checkPassportState(
  passportId: string,
): Promise<StateCheckResult> {
  const passport = await prisma.passport.findUnique({
    where: { id: passportId },
    include: { agent: true, revocation: true },
  });

  if (!passport) return { code: "not_found" };
  if (passport.status === "REVOKED" || passport.revocation) {
    return {
      code: "revoked",
      detail: passport.revocation?.reason,
    };
  }
  if (passport.status === "SUSPENDED") return { code: "suspended" };
  if (passport.expiresAt.getTime() < Date.now()) return { code: "expired" };
  if (passport.agent.status === "SUSPENDED") return { code: "agent_suspended" };

  return { code: "ok" };
}
