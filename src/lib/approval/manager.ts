import crypto from "node:crypto";
import { prisma } from "@/lib/prisma";
import { bus, EVENT_TOPICS } from "@/lib/eventBus";
import type { ApprovalRequestData, ApprovalStatus } from "@/types/events";

const DEFAULT_TIMEOUT_MS = 60_000;

export interface CreateApprovalParams {
  passportId: string;
  agentId: string;
  toolId: string;
  approverId: string;
  reason: string;
  args: unknown;
  triggerEventId: string;
  timeoutMs?: number;
}

function digest(v: unknown): string {
  return crypto.createHash("sha256").update(JSON.stringify(v ?? null)).digest("hex").slice(0, 16);
}

export async function createApproval(params: CreateApprovalParams): Promise<ApprovalRequestData> {
  const expires = new Date(Date.now() + (params.timeoutMs ?? DEFAULT_TIMEOUT_MS));
  const row = await prisma.approvalRequest.create({
    data: {
      passportId: params.passportId,
      triggerEventId: params.triggerEventId,
      approverId: params.approverId,
      reason: params.reason,
      payloadDigest: digest(params.args),
      argsSnapshot: JSON.stringify(params.args ?? null),
      status: "PENDING",
      expiresAt: expires,
    },
  });

  const payload: ApprovalRequestData = {
    id: row.id,
    passportId: row.passportId,
    agentId: params.agentId,
    toolId: params.toolId,
    approverId: row.approverId,
    reason: row.reason,
    payloadDigest: row.payloadDigest,
    args: params.args,
    status: row.status as ApprovalStatus,
    expiresAt: row.expiresAt.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };

  bus.publish(EVENT_TOPICS.approval, payload);
  return payload;
}

export async function getApproval(id: string) {
  const row = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!row) return null;
  return row;
}

export async function decideApproval(
  id: string,
  decision: "APPROVED" | "REJECTED",
): Promise<ApprovalRequestData | null> {
  const row = await prisma.approvalRequest.update({
    where: { id },
    data: { status: decision, decidedAt: new Date() },
  });
  const payload: ApprovalRequestData = {
    id: row.id,
    passportId: row.passportId,
    agentId: "",
    toolId: "",
    approverId: row.approverId,
    reason: row.reason,
    payloadDigest: row.payloadDigest,
    args: JSON.parse(row.argsSnapshot),
    status: row.status as ApprovalStatus,
    expiresAt: row.expiresAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
  bus.publish(EVENT_TOPICS.approval, payload);
  return payload;
}

export async function markTimeout(id: string) {
  await prisma.approvalRequest.update({
    where: { id },
    data: { status: "TIMEOUT", decidedAt: new Date() },
  });
  const row = await prisma.approvalRequest.findUnique({ where: { id } });
  if (!row) return;
  const payload: ApprovalRequestData = {
    id: row.id,
    passportId: row.passportId,
    agentId: "",
    toolId: "",
    approverId: row.approverId,
    reason: row.reason,
    payloadDigest: row.payloadDigest,
    args: JSON.parse(row.argsSnapshot),
    status: "TIMEOUT",
    expiresAt: row.expiresAt.toISOString(),
    decidedAt: row.decidedAt?.toISOString(),
    createdAt: row.createdAt.toISOString(),
  };
  bus.publish(EVENT_TOPICS.approval, payload);
}
