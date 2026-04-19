import { prisma } from "@/lib/prisma";
import type { AuditEventData } from "@/types/events";
import { RULES } from "./rules";
import { createAlert } from "./alerter";

/**
 * 每当有新 AuditEvent 产生时调用，评估全部规则。
 * 只对具有明确 passport + phase 的事件评估，避免系统事件打扰。
 */
export async function evaluateEvent(event: AuditEventData, hour: number) {
  // 拉最近 50 条同 passport 的事件作为上下文
  const recent = await prisma.auditEvent.findMany({
    where: { passportId: event.passportId },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  const recentEvents: AuditEventData[] = recent.map((e) => ({
    id: e.id,
    passportId: e.passportId,
    agentId: event.agentId,
    toolId: e.toolId ?? undefined,
    phase: e.phase as AuditEventData["phase"],
    decision: e.decision as AuditEventData["decision"],
    policyHits: JSON.parse(e.policyHits),
    note: e.note ?? undefined,
    createdAt: e.createdAt.toISOString(),
  }));

  for (const rule of RULES) {
    try {
      const hit = rule.run({
        passportId: event.passportId,
        recentEvents,
        event,
        hour,
      });
      if (hit) {
        await createAlert({
          passportId: event.passportId,
          rule: hit.rule,
          severity: hit.severity,
          evidence: hit.evidence,
          description: hit.description,
        });
      }
    } catch {
      // 规则异常不阻断主流程
    }
  }
}
