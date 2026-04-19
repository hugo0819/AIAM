import { NextResponse } from "next/server";
import { resetAllData } from "@/lib/bootstrap";
import { revocationCache } from "@/lib/verifier/revocationCache";

export const dynamic = "force-dynamic";

/**
 * 一键重置环境：演示前清场用。
 *  1. 清空所有表
 *  2. 重新写 seed
 *  3. 清空内存吊销名单
 *  4. 不动密钥（密钥保留即可，签发的 JWT 不会复用）
 */
export async function POST() {
  await resetAllData();
  revocationCache.clear();
  return NextResponse.json({
    ok: true,
    message: "环境已重置：DB 重新 seed，内存吊销名单已清空",
    timestamp: new Date().toISOString(),
  });
}
