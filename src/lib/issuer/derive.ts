import { prisma } from "@/lib/prisma";
import { issuePassport } from "./sign";
import { checkPassportState } from "@/lib/verifier/stateCheck";
import type {
  Capability,
  DataClearance,
  PassportConstraints,
  RiskTier,
} from "@/types/passport";

export interface DeriveParams {
  parentPassportId: string;
  childAgentId: string;
  capabilities: Capability[];
  constraints?: PassportConstraints;
  dataClearance?: DataClearance[];
  riskTier?: RiskTier;
  ttlHours?: number;
}

export interface SubsetCheckFailure {
  code:
    | "parent_inactive"
    | "depth_exceeded"
    | "tool_not_in_parent"
    | "scope_not_subset"
    | "constraint_not_subset"
    | "clearance_not_subset";
  detail: string;
}

/**
 * 校验派生通行证的 capabilities 是「父集子集」。
 *   - tool 必须被父通行证包含（含通配 a.* 覆盖 a.x）
 *   - scope 必须 ⊆ 父
 *   - amountMax 不大于父 amountMax（若父有设置）
 *   - dataClearance 不超过父
 */
export function checkSubset(
  parent: {
    capabilities: Capability[];
    dataClearance: DataClearance[];
    delegationDepth: number;
    delegationMax: number;
  },
  child: {
    capabilities: Capability[];
    dataClearance: DataClearance[];
  },
): SubsetCheckFailure | null {
  if (parent.delegationDepth + 1 > parent.delegationMax) {
    return {
      code: "depth_exceeded",
      detail: `派生深度超过父通行证允许的 ${parent.delegationMax}`,
    };
  }

  // 每条子 capability 需能在父中找到一条匹配且覆盖
  for (const c of child.capabilities) {
    const matchedParent = parent.capabilities.find((p) => {
      if (p.tool === c.tool) return true;
      if (p.tool.endsWith(".*")) {
        const prefix = p.tool.slice(0, -2);
        return c.tool.startsWith(prefix + ".");
      }
      return false;
    });
    if (!matchedParent) {
      return {
        code: "tool_not_in_parent",
        detail: `子 capability ${c.tool} 不在父通行证允许的工具内`,
      };
    }
    // scope 子集检查（把 "invoke" 视为超集）
    const parentScopes = new Set(matchedParent.scope);
    const hasInvoke = parentScopes.has("invoke");
    for (const s of c.scope) {
      if (!hasInvoke && !parentScopes.has(s)) {
        return {
          code: "scope_not_subset",
          detail: `子 scope ${s}(${c.tool}) 不在父 scope 内`,
        };
      }
    }
    // amountMax 检查
    if (matchedParent.constraint?.amountMax !== undefined) {
      const childMax =
        c.constraint?.amountMax ?? matchedParent.constraint.amountMax;
      if (childMax > matchedParent.constraint.amountMax) {
        return {
          code: "constraint_not_subset",
          detail: `子 amountMax ${childMax} 大于父 ${matchedParent.constraint.amountMax}`,
        };
      }
    }
  }

  // dataClearance 子集检查
  const parentClearance = new Set(parent.dataClearance);
  for (const c of child.dataClearance) {
    if (!parentClearance.has(c)) {
      return {
        code: "clearance_not_subset",
        detail: `子 dataClearance ${c} 不在父范围内`,
      };
    }
  }

  return null;
}

export async function derivePassport(params: DeriveParams) {
  const parent = await prisma.passport.findUnique({
    where: { id: params.parentPassportId },
    include: { agent: true, revocation: true },
  });
  if (!parent) throw new Error("parent passport not found");

  const state = await checkPassportState(parent.id);
  if (state.code !== "ok") {
    throw new Error(`parent passport state: ${state.code}`);
  }

  const parentCap = JSON.parse(parent.capabilities) as Capability[];
  const parentClearance = JSON.parse(parent.dataClearance) as DataClearance[];

  const subsetFail = checkSubset(
    {
      capabilities: parentCap,
      dataClearance: parentClearance,
      delegationDepth: parent.delegationDepth,
      delegationMax: parent.delegationMax,
    },
    {
      capabilities: params.capabilities,
      dataClearance: params.dataClearance ?? parentClearance,
    },
  );
  if (subsetFail) {
    const err = new Error(subsetFail.detail) as Error & { code?: string };
    err.code = subsetFail.code;
    throw err;
  }

  // 校验子 Agent 存在
  await prisma.agent.findUniqueOrThrow({ where: { id: params.childAgentId } });

  const ttlHours =
    params.ttlHours ??
    Math.max(
      1,
      Math.min(
        8,
        Math.floor((parent.expiresAt.getTime() - Date.now()) / 3_600_000),
      ),
    );

  const result = await issuePassport({
    agentId: params.childAgentId,
    capabilities: params.capabilities,
    constraints: params.constraints ?? (JSON.parse(parent.constraints) as PassportConstraints),
    dataClearance: params.dataClearance ?? parentClearance,
    riskTier: params.riskTier ?? (parent.riskTier as RiskTier),
    ttlHours,
    delegationMax: parent.delegationMax,
    parentJti: parent.id,
    delegationDepth: parent.delegationDepth + 1,
  });

  await prisma.delegationLink.create({
    data: {
      parentPassportId: parent.id,
      childPassportId: result.passportId,
      derivedScope: JSON.stringify(params.capabilities),
    },
  });

  return result;
}
