# AI Agent Passport · 为 AI 发通行证

> 字节跳动创新项目挑战赛《给 AI 发通行证，构建 Agent 身份与权限系统》参赛作品
>
> 一张可签发、可验证、可吊销、最小权限、全程留痕的数字通行证，让每一次 AI 行动都可控、可审、可追责。

---

## ✦ 项目定位

面向 AI Agent 落地中的**身份治理**与**安全管控**问题，构建一个集：

- **签发**（Issuance）：为每个 Agent 颁发结构化能力令牌（Capability Token）
- **鉴权**（Authorization）：统一网关在运行时验签 + 策略评估
- **脱敏**（Data Masking）：数据平面双向 PII 识别与打码
- **审批**（JIT Elevation）：高风险动作触发人在回路
- **审计**（Audit）：端到端调用链与信任图谱
- **生命周期**（Lifecycle）：签发 → 派生 → 吊销 → 级联失效

**一体化** 的 Demo 原型。

## ✦ 四个差异化锚点（不是又一个 OAuth）

| # | 锚点 | 一句话 |
|---|---|---|
| C1 | **能力令牌** | 工具白名单 + 数据域 + 调用配额 + 风险等级的结构化签名声明 |
| C2 | **数据平面管控** | 网关不止拦请求，还拦数据：出参 PII 自动脱敏 |
| C3 | **即时风险升级** | 高风险动作当场二次确认，告别「预先给足权限」的粗放模式 |
| C4 | **信任链路可视化** | 用户 → Agent → 子 Agent → 工具 → 数据，端到端图谱 |

## ✦ 七个 Demo 场景（5 分钟故事线）

| 代号 | 标题 | 锚点 |
|---|---|---|
| S1 | 为 AI 助理 Aria 签发通行证 | C1 |
| S2 | 正常路径：Aria 帮我约一个会议 | 基础 |
| S3 | 数据自动脱敏：手机号 / 身份证 | C2 |
| S4 | 越权拦截：尝试访问 HR 系统 | 基础 |
| S5 | 即时升级：600 元报销需二次确认 | C3 |
| S6 | 委托链：派生差旅子 Agent 订机票 | C4 |
| S7 | 异常告警 + 一键吊销 | 生命周期 |

详见 `src/mock/scenarios.ts`。

## ✦ 技术栈

- **Next.js 14** (App Router) + TypeScript + Tailwind CSS
- **shadcn-style UI** 自写（基于 Radix UI）
- **Prisma + SQLite** 存储
- **jose** ES256 JWT 签发/验证
- **React Flow** 信任图谱
- **Framer Motion** 动效
- **Server-Sent Events** 实时事件流

## ✦ 快速开始

```bash
npm install
npx prisma generate      # Day 2 开始需要
npx prisma db push       # Day 2 开始需要
npm run dev
# 访问 http://localhost:3000
```

## ✦ 目录结构（核心）

```
src/
├── app/                      # 路由与 API
│   ├── page.tsx              # 首页
│   ├── console/              # 控制台 4 Tab
│   │   ├── passports/        # ① 通行证
│   │   ├── policies/         # ② 策略
│   │   ├── audit/            # ③ 审计与图谱
│   │   └── risk/             # ④ 风险中心
│   └── stage/                # ⑤ 演示舞台
├── components/               # UI 组件（ui/ common/ nav/）
├── lib/                      # 业务核心（Day 2+ 实装）
│   ├── issuer/               # 签发
│   ├── verifier/             # 验签
│   ├── policy/               # 策略引擎
│   ├── dlp/                  # 数据脱敏
│   ├── audit/                # 审计
│   ├── risk/                 # 风险评分
│   ├── approval/             # JIT 审批
│   └── gateway/pipeline.ts   # ★ 网关编排（项目心脏）
├── mock/
│   ├── scenarios.ts          # ★ 7 个场景剧本
│   ├── tools/                # Mock 工具
│   └── agents/               # Aria 剧本执行器
├── types/                    # 共享类型
└── stores/                   # Zustand 客户端状态
prisma/
└── schema.prisma             # 全量数据模型
```

## ✦ 7 天排期

| Day | 产出 |
|---|---|
| 1 | **(当前)** 概念定稿 + 项目骨架 + 7 场景剧本 + UI 占位 |
| 2 | 通行证 JWT 签发验证 + PassportCard 视觉符号 |
| 3 | 网关 Pipeline + 策略引擎 + Mock 工具 |
| 4 | DLP 脱敏 + JIT 审批 + SSE 推送 |
| 5 | 派生通行证 + React Flow 信任图谱 + 审计时间线 |
| 6 | 风险告警 + 吊销链路 + 动效打磨 |
| 7 | PPT + 演示视频 + Vercel 部署 |

## ✦ 相关文档

- [参赛规划](../ai_agent_passport_参赛规划_40a9fc7d.plan.md) — 立意与排期
- [构建方案](../构建方案.md) — 数据模型、状态机、模块划分
- [演示脚本](./docs/demo-script.md) — 5 分钟逐字稿

---

**Concept Prototype · Not production code · Built for demo story integrity.**
