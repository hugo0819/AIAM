import { PII_RULES, maskFieldValue } from "./rules";
import { detectPii, type PiiHit } from "./detector";

export interface MaskResult {
  masked: unknown;
  hits: PiiHit[];
  replacedCount: number;
}

/**
 * 对任意 JSON 对象进行 PII 识别 + 打码。
 * 返回全新对象（深拷贝），不修改原值。
 */
export function maskPii(obj: unknown): MaskResult {
  const hits = detectPii(obj);

  const clone = (node: unknown): unknown => {
    if (node === null || node === undefined) return node;
    if (Array.isArray(node)) return node.map(clone);
    if (typeof node === "object") {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node as Record<string, unknown>)) {
        out[k] = clone(v);
      }
      return out;
    }
    if (typeof node === "string") {
      let result = node;
      for (const rule of PII_RULES) {
        const re = new RegExp(rule.regex.source, rule.regex.flags);
        result = result.replace(re, (m) => rule.mask(m));
      }
      return result;
    }
    return node;
  };

  return {
    masked: clone(obj),
    hits,
    replacedCount: hits.length,
  };
}

/**
 * 按显式字段路径（Tool.sensitiveFields）进一步打码。
 * 支持 "customers[*].phone" 这种数组通配语法。
 */
export function maskByFields(
  obj: unknown,
  fieldPaths: string[],
): { masked: unknown; fieldsMasked: string[] } {
  if (!fieldPaths || fieldPaths.length === 0) return { masked: obj, fieldsMasked: [] };

  const fieldsMasked: string[] = [];
  const out = JSON.parse(JSON.stringify(obj));

  for (const path of fieldPaths) {
    applyFieldMask(out, path.split(/\.|\[|\]/).filter(Boolean), fieldsMasked, path);
  }

  return { masked: out, fieldsMasked };
}

function applyFieldMask(
  node: unknown,
  parts: string[],
  log: string[],
  fullPath: string,
) {
  if (node === null || node === undefined || parts.length === 0) return;
  const [head, ...rest] = parts;

  if (head === "*") {
    if (!Array.isArray(node)) return;
    for (const item of node) applyFieldMask(item, rest, log, fullPath);
    return;
  }

  if (Array.isArray(node)) {
    for (const item of node) applyFieldMask(item, [head, ...rest], log, fullPath);
    return;
  }

  if (typeof node !== "object") return;
  const obj = node as Record<string, unknown>;
  if (rest.length === 0) {
    if (head in obj) {
      obj[head] = maskFieldValue(obj[head], "high");
      log.push(fullPath);
    }
    return;
  }
  if (head in obj) applyFieldMask(obj[head], rest, log, fullPath);
}
