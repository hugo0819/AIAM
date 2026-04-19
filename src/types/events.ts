export type EventPhase =
  | "RECEIVED"
  | "VERIFIED"
  | "POLICY_CHECKED"
  | "MASKED"
  | "EXECUTED"
  | "LOGGED";

export type EventDecision =
  | "ALLOW"
  | "DENY"
  | "STEP_UP"
  | "EXECUTED"
  | "ERROR";

export interface AuditEventData {
  id: string;
  passportId: string;
  agentId: string;
  agentName?: string;
  toolId?: string;
  toolName?: string;
  phase: EventPhase;
  decision: EventDecision;
  policyHits: string[];
  argsRaw?: unknown;
  argsMasked?: unknown;
  responseRaw?: unknown;
  responseMasked?: unknown;
  latencyMs?: number;
  riskScore?: number;
  parentEventId?: string;
  createdAt: string;
  note?: string;
}

export type Severity = "INFO" | "WARN" | "CRITICAL";

export interface RiskAlertData {
  id: string;
  passportId: string;
  agentId?: string;
  rule: string;
  severity: Severity;
  evidence: Record<string, unknown>;
  acknowledged: boolean;
  createdAt: string;
}

export type ApprovalStatus = "PENDING" | "APPROVED" | "REJECTED" | "TIMEOUT";

export interface ApprovalRequestData {
  id: string;
  passportId: string;
  agentId: string;
  toolId: string;
  approverId: string;
  reason: string;
  payloadDigest: string;
  args: unknown;
  status: ApprovalStatus;
  expiresAt: string;
  decidedAt?: string;
  createdAt: string;
}
