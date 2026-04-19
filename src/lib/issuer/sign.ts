import { SignJWT } from "jose";
import { nanoid } from "nanoid";
import { prisma } from "@/lib/prisma";
import { getIssuerKeys, ISSUER_ALG, ISSUER_NAME } from "./keys";
import type {
  Capability,
  DataClearance,
  PassportConstraints,
  PassportPayload,
  RiskTier,
} from "@/types/passport";

export interface IssueParams {
  agentId: string;
  capabilities: Capability[];
  constraints: PassportConstraints;
  dataClearance: DataClearance[];
  riskTier: RiskTier;
  ttlHours: number;
  delegationMax?: number;
  parentJti?: string;
  delegationDepth?: number;
}

export interface IssueResult {
  passportId: string;
  jwt: string;
  payload: PassportPayload;
}

/**
 * 签发一张通行证：
 *  1. 构造 PassportPayload
 *  2. 用 ES256 私钥签名
 *  3. 写入 Passport 表
 */
export async function issuePassport(params: IssueParams): Promise<IssueResult> {
  const { privateKey } = await getIssuerKeys();

  const jti = nanoid(20);
  const now = Math.floor(Date.now() / 1000);
  const exp = now + params.ttlHours * 3600;

  const agent = await prisma.agent.findUniqueOrThrow({
    where: { id: params.agentId },
    include: { owner: true },
  });

  const payload: PassportPayload = {
    iss: ISSUER_NAME,
    sub: agent.id,
    jti,
    holder: { type: "user", id: agent.owner.email, verified: true },
    creator: agent.owner.email,
    capabilities: params.capabilities,
    constraints: params.constraints,
    dataClearance: params.dataClearance,
    riskTier: params.riskTier,
    delegation: {
      depthMax: params.delegationMax ?? 2,
      derivationPolicy: "subset-only",
    },
    parentJti: params.parentJti,
    iat: now,
    exp,
    revocationEndpoint: "/api/passports/__id__/revoke",
  };

  const jwt = await new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: ISSUER_ALG, typ: "JWT", kid: "issuer-1" })
    .setIssuedAt(now)
    .setExpirationTime(exp)
    .setIssuer(ISSUER_NAME)
    .setSubject(agent.id)
    .setJti(jti)
    .sign(privateKey);

  await prisma.passport.create({
    data: {
      id: jti,
      agentId: agent.id,
      parentId: params.parentJti ?? null,
      jwt,
      capabilities: JSON.stringify(params.capabilities),
      constraints: JSON.stringify(params.constraints),
      dataClearance: JSON.stringify(params.dataClearance),
      riskTier: params.riskTier,
      delegationDepth: params.delegationDepth ?? 0,
      delegationMax: params.delegationMax ?? 2,
      status: "ACTIVE",
      issuedAt: new Date(now * 1000),
      expiresAt: new Date(exp * 1000),
    },
    include: { agent: true },
  });

  return { passportId: jti, jwt, payload };
}
