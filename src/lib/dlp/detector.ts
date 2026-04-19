import { PII_RULES, type PiiKind } from "./rules";

export interface PiiHit {
  kind: PiiKind;
  path: string;
  raw: string;
}

/**
 * 深度遍历任意 JSON，返回所有命中的 PII 条目及其 JSONPath 风格的路径。
 */
export function detectPii(obj: unknown, basePath = "$"): PiiHit[] {
  const hits: PiiHit[] = [];

  const walk = (node: unknown, path: string) => {
    if (node === null || node === undefined) return;
    if (Array.isArray(node)) {
      node.forEach((v, i) => walk(v, `${path}[${i}]`));
      return;
    }
    if (typeof node === "object") {
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        walk(v, `${path}.${k}`);
      }
      return;
    }
    if (typeof node === "string") {
      for (const rule of PII_RULES) {
        const re = new RegExp(rule.regex.source, rule.regex.flags);
        let m: RegExpExecArray | null;
        while ((m = re.exec(node)) !== null) {
          hits.push({ kind: rule.kind, path, raw: m[0] });
          if (!rule.regex.global) break;
        }
      }
    }
  };

  walk(obj, basePath);
  return hits;
}
