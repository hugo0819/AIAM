/**
 * 极简的 JSON DSL 匹配器。避免引入 OPA/JSONLogic 等重型依赖。
 *
 * 支持：
 *   - 直接字符串相等（支持 "xxx.*" 通配作为前缀匹配）
 *   - 嵌套路径 "args.amount"、"ctx.timeOfDay"
 *   - 操作符：$gt / $gte / $lt / $lte / $eq / $ne / $in / $nin / $regex / $exists
 *
 * 示例：
 *   { tool: "expense.submit", "args.amount": { $gt: 500 } }
 */

export type MatcherLeaf =
  | string
  | number
  | boolean
  | null
  | { $gt?: number; $gte?: number; $lt?: number; $lte?: number }
  | { $eq?: unknown; $ne?: unknown }
  | { $in?: unknown[]; $nin?: unknown[] }
  | { $regex?: string }
  | { $exists?: boolean };

export type MatcherObject = Record<string, MatcherLeaf | Record<string, unknown>>;

function get(obj: unknown, path: string): unknown {
  if (obj === null || typeof obj !== "object") return undefined;
  const parts = path.split(".");
  let cur: unknown = obj;
  for (const p of parts) {
    if (cur === null || cur === undefined || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[p];
  }
  return cur;
}

function matchLeaf(actual: unknown, expected: MatcherLeaf): boolean {
  if (
    expected === null ||
    typeof expected === "string" ||
    typeof expected === "number" ||
    typeof expected === "boolean"
  ) {
    if (typeof expected === "string" && expected.endsWith(".*")) {
      const prefix = expected.slice(0, -2);
      return typeof actual === "string" && actual.startsWith(prefix + ".");
    }
    return actual === expected;
  }
  if (typeof expected === "object") {
    const e = expected as Record<string, unknown>;
    if ("$gt" in e && !(typeof actual === "number" && actual > (e.$gt as number))) return false;
    if ("$gte" in e && !(typeof actual === "number" && actual >= (e.$gte as number))) return false;
    if ("$lt" in e && !(typeof actual === "number" && actual < (e.$lt as number))) return false;
    if ("$lte" in e && !(typeof actual === "number" && actual <= (e.$lte as number))) return false;
    if ("$eq" in e && actual !== e.$eq) return false;
    if ("$ne" in e && actual === e.$ne) return false;
    if ("$in" in e) {
      const arr = e.$in as unknown[];
      if (!Array.isArray(arr) || !arr.includes(actual)) return false;
    }
    if ("$nin" in e) {
      const arr = e.$nin as unknown[];
      if (Array.isArray(arr) && arr.includes(actual)) return false;
    }
    if ("$regex" in e) {
      const re = new RegExp(e.$regex as string);
      if (typeof actual !== "string" || !re.test(actual)) return false;
    }
    if ("$exists" in e) {
      const exists = e.$exists as boolean;
      if (exists && actual === undefined) return false;
      if (!exists && actual !== undefined) return false;
    }
    return true;
  }
  return false;
}

export function matches(ctx: unknown, expected: MatcherObject): boolean {
  for (const [path, leaf] of Object.entries(expected)) {
    const actual = get(ctx, path);
    if (!matchLeaf(actual, leaf as MatcherLeaf)) return false;
  }
  return true;
}
