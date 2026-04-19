import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const baseClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = baseClient;
}

/** 未经 bootstrap 拦截的原始 client，仅供 lib/bootstrap.ts 内部使用。 */
export const prismaBase = baseClient;

/**
 * 在所有模型方法（findMany / create / update 等）之前确保 schema + seed 已就位。
 * 对 dev 环境是零成本的（首次后 cached promise 立即 resolve），
 * 对 Vercel 等只读 FS 部署则会在第一次请求时建库 + 写 seed。
 */
async function ensureReady() {
  // 动态 import 避免循环依赖（bootstrap 内部用 prisma）
  const { ensureBootstrapped } = await import("./bootstrap");
  await ensureBootstrapped();
}

const MODEL_KEYS = new Set([
  "user",
  "agent",
  "passport",
  "tool",
  "policy",
  "auditEvent",
  "approvalRequest",
  "delegationLink",
  "revocationRecord",
  "riskAlert",
]);

export const prisma = new Proxy(baseClient, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver);
    if (typeof prop === "string" && MODEL_KEYS.has(prop)) {
      // 包装模型代理，让每个方法调用前先 bootstrap
      return new Proxy(value as object, {
        get(modelTarget, modelProp, modelReceiver) {
          const fn = Reflect.get(modelTarget, modelProp, modelReceiver);
          if (typeof fn !== "function") return fn;
          return async (...args: unknown[]) => {
            await ensureReady();
            return (fn as (...a: unknown[]) => unknown).apply(modelTarget, args);
          };
        },
      });
    }
    if (
      typeof prop === "string" &&
      (prop === "$queryRawUnsafe" || prop === "$executeRawUnsafe" || prop === "$queryRaw" || prop === "$executeRaw")
    ) {
      // 原生 SQL 不强制 bootstrap（bootstrap 自身会用到）
      return value;
    }
    if (typeof prop === "string" && prop === "$transaction") {
      return async (...args: unknown[]) => {
        await ensureReady();
        return (value as (...a: unknown[]) => unknown).apply(target, args);
      };
    }
    return value;
  },
}) as PrismaClient;
