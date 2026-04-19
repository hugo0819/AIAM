import type { AuditEventData } from "@/types/events";

export interface RuleHit {
  rule: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  evidence: Record<string, unknown>;
  description: string;
  /** 0~1，用于给 AuditEvent.riskScore 赋值，也用于列表排序。 */
  score: number;
}

export interface RuleEvaluationContext {
  passportId: string;
  /** 该 passport 最近 N 条事件（按时间升序，最新在末尾）。 */
  recentEvents: AuditEventData[];
  /** 当前触发的事件本身。 */
  event: AuditEventData;
  /** ctx.hour：用于非工作时段识别。 */
  hour: number;
}

interface Rule {
  id: string;
  severity: "INFO" | "WARN" | "CRITICAL";
  windowMs: number;
  run: (ctx: RuleEvaluationContext) => RuleHit | null;
}

const IS_NIGHT = (hour: number) => hour < 6 || hour >= 22;
const READ_HEAVY_CATEGORIES = new Set(["crm", "hr", "calendar"]);

const offHoursBulkRead: Rule = {
  id: "off-hours-bulk-read",
  severity: "WARN",
  windowMs: 60_000,
  run: ({ recentEvents, event, hour }) => {
    if (!IS_NIGHT(hour)) return null;
    if (event.phase !== "EXECUTED") return null;
    if (!event.toolId) return null;
    const category = event.toolId.split(".")[0];
    if (!READ_HEAVY_CATEGORIES.has(category)) return null;

    // 同一 passport 最近 60s 内 night + read-heavy 调用次数
    const cutoff = Date.now() - 60_000;
    const count = recentEvents.filter(
      (e) =>
        e.phase === "EXECUTED" &&
        new Date(e.createdAt).getTime() >= cutoff &&
        e.toolId &&
        READ_HEAVY_CATEGORIES.has(e.toolId.split(".")[0]),
    ).length;

    if (count < 3) return null;

    return {
      rule: "off-hours-bulk-read",
      severity: "WARN",
      description: `非工作时段（${hour}:00 左右）检测到高频读类工具调用 ×${count}，可能为异常行为`,
      evidence: { count, windowSec: 60, hour, sampleTool: event.toolId },
      score: Math.min(1, 0.4 + count * 0.1),
    };
  },
};

const repeatedDeny: Rule = {
  id: "repeated-deny",
  severity: "WARN",
  windowMs: 60_000,
  run: ({ recentEvents, event }) => {
    if (event.decision !== "DENY") return null;
    const cutoff = Date.now() - 60_000;
    const denyCount = recentEvents.filter(
      (e) => e.decision === "DENY" && new Date(e.createdAt).getTime() >= cutoff,
    ).length;
    if (denyCount < 3) return null;
    return {
      rule: "repeated-deny",
      severity: "WARN",
      description: `最近 60 秒内出现 ${denyCount} 次拒绝，Agent 可能在试探权限边界`,
      evidence: { denyCount, windowSec: 60 },
      score: Math.min(1, 0.3 + denyCount * 0.15),
    };
  },
};

const deniedHighAmount: Rule = {
  id: "denied-high-amount",
  severity: "INFO",
  windowMs: 300_000,
  run: ({ event }) => {
    if (event.decision !== "DENY") return null;
    if (!event.note?.includes("capability_constraint_violated")) return null;
    if (!event.toolId?.includes("expense") && !event.toolId?.includes("flight")) return null;
    return {
      rule: "denied-high-amount",
      severity: "INFO",
      description: `金额类工具调用被 capability 硬限拦截（${event.toolId}）`,
      evidence: { tool: event.toolId, note: event.note },
      score: 0.25,
    };
  },
};

const approvalRejected: Rule = {
  id: "approval-rejected",
  severity: "INFO",
  windowMs: 300_000,
  run: ({ event }) => {
    if (!event.note) return null;
    if (!event.note.includes("JIT 审批") || !event.note.includes("被拒绝")) return null;
    return {
      rule: "approval-rejected",
      severity: "INFO",
      description: `JIT 审批被持有人拒绝（${event.toolId}）`,
      evidence: { tool: event.toolId, note: event.note },
      score: 0.2,
    };
  },
};

export const RULES: Rule[] = [
  offHoursBulkRead,
  repeatedDeny,
  deniedHighAmount,
  approvalRejected,
];
