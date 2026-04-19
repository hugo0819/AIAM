import { prisma } from "@/lib/prisma";
import { revocationCache } from "@/lib/verifier/revocationCache";

export interface RevokeParams {
  passportId: string;
  reason: string;
  operatorId: string;
  cascade?: boolean; // 默认 true，级联吊销所有派生通行证
}

export interface RevokeResult {
  revokedIds: string[];
}

/**
 * 吊销通行证：
 *  1. 写入 RevocationRecord
 *  2. 更新 Passport.status -> REVOKED
 *  3. 推入内存吊销名单（验签热路径）
 *  4. cascade=true 时递归处理所有 children
 */
export async function revokePassport(params: RevokeParams): Promise<RevokeResult> {
  const cascade = params.cascade !== false;
  const revokedIds: string[] = [];
  const queue = [params.passportId];

  while (queue.length > 0) {
    const id = queue.shift()!;
    if (revokedIds.includes(id)) continue;

    const passport = await prisma.passport.findUnique({
      where: { id },
      include: { children: { select: { id: true } }, revocation: true },
    });
    if (!passport) continue;

    if (!passport.revocation) {
      await prisma.$transaction([
        prisma.revocationRecord.create({
          data: {
            passportId: id,
            reason: params.reason,
            operatorId: params.operatorId,
          },
        }),
        prisma.passport.update({
          where: { id },
          data: { status: "REVOKED" },
        }),
      ]);
    } else {
      await prisma.passport.update({
        where: { id },
        data: { status: "REVOKED" },
      });
    }

    revocationCache.add(id);
    revokedIds.push(id);

    if (cascade) {
      for (const child of passport.children) queue.push(child.id);
    }
  }

  return { revokedIds };
}

export async function suspendPassport(passportId: string) {
  await prisma.passport.update({
    where: { id: passportId },
    data: { status: "SUSPENDED" },
  });
}

export async function resumePassport(passportId: string) {
  await prisma.passport.update({
    where: { id: passportId },
    data: { status: "ACTIVE" },
  });
}
