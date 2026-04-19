/**
 * 7 个演示场景剧本 —— 项目的剧本中枢
 * 每个场景都是一个"可回放"的步骤序列，覆盖创新点 C1 / C2 / C3 / C4 + 生命周期。
 *
 * 场景映射（见 参赛规划 §三 Demo 故事线）：
 *   S1 签发通行证         -> C1
 *   S2 正常任务            -> 基础能力
 *   S3 数据自动脱敏        -> C2
 *   S4 越权拦截            -> 基础能力
 *   S5 JIT 二次确认        -> C3
 *   S6 委托链派生          -> C4
 *   S7 异常告警 + 吊销     -> 生命周期
 */

export type ScenarioTag = "C1" | "C2" | "C3" | "C4" | "lifecycle" | "basic";

export type ScenarioStepKind =
  | "narration" // 旁白说明
  | "issue" // 签发/派生通行证
  | "invoke" // 发起工具调用
  | "approve" // 出现 JIT 审批
  | "revoke" // 吊销通行证
  | "wait"; // 停顿制造节奏感

export interface ScenarioStep {
  kind: ScenarioStepKind;
  title: string;
  detail: string;
  // 当 kind=invoke/approve 时携带的载荷
  payload?: Record<string, unknown>;
  // 预期的决策结果（用于演示舞台动画提示）
  expect?: "ALLOW" | "DENY" | "STEP_UP" | "EXECUTED";
  // 本步骤高亮的创新锚点
  highlight?: ScenarioTag;
  delayMs?: number;
}

export interface Scenario {
  id: string;
  code: string; // S1 ~ S7
  title: string;
  subtitle: string;
  tags: ScenarioTag[];
  heroMetric: string; // 场景卡片上展示的一句核心卖点
  steps: ScenarioStep[];
}

export const SCENARIOS: Scenario[] = [
  // -----------------------------------------------------------------
  {
    id: "issue-aria-passport",
    code: "S1",
    title: "为 AI 助理 Aria 签发通行证",
    subtitle: "结构化能力 + 约束 + 风险等级，一张可验签的数字护照",
    tags: ["C1"],
    heroMetric: "能力令牌 · ES256 签名",
    steps: [
      {
        kind: "narration",
        title: "为什么需要通行证？",
        detail:
          "OAuth 是为人和应用设计的粗粒度 scope；Agent 行动非确定、会代行人、会调 Agent，需要更结构化的身份凭证。",
      },
      {
        kind: "issue",
        title: "签发 Passport",
        detail:
          "为 Aria 签发能力：日历读写 / 邮件起草 / 客户名单只读 / 报销提交（≤500 元软限） / 机票预订（≤5000 元，可派生）。时间窗 09:00-19:00，地域限 CN。",
        highlight: "C1",
        payload: {
          agentId: "agent:aria-7f3a",
          capabilities: [
            { tool: "calendar.*", scope: ["read", "write"] },
            { tool: "email.draft", scope: ["write"] },
            {
              tool: "expense.submit",
              scope: ["write"],
              constraint: { amountMax: 5000, currency: "CNY" },
            },
            { tool: "crm.list_customers", scope: ["read"] },
            {
              tool: "flight.book",
              scope: ["write"],
              constraint: { amountMax: 5000, currency: "CNY" },
            },
          ],
          constraints: {
            timeWindow: "Mon-Fri 09:00-19:00 Asia/Shanghai",
            rateLimit: { count: 60, per: "minute" },
            geo: ["CN"],
          },
          dataClearance: ["public", "internal"],
          riskTier: "L2",
          ttlHours: 8,
        },
        expect: "EXECUTED",
      },
      {
        kind: "narration",
        title: "签完就有一张可见的「通行证卡片」",
        detail: "卡片正面是身份信息，背面是能力清单。JWT 可以被任意工具网关验签。",
      },
    ],
  },

  // -----------------------------------------------------------------
  {
    id: "normal-schedule",
    code: "S2",
    title: "正常路径：Aria 帮我约一个会议",
    subtitle: "所有调用都被网关验签、策略评估、审计落库",
    tags: ["basic"],
    heroMetric: "10 步审计事件 / 毫秒级延迟",
    steps: [
      {
        kind: "invoke",
        title: "calendar.list_events",
        detail: "查看明天下午空档",
        payload: {
          tool: "calendar.list_events",
          args: { date: "2026-04-20", rangeStart: "14:00", rangeEnd: "18:00" },
        },
        expect: "EXECUTED",
      },
      {
        kind: "invoke",
        title: "calendar.create_event",
        detail: "创建会议「项目评审」15:00-16:00",
        payload: {
          tool: "calendar.create_event",
          args: {
            title: "项目评审",
            start: "2026-04-20T15:00:00+08:00",
            end: "2026-04-20T16:00:00+08:00",
            invitees: ["wang@corp", "zhao@corp"],
          },
        },
        expect: "EXECUTED",
      },
      {
        kind: "narration",
        title: "时间线上出现完整 10 步事件",
        detail: "从 RECEIVED 到 LOGGED，每一步都可点开看到当时的上下文。",
      },
    ],
  },

  // -----------------------------------------------------------------
  {
    id: "data-masking",
    code: "S3",
    title: "数据自动脱敏：出参中的手机号与身份证",
    subtitle: "权限过了但数据不能漏 —— 网关做的不是放行，是治理",
    tags: ["C2"],
    heroMetric: "PII 识别 · 入参 + 出参双向",
    steps: [
      {
        kind: "invoke",
        title: "email.draft —— 给客户发问候邮件",
        detail: "Aria 先拉客户名单，再起草邮件。",
        payload: {
          tool: "crm.list_customers",
          args: { segment: "vip", limit: 3 },
        },
        expect: "EXECUTED",
      },
      {
        kind: "narration",
        title: "对比脱敏前后",
        detail:
          "原始出参：13812341234 / 330102199001010012；脱敏后：138****1234 / 3301**********0012。LLM 拿到的永远是右边的版本。",
        highlight: "C2",
      },
      {
        kind: "invoke",
        title: "email.draft",
        detail: "使用脱敏后的联系方式起草邮件，不泄露原始 PII。",
        payload: {
          tool: "email.draft",
          args: {
            to: "vip@client.com",
            subject: "项目进展更新",
            body: "您好，关于 XXX 项目……",
          },
        },
        expect: "EXECUTED",
      },
    ],
  },

  // -----------------------------------------------------------------
  {
    id: "policy-deny",
    code: "S4",
    title: "越权拦截：尝试访问 HR 系统查询薪资",
    subtitle: "能力清单没有就是没有，审计留痕可追责",
    tags: ["basic"],
    heroMetric: "毫秒级拒绝 · 策略命中可视化",
    steps: [
      {
        kind: "invoke",
        title: "hr.query_salary",
        detail: "Aria 试图查询同事薪资（能力清单中不存在此工具）。",
        payload: {
          tool: "hr.query_salary",
          args: { employeeId: "E-1024" },
        },
        expect: "DENY",
      },
      {
        kind: "narration",
        title: "三道防线依次命中",
        detail:
          "① 能力匹配失败 → ② 策略引擎拒绝 → ③ 审计记录 DENY，并附命中的 Policy ID。",
      },
    ],
  },

  // -----------------------------------------------------------------
  {
    id: "jit-elevation",
    code: "S5",
    title: "即时升级：600 元报销需要二次确认",
    subtitle: "高风险动作不是预先给足权限，而是当场人工核准",
    tags: ["C3"],
    heroMetric: "人在回路 · 60 秒超时兜底",
    steps: [
      {
        kind: "invoke",
        title: "expense.submit",
        detail: "Aria 提交一笔 600 元差旅报销，超过通行证设定的 500 元上限。",
        payload: {
          tool: "expense.submit",
          args: {
            amount: 600,
            currency: "CNY",
            category: "差旅",
            note: "北京-上海高铁商务座",
          },
        },
        expect: "STEP_UP",
      },
      {
        kind: "approve",
        title: "持有人手机收到推送",
        detail:
          "模拟推送弹窗显示金额、类目、时间，持有人可「批准 / 拒绝」，60 秒不操作自动超时。",
        highlight: "C3",
      },
      {
        kind: "narration",
        title: "批准后主流程恢复",
        detail: "调用继续往下走 DLP → 工具执行 → 审计，事件上带「经人工核准」标记。",
      },
    ],
  },

  // -----------------------------------------------------------------
  {
    id: "delegation-chain",
    code: "S6",
    title: "委托链：Aria 派生差旅子 Agent 订机票",
    subtitle: "子 Agent 拿到的一定是父集子集，责任链端到端可追",
    tags: ["C4"],
    heroMetric: "信任图谱实时绘制 · 三层委托",
    steps: [
      {
        kind: "issue",
        title: "派生子通行证",
        detail:
          "Aria 为「差旅子 Agent」派生通行证，只授予 flight.book，amountMax=3000，单次授权。",
        highlight: "C4",
        payload: {
          parentPassport: "aria-passport",
          childAgentId: "agent:travel-sub-2c1e",
          capabilities: [
            {
              tool: "flight.book",
              scope: ["write"],
              constraint: { amountMax: 3000, currency: "CNY" },
            },
          ],
          delegationDepth: 1,
        },
        expect: "EXECUTED",
      },
      {
        kind: "invoke",
        title: "flight.book（由子 Agent 发起）",
        detail: "订一张北京→上海往返机票。",
        payload: {
          tool: "flight.book",
          args: {
            from: "PEK",
            to: "SHA",
            date: "2026-04-22",
            returnDate: "2026-04-24",
            amount: 2480,
          },
        },
        expect: "EXECUTED",
      },
      {
        kind: "narration",
        title: "信任图谱出现三层节点",
        detail:
          "User(小李) → Agent(Aria) → Sub-Agent(差旅) → Tool(flight.book)，调用链全程着色。",
      },
    ],
  },

  // -----------------------------------------------------------------
  {
    id: "anomaly-revoke",
    code: "S7",
    title: "异常告警 + 一键吊销",
    subtitle: "行为异常即时下线，吊销秒级全局生效",
    tags: ["lifecycle"],
    heroMetric: "吊销名单 · 内存 < 1ms 生效",
    steps: [
      {
        kind: "narration",
        title: "模拟凌晨 3 点 Aria 大量拉取客户数据",
        detail:
          "规则引擎会识别「非工作时段 + 高频读类工具」，超过阈值即 WARN 告警并推送到风险中心。",
      },
      {
        kind: "invoke",
        title: "03:00 · 拉客户 #1",
        detail: "Aria 在凌晨 3 点（模拟 ctx.hour=3）开始拉客户名单。",
        payload: {
          tool: "crm.list_customers",
          args: { segment: "vip", limit: 3 },
          ctxOverride: { hour: 3, timeOfDay: "night" },
        },
        expect: "EXECUTED",
        highlight: "lifecycle",
      },
      {
        kind: "invoke",
        title: "03:01 · 拉客户 #2",
        detail: "继续拉取……",
        payload: {
          tool: "crm.list_customers",
          args: { segment: "vip", limit: 5 },
          ctxOverride: { hour: 3, timeOfDay: "night" },
        },
        expect: "EXECUTED",
      },
      {
        kind: "invoke",
        title: "03:02 · 拉客户 #3（触发告警）",
        detail:
          "第三次调用同一类工具——规则命中 `off-hours-bulk-read` WARN，风险中心弹出告警。",
        payload: {
          tool: "crm.list_customers",
          args: { segment: "vip", limit: 10 },
          ctxOverride: { hour: 3, timeOfDay: "night" },
        },
        expect: "EXECUTED",
      },
      {
        kind: "wait",
        title: "等待告警落库",
        detail: "规则评估是 fire-and-forget，给它 1 秒时间写 DB。",
        delayMs: 1200,
      },
      {
        kind: "revoke",
        title: "一键吊销通行证",
        detail: "管理员从风险中心点「一键吊销」，所有派生通行证级联失效。",
      },
      {
        kind: "invoke",
        title: "下一次调用立即失败",
        detail: "Aria 再次发起调用被网关拒绝（invalid_token: revoked）。",
        payload: {
          tool: "calendar.list_events",
          args: { date: "2026-04-20" },
        },
        expect: "DENY",
      },
      {
        kind: "narration",
        title: "全链路闭环",
        detail: "签发 → 运行 → 脱敏 → 审批 → 派生 → 监控 → 吊销 —— AI Agent 的完整生命周期治理。",
      },
    ],
  },
];

export function getScenario(code: string): Scenario | undefined {
  return SCENARIOS.find((s) => s.code.toLowerCase() === code.toLowerCase());
}
