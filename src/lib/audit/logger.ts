import { prisma } from "@/lib/prisma";
import { bus, EVENT_TOPICS } from "@/lib/eventBus";
import type {
  AuditEventData,
  EventDecision,
  EventPhase,
} from "@/types/events";

export interface LogInput {
  passportId: string;
  agentId: string;
  toolId?: string;
  phase: EventPhase;
  decision: EventDecision;
  policyHits?: string[];
  argsRaw?: unknown;
  argsMasked?: unknown;
  responseRaw?: unknown;
  responseMasked?: unknown;
  latencyMs?: number;
  riskScore?: number;
  parentEventId?: string;
  note?: string;
}

function serialize(v: unknown) {
  if (v === undefined || v === null) return undefined;
  try {
    return JSON.stringify(v);
  } catch {
    return String(v);
  }
}

export async function logAuditEvent(input: LogInput): Promise<AuditEventData> {
  const row = await prisma.auditEvent.create({
    data: {
      passportId: input.passportId,
      toolId: input.toolId,
      phase: input.phase,
      decision: input.decision,
      policyHits: JSON.stringify(input.policyHits ?? []),
      argsRaw: serialize(input.argsRaw),
      argsMasked: serialize(input.argsMasked),
      responseRaw: serialize(input.responseRaw),
      responseMasked: serialize(input.responseMasked),
      latencyMs: input.latencyMs,
      riskScore: input.riskScore,
      parentEventId: input.parentEventId,
      note: input.note,
    },
  });

  const payload: AuditEventData = {
    id: row.id,
    passportId: row.passportId,
    agentId: input.agentId,
    toolId: row.toolId ?? undefined,
    phase: row.phase as EventPhase,
    decision: row.decision as EventDecision,
    policyHits: JSON.parse(row.policyHits),
    argsRaw: input.argsRaw,
    argsMasked: input.argsMasked,
    responseRaw: input.responseRaw,
    responseMasked: input.responseMasked,
    latencyMs: row.latencyMs ?? undefined,
    riskScore: row.riskScore ?? undefined,
    parentEventId: row.parentEventId ?? undefined,
    note: row.note ?? undefined,
    createdAt: row.createdAt.toISOString(),
  };

  bus.publish(EVENT_TOPICS.audit, payload);
  return payload;
}
