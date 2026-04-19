import { prisma } from "@/lib/prisma";
import { verifyPassport } from "@/lib/verifier/verify";
import { checkPassportState } from "@/lib/verifier/stateCheck";
import { checkConstraints } from "@/lib/policy/constraintCheck";
import { evaluatePolicies } from "@/lib/policy/engine";
import { rateLimiter } from "@/lib/policy/rateLimiter";
import { logAuditEvent } from "@/lib/audit/logger";
import { invokeTool } from "@/mock/tools";
import { maskPii, maskByFields } from "@/lib/dlp/masker";
import { createApproval } from "@/lib/approval/manager";
import { waitForApproval } from "@/lib/approval/waiter";
import { evaluateEvent } from "@/lib/risk/monitor";
import type { Capability, PassportConstraints, PassportPayload } from "@/types/passport";

export interface InvokeInput {
  passportJwt: string;
  tool: string;
  args: Record<string, unknown>;
  /** 非工作时段模拟（用于风险场景演示）。 */
  ctxOverride?: { timeOfDay?: "morning" | "afternoon" | "evening" | "night"; hour?: number };
  parentEventId?: string;
  /** 对于 STEP_UP 场景，如果带 resolvedApprovalId 表示已经过审批，直接放行执行。 */
  resolvedApprovalId?: string;
}


export interface InvokeResult {
  ok: boolean;
  decision: "EXECUTED" | "DENIED" | "STEP_UP" | "ERROR";
  phase: string;
  reason?: string;
  response?: unknown;
  responseMasked?: unknown;
  passportId?: string;
  eventIds: string[];
  policyHits: string[];
  /** STEP_UP 情况下返回的审批请求 ID。 */
  approvalRequestId?: string;
}

/**
 * 10 步网关主流程（见 构建方案.md §2.2）
 *   1 验签 → 2 状态 → 3 能力 → 4 约束 → 5 速率 → 6 策略 → 7 入参脱敏
 *   → 8 执行 → 9 出参脱敏 → 10 审计
 *
 * Day 3 版本：脱敏与 JIT 为占位（Day 4 接入）。
 *
 * 每一步都产出一条 AuditEvent。最终返回聚合结果。
 */
export async function invokeThroughGateway(input: InvokeInput): Promise<InvokeResult> {
  const eventIds: string[] = [];
  const policyHits: string[] = [];
  const producedEvents: Array<Parameters<typeof evaluateEvent>[0]> = [];
  const logOne = async (args: Parameters<typeof logAuditEvent>[0]) => {
    const evt = await logAuditEvent({ ...args, parentEventId: input.parentEventId });
    eventIds.push(evt.id);
    producedEvents.push(evt);
    return evt;
  };

  const currentHour = input.ctxOverride?.hour ?? new Date().getHours();

  try {
    return await runPipeline();
  } finally {
    // 流水线结束后异步评估所有事件，不阻塞返回
    for (const evt of producedEvents) {
      evaluateEvent(evt, currentHour).catch(() => {});
    }
  }

  async function runPipeline(): Promise<InvokeResult> {

  // ── 1. 验签 ─────────────────────────────────────────────────────────
  const verify = await verifyPassport(input.passportJwt);
  if (!verify.ok) {
    // 没有合法 passportId 的情况下，用 "unknown" 记录一个孤儿事件到第一个活跃 Passport
    const anyPassport = await prisma.passport.findFirst({ orderBy: { issuedAt: "desc" } });
    if (anyPassport) {
      await logOne({
        passportId: anyPassport.id,
        agentId: anyPassport.agentId,
        toolId: input.tool,
        phase: "VERIFIED",
        decision: "DENY",
        note: `verify failed: ${verify.code} · ${verify.message}`,
      });
    }
    return {
      ok: false,
      decision: "DENIED",
      phase: "VERIFIED",
      reason: `invalid_token (${verify.code})`,
      eventIds,
      policyHits,
    };
  }

  const payload: PassportPayload = verify.payload;
  const passportId = payload.jti;
  const agentId = payload.sub;

  await logOne({
    passportId,
    agentId,
    toolId: input.tool,
    phase: "RECEIVED",
    decision: "ALLOW",
    argsRaw: input.args,
    note: `Agent ${agentId} 调用 ${input.tool}`,
  });

  await logOne({
    passportId,
    agentId,
    toolId: input.tool,
    phase: "VERIFIED",
    decision: "ALLOW",
    note: "JWT 签名 ES256 验证通过",
  });

  // ── 2. 状态检查 ─────────────────────────────────────────────────────
  const state = await checkPassportState(passportId);
  if (state.code !== "ok") {
    await logOne({
      passportId,
      agentId,
      toolId: input.tool,
      phase: "VERIFIED",
      decision: "DENY",
      note: `passport state: ${state.code}${state.detail ? " · " + state.detail : ""}`,
    });
    return {
      ok: false,
      decision: "DENIED",
      phase: "VERIFIED",
      reason: `passport_${state.code}`,
      passportId,
      eventIds,
      policyHits,
    };
  }

  // ── 3+4. 能力 & 约束 ───────────────────────────────────────────────
  const constraint = checkConstraints({
    tool: input.tool,
    args: input.args,
    capabilities: payload.capabilities as Capability[],
    constraints: payload.constraints as PassportConstraints,
  });
  if (!constraint.ok) {
    await logOne({
      passportId,
      agentId,
      toolId: input.tool,
      phase: "POLICY_CHECKED",
      decision: "DENY",
      note: `${constraint.code} · ${constraint.detail ?? ""}`,
    });
    return {
      ok: false,
      decision: "DENIED",
      phase: "POLICY_CHECKED",
      reason: constraint.code,
      passportId,
      eventIds,
      policyHits,
    };
  }

  // ── 5. 速率限制 ────────────────────────────────────────────────────
  if (payload.constraints.rateLimit) {
    const rl = rateLimiter.tryConsume(passportId, payload.constraints.rateLimit);
    if (!rl.ok) {
      await logOne({
        passportId,
        agentId,
        toolId: input.tool,
        phase: "POLICY_CHECKED",
        decision: "DENY",
        note: `rate limit exceeded: reset in ${rl.resetMs}ms`,
      });
      return {
        ok: false,
        decision: "DENIED",
        phase: "POLICY_CHECKED",
        reason: "rate_limit_exceeded",
        passportId,
        eventIds,
        policyHits,
      };
    }
  }

  // ── 6. 策略评估 ────────────────────────────────────────────────────
  const hour = input.ctxOverride?.hour ?? new Date().getHours();
  const timeOfDay =
    input.ctxOverride?.timeOfDay ??
    (hour < 6
      ? "night"
      : hour < 12
        ? "morning"
        : hour < 18
          ? "afternoon"
          : hour < 22
            ? "evening"
            : "night");

  const policy = await evaluatePolicies({
    tool: input.tool,
    args: input.args,
    ctx: {
      timeOfDay,
      hour,
      now: new Date().toISOString(),
      agentId,
      passportId,
      riskTier: payload.riskTier,
    },
  });
  policyHits.push(...policy.hits);

  if (policy.decide === "DENY") {
    await logOne({
      passportId,
      agentId,
      toolId: input.tool,
      phase: "POLICY_CHECKED",
      decision: "DENY",
      policyHits: policy.hits,
      note: policy.reason,
    });
    return {
      ok: false,
      decision: "DENIED",
      phase: "POLICY_CHECKED",
      reason: policy.reason,
      passportId,
      eventIds,
      policyHits,
    };
  }

  if (policy.decide === "STEP_UP" && !input.resolvedApprovalId) {
    const evt = await logOne({
      passportId,
      agentId,
      toolId: input.tool,
      phase: "POLICY_CHECKED",
      decision: "STEP_UP",
      policyHits: policy.hits,
      argsRaw: input.args,
      note: policy.reason,
    });

    // 获取 agent 的 owner 作为审批人
    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    const approverId = agent?.ownerId ?? "user:admin";

    const approval = await createApproval({
      passportId,
      agentId,
      toolId: input.tool,
      approverId,
      reason: policy.reason,
      args: input.args,
      triggerEventId: evt.id,
    });

    // 阻塞等待审批（最长 60s）
    const decision = await waitForApproval(approval.id, 60_000);

    if (decision !== "APPROVED") {
      await logOne({
        passportId,
        agentId,
        toolId: input.tool,
        phase: "POLICY_CHECKED",
        decision: "DENY",
        policyHits: policy.hits,
        note: `JIT 审批 ${decision === "TIMEOUT" ? "超时" : "被拒绝"}`,
      });
      return {
        ok: false,
        decision: "DENIED",
        phase: "POLICY_CHECKED",
        reason: `approval_${decision.toLowerCase()}`,
        passportId,
        eventIds,
        policyHits,
        approvalRequestId: approval.id,
      };
    }

    await logOne({
      passportId,
      agentId,
      toolId: input.tool,
      phase: "POLICY_CHECKED",
      decision: "ALLOW",
      policyHits: policy.hits,
      note: "JIT 审批通过，继续执行",
    });
    // 审批通过后继续走下面的执行逻辑
  }

  if (policy.decide === "ALLOW") {
    await logOne({
      passportId,
      agentId,
      toolId: input.tool,
      phase: "POLICY_CHECKED",
      decision: "ALLOW",
      policyHits: policy.hits,
      note: policy.reason,
    });
  }

  // ── 7. 入参 DLP ──────────────────────────────────────────────────────
  const inputMask = maskPii(input.args);
  const argsMasked = inputMask.masked as Record<string, unknown>;
  const inputMaskChanged = inputMask.replacedCount > 0;
  await logOne({
    passportId,
    agentId,
    toolId: input.tool,
    phase: "MASKED",
    decision: "ALLOW",
    argsRaw: input.args,
    argsMasked,
    note: inputMaskChanged
      ? `入参脱敏 · 识别 ${inputMask.replacedCount} 处 PII（${inputMask.hits.map((h) => h.kind).join(", ")}）`
      : "入参无 PII，直通",
  });

  // ── 8. 执行工具 ────────────────────────────────────────────────────
  const startedAt = Date.now();
  let response: unknown;
  try {
    response = await invokeTool(input.tool, argsMasked as Record<string, unknown>, {
      agentId,
      passportId,
    });
  } catch (err) {
    await logOne({
      passportId,
      agentId,
      toolId: input.tool,
      phase: "EXECUTED",
      decision: "ERROR",
      note: err instanceof Error ? err.message : "tool error",
    });
    return {
      ok: false,
      decision: "ERROR",
      phase: "EXECUTED",
      reason: "tool_error",
      passportId,
      eventIds,
      policyHits,
    };
  }
  const latencyMs = Date.now() - startedAt;

  // ── 9. 出参 DLP ──────────────────────────────────────────────────────
  // 第一步：regex 识别 + 打码
  const outMask = maskPii(response);
  let responseMasked: unknown = outMask.masked;
  const outNotes: string[] = [];
  if (outMask.replacedCount > 0) {
    outNotes.push(
      `regex: ${outMask.replacedCount} 处（${Array.from(new Set(outMask.hits.map((h) => h.kind))).join(", ")}）`,
    );
  }
  // 第二步：按工具显式声明的 sensitiveFields 补刀
  const toolRow = await prisma.tool.findUnique({ where: { id: input.tool } });
  if (toolRow) {
    try {
      const fields = JSON.parse(toolRow.sensitiveFields ?? "[]") as string[];
      if (fields.length > 0) {
        const fieldMask = maskByFields(responseMasked, fields);
        responseMasked = fieldMask.masked;
        if (fieldMask.fieldsMasked.length > 0) {
          outNotes.push(`fields: ${fieldMask.fieldsMasked.join(" / ")}`);
        }
      }
    } catch {
      // ignore bad json
    }
  }

  await logOne({
    passportId,
    agentId,
    toolId: input.tool,
    phase: "EXECUTED",
    decision: "EXECUTED",
    argsRaw: input.args,
    argsMasked,
    responseRaw: response,
    responseMasked,
    latencyMs,
    note:
      outNotes.length > 0
        ? `工具执行成功 (${latencyMs}ms)，出参脱敏 · ${outNotes.join(" | ")}`
        : `工具执行成功 (${latencyMs}ms)，出参无 PII`,
  });

  // ── 10. LOGGED（管道结束） ─────────────────────────────────────────
  await logOne({
    passportId,
    agentId,
    toolId: input.tool,
    phase: "LOGGED",
    decision: "EXECUTED",
    note: "审计落库，管道结束",
  });

  return {
    ok: true,
    decision: "EXECUTED",
    phase: "LOGGED",
    response,
    responseMasked,
    passportId,
    eventIds,
    policyHits,
  };
  } // end runPipeline
}
