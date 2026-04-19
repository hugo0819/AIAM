export type PolicyDecision = "ALLOW" | "DENY" | "STEP_UP";

export interface PolicyMatch {
  tool?: string;
  [key: string]: unknown;
}

export interface PolicyRule {
  match: PolicyMatch;
  decide: PolicyDecision;
  reason: string;
}

export interface PolicyRecord {
  id: string;
  name: string;
  description?: string;
  enabled: boolean;
  priority: number;
  rule: PolicyRule;
}
