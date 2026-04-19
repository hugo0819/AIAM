import { jwtVerify } from "jose";
import { getIssuerKeys, ISSUER_NAME } from "@/lib/issuer/keys";
import type { PassportPayload } from "@/types/passport";
import { revocationCache } from "./revocationCache";

export type VerifyFailureCode =
  | "invalid_signature"
  | "expired"
  | "revoked"
  | "issuer_mismatch"
  | "malformed";

export interface VerifySuccess {
  ok: true;
  payload: PassportPayload;
}

export interface VerifyFailure {
  ok: false;
  code: VerifyFailureCode;
  message: string;
}

export type VerifyResult = VerifySuccess | VerifyFailure;

export async function verifyPassport(jwt: string): Promise<VerifyResult> {
  const { publicKey } = await getIssuerKeys();

  let payload: PassportPayload;
  try {
    const result = await jwtVerify(jwt, publicKey, { issuer: ISSUER_NAME });
    payload = result.payload as unknown as PassportPayload;
  } catch (err) {
    const message = err instanceof Error ? err.message : "verify failed";
    if (message.includes("exp") || message.toLowerCase().includes("expired")) {
      return { ok: false, code: "expired", message };
    }
    if (message.includes("iss")) {
      return { ok: false, code: "issuer_mismatch", message };
    }
    return { ok: false, code: "invalid_signature", message };
  }

  if (!payload.jti) {
    return { ok: false, code: "malformed", message: "missing jti" };
  }

  await revocationCache.ensureHydrated();
  if (revocationCache.has(payload.jti)) {
    return {
      ok: false,
      code: "revoked",
      message: `passport ${payload.jti} has been revoked`,
    };
  }

  return { ok: true, payload };
}
