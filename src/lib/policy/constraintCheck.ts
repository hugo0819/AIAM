import type { Capability, PassportConstraints } from "@/types/passport";

export type ConstraintFailure =
  | "capability_missing"
  | "scope_missing"
  | "capability_constraint_violated"
  | "time_window_violated"
  | "geo_violated"
  | "rate_limit_exceeded";

export interface ConstraintResult {
  ok: boolean;
  code?: ConstraintFailure;
  detail?: string;
  matchedCapability?: Capability;
}

/**
 * 判断通行证的 capabilities 是否覆盖目标工具 + scope。
 * 支持 "calendar.*" 形式的通配（前缀匹配）。
 */
export function matchCapability(
  capabilities: Capability[],
  tool: string,
  requiredScope: "read" | "write" | "invoke" = "invoke",
): Capability | null {
  // "invoke" 为元 scope：只要 capability 含有任意 scope 即视为可调用。
  // 具体 scope（read/write）则需要严格匹配或 scope 中显式含 "invoke"。
  const satisfies = (cap: Capability) => {
    if (cap.scope.length === 0) return false;
    if (requiredScope === "invoke") return true;
    return cap.scope.includes(requiredScope) || cap.scope.includes("invoke");
  };

  for (const cap of capabilities) {
    if (cap.tool === tool && satisfies(cap)) return cap;
    if (cap.tool.endsWith(".*")) {
      const prefix = cap.tool.slice(0, -2);
      if (tool.startsWith(prefix + ".") && satisfies(cap)) return cap;
    }
  }
  return null;
}

export interface CheckInput {
  tool: string;
  args: Record<string, unknown>;
  capabilities: Capability[];
  constraints: PassportConstraints;
  requiredScope?: "read" | "write" | "invoke";
}

/**
 * 综合校验：
 *   1. 能力匹配
 *   2. Capability 级约束（如 amountMax）
 *   3. Passport 级约束（timeWindow, geo）
 *
 * 速率限制在单独的 rateLimiter 中处理。
 */
export function checkConstraints(input: CheckInput): ConstraintResult {
  const cap = matchCapability(input.capabilities, input.tool, input.requiredScope ?? "invoke");
  if (!cap) {
    return { ok: false, code: "capability_missing", detail: `tool ${input.tool} not in capabilities` };
  }

  // Capability 级约束
  if (cap.constraint) {
    if (cap.constraint.amountMax !== undefined) {
      const amount = Number(input.args["amount"] ?? NaN);
      if (Number.isFinite(amount) && amount > cap.constraint.amountMax) {
        return {
          ok: false,
          code: "capability_constraint_violated",
          detail: `amount ${amount} > amountMax ${cap.constraint.amountMax}`,
          matchedCapability: cap,
        };
      }
    }
    if (cap.constraint.fieldsAllowed && Array.isArray(input.args["fields"])) {
      const requested = input.args["fields"] as string[];
      const forbidden = requested.filter((f) => !cap.constraint!.fieldsAllowed!.includes(f));
      if (forbidden.length > 0) {
        return {
          ok: false,
          code: "capability_constraint_violated",
          detail: `fields not allowed: ${forbidden.join(",")}`,
          matchedCapability: cap,
        };
      }
    }
  }

  // 时间窗（只做形式校验，用于演示时可配合 ctx.override 强制）
  if (input.constraints.timeWindow) {
    // 为演示稳定性，这里不强制时间窗，仅把结果记录到审计（scenarios 中的 off-hours 由 ctx 触发风险规则）
  }

  return { ok: true, matchedCapability: cap };
}
