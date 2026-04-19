import { promises as fs } from "node:fs";
import path from "node:path";
import { prismaBase as prisma } from "@/lib/prisma";

/**
 * 自动初始化数据库：
 *   1. 解析 DATABASE_URL 中的 sqlite 文件路径
 *   2. 若文件不存在 → 通过 prisma 执行建表 SQL（不依赖 prisma CLI）
 *   3. 若 User/Tool/Policy 为空 → 注入种子数据
 *
 * 适用于 Vercel 等只读 FS 部署：把 DATABASE_URL 设为 file:/tmp/dev.db，
 * 第一次请求自动建库 + 写 seed，无需手动 db push。
 *
 * 在 dev 环境下也可调用，无副作用（库存在则跳过）。
 */

let bootstrapPromise: Promise<void> | null = null;

export function ensureBootstrapped(): Promise<void> {
  if (bootstrapPromise) return bootstrapPromise;
  bootstrapPromise = doBootstrap().catch((err) => {
    bootstrapPromise = null; // 失败后允许重试
    throw err;
  });
  return bootstrapPromise;
}

async function doBootstrap(): Promise<void> {
  await ensureSchema();
  await ensureSeedData();
}

function dbFilePath(): string | null {
  const url = process.env.DATABASE_URL ?? "file:./prisma/dev.db";
  if (!url.startsWith("file:")) return null;
  const raw = url.slice(5);
  if (raw.startsWith("/")) return raw;
  return path.resolve(process.cwd(), raw);
}

async function ensureSchema(): Promise<void> {
  const file = dbFilePath();
  if (file) {
    const dir = path.dirname(file);
    await fs.mkdir(dir, { recursive: true });
  }

  // SQLite 表是否已建成的最简检查：能不能 SELECT name FROM sqlite_master
  try {
    await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='User' LIMIT 1`,
    );
    const rows = (await prisma.$queryRawUnsafe(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='User'`,
    )) as Array<{ name: string }>;
    if (rows.length > 0) return; // schema 已存在
  } catch {
    // 库尚未建表
  }

  await runSchemaSql();
}

/**
 * 直接用 prisma.$executeRawUnsafe 创建所有表 —— 与 prisma/schema.prisma 保持同构。
 * 这样无需在 Vercel build 阶段跑 prisma migrate。
 */
async function runSchemaSql(): Promise<void> {
  const ddl: string[] = [
    `CREATE TABLE IF NOT EXISTS "User" (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      displayName TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'OWNER',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Agent" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      avatarUrl TEXT,
      ownerId TEXT NOT NULL REFERENCES "User"(id),
      riskTier TEXT NOT NULL DEFAULT 'L2',
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "Passport" (
      id TEXT PRIMARY KEY,
      agentId TEXT NOT NULL REFERENCES "Agent"(id),
      parentId TEXT REFERENCES "Passport"(id),
      jwt TEXT NOT NULL,
      capabilities TEXT NOT NULL,
      constraints TEXT NOT NULL,
      dataClearance TEXT NOT NULL,
      riskTier TEXT NOT NULL DEFAULT 'L2',
      delegationDepth INTEGER NOT NULL DEFAULT 0,
      delegationMax INTEGER NOT NULL DEFAULT 2,
      status TEXT NOT NULL DEFAULT 'ACTIVE',
      issuedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expiresAt DATETIME NOT NULL
    )`,
    `CREATE TABLE IF NOT EXISTS "Tool" (
      id TEXT PRIMARY KEY,
      category TEXT NOT NULL,
      displayName TEXT NOT NULL,
      description TEXT,
      riskTier TEXT NOT NULL DEFAULT 'L1',
      schemaJson TEXT NOT NULL,
      sensitiveFields TEXT NOT NULL DEFAULT '[]'
    )`,
    `CREATE TABLE IF NOT EXISTS "Policy" (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      enabled BOOLEAN NOT NULL DEFAULT 1,
      priority INTEGER NOT NULL DEFAULT 100,
      rule TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "AuditEvent" (
      id TEXT PRIMARY KEY,
      passportId TEXT NOT NULL REFERENCES "Passport"(id),
      toolId TEXT REFERENCES "Tool"(id),
      phase TEXT NOT NULL,
      decision TEXT NOT NULL,
      policyHits TEXT NOT NULL DEFAULT '[]',
      argsRaw TEXT,
      argsMasked TEXT,
      responseRaw TEXT,
      responseMasked TEXT,
      latencyMs INTEGER,
      riskScore REAL,
      parentEventId TEXT,
      note TEXT,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "ApprovalRequest" (
      id TEXT PRIMARY KEY,
      passportId TEXT NOT NULL REFERENCES "Passport"(id),
      triggerEventId TEXT NOT NULL,
      approverId TEXT NOT NULL REFERENCES "User"(id),
      reason TEXT NOT NULL,
      payloadDigest TEXT NOT NULL,
      argsSnapshot TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'PENDING',
      expiresAt DATETIME NOT NULL,
      decidedAt DATETIME,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "DelegationLink" (
      id TEXT PRIMARY KEY,
      parentPassportId TEXT NOT NULL REFERENCES "Passport"(id),
      childPassportId TEXT NOT NULL REFERENCES "Passport"(id),
      derivedScope TEXT NOT NULL,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "RevocationRecord" (
      passportId TEXT PRIMARY KEY REFERENCES "Passport"(id),
      reason TEXT NOT NULL,
      operatorId TEXT NOT NULL,
      revokedAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
    `CREATE TABLE IF NOT EXISTS "RiskAlert" (
      id TEXT PRIMARY KEY,
      passportId TEXT NOT NULL REFERENCES "Passport"(id),
      rule TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'WARN',
      evidence TEXT NOT NULL,
      acknowledged BOOLEAN NOT NULL DEFAULT 0,
      createdAt DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
    )`,
  ];
  for (const stmt of ddl) {
    await prisma.$executeRawUnsafe(stmt);
  }
}

async function ensureSeedData(): Promise<void> {
  const userCount = await prisma.user.count();
  if (userCount > 0) return;

  await prisma.user.createMany({
    data: [
      { id: "user:li.ming", email: "li.ming@corp", displayName: "小李 (Holder)", role: "OWNER" },
      { id: "user:admin", email: "admin@corp", displayName: "管理员", role: "ADMIN" },
    ],
  });

  await prisma.agent.createMany({
    data: [
      {
        id: "agent:aria-7f3a",
        name: "Aria · 行政助理",
        description: "面向员工小李的个人 AI 行政助理，处理日历/邮件/报销等事务。",
        avatarUrl: "/avatars/aria.svg",
        ownerId: "user:li.ming",
        riskTier: "L2",
        status: "ACTIVE",
      },
      {
        id: "agent:travel-sub-2c1e",
        name: "Travel · 差旅子 Agent",
        description: "由 Aria 派生委托的差旅订票子 Agent。",
        avatarUrl: "/avatars/travel.svg",
        ownerId: "user:li.ming",
        riskTier: "L2",
        status: "ACTIVE",
      },
    ],
  });

  await prisma.tool.createMany({
    data: [
      { id: "calendar.create_event", category: "calendar", displayName: "创建日历事件", description: "在持有人日历上创建会议 / 提醒。", riskTier: "L1", schemaJson: "{}", sensitiveFields: "[]" },
      { id: "calendar.list_events", category: "calendar", displayName: "查询日历事件", riskTier: "L1", schemaJson: "{}", sensitiveFields: "[]" },
      { id: "email.draft", category: "email", displayName: "起草邮件", riskTier: "L2", schemaJson: "{}", sensitiveFields: "[]" },
      { id: "expense.submit", category: "expense", displayName: "提交报销", description: "向报销系统提交差旅 / 业务费用单。", riskTier: "L2", schemaJson: "{}", sensitiveFields: "[]" },
      { id: "crm.list_customers", category: "crm", displayName: "查询客户名单", description: "返回客户字段含手机号 / 身份证 / 邮箱（PII）。", riskTier: "L2", schemaJson: "{}", sensitiveFields: "[]" },
      { id: "hr.query_salary", category: "hr", displayName: "查询员工薪资", description: "敏感工具：未授权 Agent 不应调用。", riskTier: "L3", schemaJson: "{}", sensitiveFields: '["salary"]' },
      { id: "flight.book", category: "travel", displayName: "预订机票", riskTier: "L2", schemaJson: "{}", sensitiveFields: "[]" },
    ],
  });

  await prisma.policy.createMany({
    data: [
      {
        id: "policy:expense-stepup",
        name: "高额报销需二次确认",
        description: "expense.submit 单笔金额 > 500 触发 STEP_UP",
        enabled: true,
        priority: 10,
        rule: JSON.stringify({
          match: { tool: "expense.submit", "args.amount": { $gt: 500 } },
          decide: "STEP_UP",
          reason: "单笔报销超过 500 元，需持有人二次确认",
        }),
      },
      {
        id: "policy:hr-deny",
        name: "HR 系统默认拒绝",
        description: "hr.* 工具非授权情况下一律拒绝",
        enabled: true,
        priority: 20,
        rule: JSON.stringify({
          match: { tool: "hr.*" },
          decide: "DENY",
          reason: "HR 系统访问需要专门授权",
        }),
      },
      {
        id: "policy:flight-stepup",
        name: "高价机票需二次确认",
        description: "flight.book 金额 > 5000 触发 STEP_UP",
        enabled: true,
        priority: 30,
        rule: JSON.stringify({
          match: { tool: "flight.book", "args.amount": { $gt: 5000 } },
          decide: "STEP_UP",
          reason: "高价机票需二次确认",
        }),
      },
      {
        id: "policy:default-allow",
        name: "默认允许",
        description: "前置策略未拒绝时的兜底允许",
        enabled: true,
        priority: 1000,
        rule: JSON.stringify({
          match: {},
          decide: "ALLOW",
          reason: "默认允许（已通过能力匹配与约束校验）",
        }),
      },
    ],
  });
}

/**
 * 完全重置：清空所有表 + 重新写 seed。用于 /api/admin/reset。
 * 注意：这会清空 Passport / 审计 / 告警等所有运行时数据。
 */
export async function resetAllData(): Promise<void> {
  // 顺序：先删依赖表
  await prisma.$transaction([
    prisma.riskAlert.deleteMany({}),
    prisma.approvalRequest.deleteMany({}),
    prisma.delegationLink.deleteMany({}),
    prisma.revocationRecord.deleteMany({}),
    prisma.auditEvent.deleteMany({}),
    prisma.passport.deleteMany({}),
    prisma.policy.deleteMany({}),
    prisma.tool.deleteMany({}),
    prisma.agent.deleteMany({}),
    prisma.user.deleteMany({}),
  ]);

  bootstrapPromise = null;
  await ensureBootstrapped();
}
