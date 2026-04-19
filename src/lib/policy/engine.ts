import { prisma } from "@/lib/prisma";
import { matches, type MatcherObject } from "./matcher";
import type { PolicyDecision, PolicyRule } from "@/types/policy";

export interface PolicyContext {
  tool: string;
  args: Record<string, unknown>;
  ctx: {
    timeOfDay: "morning" | "afternoon" | "evening" | "night";
    hour: number;
    now: string;
    agentId: string;
    passportId: string;
    riskTier: string;
  };
}

export interface PolicyEvaluation {
  decide: PolicyDecision;
  reason: string;
  hits: string[]; // 命中的 policy.id 列表
}

/**
 * 按 priority 升序依次评估规则。
 * 第一条非 ALLOW 的规则决定最终结果；如果全部允许，返回 ALLOW。
 * 命中记录中包括：第一条触发 DENY/STEP_UP 的规则 + 之前经过的 ALLOW 规则（用于审计）。
 */
export async function evaluatePolicies(ctx: PolicyContext): Promise<PolicyEvaluation> {
  const policies = await prisma.policy.findMany({
    where: { enabled: true },
    orderBy: { priority: "asc" },
  });

  const hits: string[] = [];
  for (const p of policies) {
    let rule: PolicyRule;
    try {
      rule = JSON.parse(p.rule) as PolicyRule;
    } catch {
      continue;
    }
    const isMatch = matches(ctx, rule.match as MatcherObject);
    if (!isMatch) continue;
    hits.push(p.id);
    if (rule.decide === "DENY" || rule.decide === "STEP_UP") {
      return { decide: rule.decide, reason: rule.reason, hits };
    }
    // ALLOW 继续，让更后面的规则有机会拒绝
  }

  return {
    decide: "ALLOW",
    reason: "无拒绝规则命中，默认允许",
    hits,
  };
}
