import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("⤷ seeding…");

  // ── Users ─────────────────────────────────────────────────────────────
  await prisma.user.upsert({
    where: { email: "li.ming@corp" },
    update: {},
    create: {
      id: "user:li.ming",
      email: "li.ming@corp",
      displayName: "小李 (Holder)",
      role: "OWNER",
    },
  });
  await prisma.user.upsert({
    where: { email: "admin@corp" },
    update: {},
    create: {
      id: "user:admin",
      email: "admin@corp",
      displayName: "管理员",
      role: "ADMIN",
    },
  });

  // ── Agents ────────────────────────────────────────────────────────────
  await prisma.agent.upsert({
    where: { id: "agent:aria-7f3a" },
    update: {},
    create: {
      id: "agent:aria-7f3a",
      name: "Aria · 行政助理",
      description: "面向员工小李的个人 AI 行政助理，处理日历/邮件/报销等事务。",
      avatarUrl: "/avatars/aria.svg",
      ownerId: "user:li.ming",
      riskTier: "L2",
      status: "ACTIVE",
    },
  });
  await prisma.agent.upsert({
    where: { id: "agent:travel-sub-2c1e" },
    update: {},
    create: {
      id: "agent:travel-sub-2c1e",
      name: "Travel · 差旅子 Agent",
      description: "由 Aria 派生委托的差旅订票子 Agent。",
      avatarUrl: "/avatars/travel.svg",
      ownerId: "user:li.ming",
      riskTier: "L2",
      status: "ACTIVE",
    },
  });

  // ── Tools ─────────────────────────────────────────────────────────────
  const tools = [
    {
      id: "calendar.create_event",
      category: "calendar",
      displayName: "创建日历事件",
      description: "在持有人日历上创建会议 / 提醒。",
      riskTier: "L1",
      schemaJson: JSON.stringify({
        type: "object",
        required: ["title", "start", "end"],
        properties: {
          title: { type: "string" },
          start: { type: "string", format: "date-time" },
          end: { type: "string", format: "date-time" },
          invitees: { type: "array", items: { type: "string" } },
        },
      }),
      sensitiveFields: "[]",
    },
    {
      id: "calendar.list_events",
      category: "calendar",
      displayName: "查询日历事件",
      riskTier: "L1",
      schemaJson: JSON.stringify({
        type: "object",
        properties: {
          date: { type: "string" },
          rangeStart: { type: "string" },
          rangeEnd: { type: "string" },
        },
      }),
      sensitiveFields: "[]",
    },
    {
      id: "email.draft",
      category: "email",
      displayName: "起草邮件",
      riskTier: "L2",
      schemaJson: JSON.stringify({
        type: "object",
        required: ["to", "subject", "body"],
        properties: {
          to: { type: "string" },
          subject: { type: "string" },
          body: { type: "string" },
        },
      }),
      sensitiveFields: '["to","body"]',
    },
    {
      id: "expense.submit",
      category: "expense",
      displayName: "提交报销",
      description: "向报销系统提交差旅 / 业务费用单。",
      riskTier: "L2",
      schemaJson: JSON.stringify({
        type: "object",
        required: ["amount", "currency", "category"],
        properties: {
          amount: { type: "number", minimum: 0 },
          currency: { type: "string", enum: ["CNY", "USD"] },
          category: { type: "string" },
          note: { type: "string" },
        },
      }),
      sensitiveFields: "[]",
    },
    {
      id: "crm.list_customers",
      category: "crm",
      displayName: "查询客户名单",
      description: "返回的客户字段包含手机号 / 身份证 / 邮箱（PII）。",
      riskTier: "L2",
      schemaJson: JSON.stringify({
        type: "object",
        properties: {
          segment: { type: "string" },
          limit: { type: "number" },
        },
      }),
      sensitiveFields: "[]",
    },
    {
      id: "hr.query_salary",
      category: "hr",
      displayName: "查询员工薪资",
      description: "敏感工具：未授权 Agent 不应调用。",
      riskTier: "L3",
      schemaJson: JSON.stringify({
        type: "object",
        required: ["employeeId"],
        properties: {
          employeeId: { type: "string" },
        },
      }),
      sensitiveFields: '["salary"]',
    },
    {
      id: "flight.book",
      category: "travel",
      displayName: "预订机票",
      riskTier: "L2",
      schemaJson: JSON.stringify({
        type: "object",
        required: ["from", "to", "date", "amount"],
        properties: {
          from: { type: "string" },
          to: { type: "string" },
          date: { type: "string" },
          returnDate: { type: "string" },
          amount: { type: "number" },
        },
      }),
      sensitiveFields: "[]",
    },
  ];
  for (const t of tools) {
    await prisma.tool.upsert({ where: { id: t.id }, update: {}, create: t });
  }

  // ── Policies ──────────────────────────────────────────────────────────
  const policies = [
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
      id: "policy:offhours-warn",
      name: "非工作时段访问需关注",
      description: "工作时间外的调用记入风险评分",
      enabled: true,
      priority: 50,
      rule: JSON.stringify({
        match: { "ctx.timeOfDay": { $in: ["night"] } },
        decide: "ALLOW",
        reason: "非工作时段访问，记入风险基线",
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
  ];
  for (const p of policies) {
    await prisma.policy.upsert({ where: { id: p.id }, update: {}, create: p });
  }

  console.log("✓ seed finished");
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
