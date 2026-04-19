export type RiskTier = "L1" | "L2" | "L3";
export type PassportStatus =
  | "DRAFT"
  | "ACTIVE"
  | "SUSPENDED"
  | "EXPIRED"
  | "REVOKED";

export type ToolScope = "read" | "write" | "invoke";

export interface CapabilityConstraint {
  amountMax?: number;
  currency?: "CNY" | "USD";
  fieldsAllowed?: string[];
  rowLimit?: number;
}

export interface Capability {
  tool: string;
  scope: ToolScope[];
  constraint?: CapabilityConstraint;
}

export interface RateLimit {
  count: number;
  per: "minute" | "hour" | "day";
}

export interface PassportConstraints {
  timeWindow?: string;
  rateLimit?: RateLimit;
  geo?: string[];
  ipCidr?: string[];
}

export type DataClearance = "public" | "internal" | "confidential" | "secret";

export interface PassportPayload {
  iss: string;
  sub: string;
  jti: string;
  holder: { type: "user" | "service"; id: string; verified?: boolean };
  creator: string;
  capabilities: Capability[];
  constraints: PassportConstraints;
  dataClearance: DataClearance[];
  riskTier: RiskTier;
  delegation: { depthMax: number; derivationPolicy: "subset-only" };
  parentJti?: string;
  iat: number;
  exp: number;
  revocationEndpoint: string;
}
