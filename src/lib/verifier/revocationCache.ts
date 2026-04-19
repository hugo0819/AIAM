import { prisma } from "@/lib/prisma";

/**
 * 内存吊销名单：验签热路径走内存（< 1ms），重启时从 DB 恢复。
 */
class RevocationCache {
  private set: Set<string> = new Set();
  private hydrated = false;

  async ensureHydrated() {
    if (this.hydrated) return;
    const records = await prisma.revocationRecord.findMany({
      select: { passportId: true },
    });
    this.set = new Set(records.map((r) => r.passportId));
    this.hydrated = true;
  }

  add(passportId: string) {
    this.set.add(passportId);
  }

  has(passportId: string): boolean {
    return this.set.has(passportId);
  }

  remove(passportId: string) {
    this.set.delete(passportId);
  }

  size() {
    return this.set.size;
  }

  clear() {
    this.set.clear();
    this.hydrated = false;
  }
}

const globalForCache = globalThis as unknown as {
  __revocationCache?: RevocationCache;
};

export const revocationCache =
  globalForCache.__revocationCache ?? new RevocationCache();

if (process.env.NODE_ENV !== "production") {
  globalForCache.__revocationCache = revocationCache;
}
