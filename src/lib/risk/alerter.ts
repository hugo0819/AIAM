import { prisma } from "@/lib/prisma";
import { bus, EVENT_TOPICS } from "@/lib/eventBus";
import type { RiskAlertData, Severity } from "@/types/events";

/**
 * 去重：同一 passport + 同一 rule 在 60s 内不重复生成新告警，改为累计 evidence。
 */
const recentAlerts = new Map<string, { id: string; ts: number }>();
const DEDUP_WINDOW_MS = 60_000;

export interface CreateAlertParams {
  passportId: string;
  rule: string;
  severity: Severity;
  evidence: Record<string, unknown>;
  description: string;
}

export async function createAlert(params: CreateAlertParams): Promise<RiskAlertData | null> {
  const key = `${params.passportId}|${params.rule}`;
  const prev = recentAlerts.get(key);
  if (prev && Date.now() - prev.ts < DEDUP_WINDOW_MS) {
    // 在去重窗口内：更新 evidence、复用 alert id，不再新建
    try {
      const existing = await prisma.riskAlert.findUnique({ where: { id: prev.id } });
      if (existing) {
        const oldEvidence = JSON.parse(existing.evidence) as Record<string, unknown>;
        const merged = { ...oldEvidence, ...params.evidence, hits: ((oldEvidence.hits as number) ?? 1) + 1 };
        const updated = await prisma.riskAlert.update({
          where: { id: prev.id },
          data: { evidence: JSON.stringify(merged), severity: escalate(existing.severity as Severity, params.severity) },
        });
        recentAlerts.set(key, { id: updated.id, ts: Date.now() });
        const payload: RiskAlertData = {
          id: updated.id,
          passportId: updated.passportId,
          rule: updated.rule,
          severity: updated.severity as Severity,
          evidence: merged,
          acknowledged: updated.acknowledged,
          createdAt: updated.createdAt.toISOString(),
        };
        bus.publish(EVENT_TOPICS.risk, payload);
        return payload;
      }
    } catch {
      // fallthrough: 创建新告警
    }
  }

  const row = await prisma.riskAlert.create({
    data: {
      passportId: params.passportId,
      rule: params.rule,
      severity: params.severity,
      evidence: JSON.stringify({ ...params.evidence, description: params.description, hits: 1 }),
      acknowledged: false,
    },
  });
  recentAlerts.set(key, { id: row.id, ts: Date.now() });

  const payload: RiskAlertData = {
    id: row.id,
    passportId: row.passportId,
    rule: row.rule,
    severity: row.severity as Severity,
    evidence: JSON.parse(row.evidence),
    acknowledged: row.acknowledged,
    createdAt: row.createdAt.toISOString(),
  };
  bus.publish(EVENT_TOPICS.risk, payload);
  return payload;
}

function escalate(prev: Severity, next: Severity): Severity {
  const rank: Record<Severity, number> = { INFO: 1, WARN: 2, CRITICAL: 3 };
  return rank[next] > rank[prev] ? next : prev;
}

export async function acknowledgeAlert(id: string): Promise<void> {
  await prisma.riskAlert.update({
    where: { id },
    data: { acknowledged: true },
  });
}
