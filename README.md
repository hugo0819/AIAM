# AI Agent Passport · 为 AI 发通行证

> 一张可签发、可验证、可吊销、最小权限、全程留痕的数字通行证，让每一次 AI Agent 行动都可控、可审、可追责。

[![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://www.prisma.io/)
[![License](https://img.shields.io/badge/License-MIT-green)](#license)

---

## 目录

- [项目定位](#-项目定位)
- [核心创新点](#-核心创新点不是又一个-oauth)
- [系统架构](#-系统架构)
- [七个 Demo 场景](#-七个-demo-场景5-分钟故事线)
- [快速开始](#-快速开始)
- [使用说明](#-使用说明)
- [API 概览](#-api-概览)
- [数据模型](#-数据模型)
- [部署到 Vercel](#-部署到-vercel)
- [一键重置](#-一键重置)
- [目录结构](#-目录结构)
- [技术栈](#-技术栈)
- [License](#-license)

---

## ✦ 项目定位

面向 AI Agent 落地中的**身份治理**与**安全管控**问题，构建集六大能力于一身的一体化原型：

- **签发**（Issuance）：为每个 Agent 颁发结构化能力令牌（Capability Token）
- **鉴权**（Authorization）：统一网关在运行时验签 + 策略评估
- **脱敏**（Data Masking）：数据平面双向 PII 识别与打码
- **审批**（JIT Elevation）：高风险动作触发人在回路
- **审计**（Audit）：端到端调用链与信任图谱
- **生命周期**（Lifecycle）：签发 → 派生 → 吊销 → 级联失效

## ✦ 核心创新点（不是又一个 OAuth）

| # | 锚点 | 一句话 |
|---|---|---|
| C1 | **能力令牌 Capability Token** | 工具白名单 + 数据域 + 调用配额 + 风险等级的结构化签名声明，ES256 签名的 JWT |
| C2 | **数据平面管控 Data-Plane DLP** | 网关不止拦请求，还拦数据：出入参 PII 自动脱敏，避免「权限过了但数据漏了」 |
| C3 | **即时风险升级 JIT Elevation** | 高风险动作当场二次确认（人在回路），告别「预先给足所有权限」的粗放模式 |
| C4 | **信任链路可视化 Trust Graph** | User → Agent → Sub-Agent → Tool → Data，端到端实时绘图，责任归属一眼明了 |

## ✦ 系统架构

```
┌─────────────────────────────────────────────────────────────────┐
│                      Control Plane（控制平面）                    │
│  ┌────────────┐  ┌──────────────┐  ┌──────────────────────────┐ │
│  │  Issuer    │  │  Policy DSL  │  │  Risk Rules Engine       │ │
│  │ ES256 JWT  │  │  ALLOW/DENY  │  │ off-hours / repeated-deny│ │
│  │ derive     │  │  STEP_UP     │  │ approval-rejected        │ │
│  └────────────┘  └──────────────┘  └──────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                   Data Plane Gateway（数据平面网关）              │
│   1.Verify → 2.State → 3.Capability → 4.Constraint → 5.Rate    │
│   → 6.Policy → 7.DLP(in) → 8.Execute → 9.DLP(out) → 10.Audit   │
└─────────────────────────────────────────────────────────────────┘
       │                              │                    │
       ▼                              ▼                    ▼
┌──────────────┐             ┌────────────────┐   ┌──────────────┐
│ Mock Agents  │             │  Mock Tools    │   │ Audit + SSE  │
│ Aria / Sub   │             │ calendar/email │   │ Trust Graph  │
│              │             │ expense/crm/hr │   │ Risk Alerts  │
└──────────────┘             └────────────────┘   └──────────────┘
```

**网关 10 步流水线**（核心）：每一步都产出一条可追溯的 AuditEvent，前端时间线据此实时滚动。

## ✦ 七个 Demo 场景

| 代号 | 标题 | 锚点 | 关键演示点 |
|---|---|---|---|
| **S1** | 为 AI 助理 Aria 签发通行证 | C1 | 签发表单 + 翻转的真实护照卡片 |
| **S2** | 正常路径：约一个会议 | 基础 | 6 步审计事件实时滚动 |
| **S3** | 数据自动脱敏：手机号 / 身份证 | C2 | 出参 `13812341234` → `138****1234` 对比 |
| **S4** | 越权拦截：访问 HR 系统 | 基础 | `capability_missing` 毫秒拒绝 |
| **S5** | 即时升级：600 元报销需二次确认 | C3 | 副屏弹窗 + 主流程阻塞恢复 |
| **S6** | 委托链：派生差旅子 Agent 订机票 | C4 | 信任图谱实时绘制三层委托 |
| **S7** | 异常告警 + 一键吊销 | 生命周期 | 凌晨规则告警 + 级联吊销 |

---

## ✦ 快速开始

环境要求：**Node.js ≥ 20.18**、npm ≥ 10。

```bash
# 1. 克隆 + 安装依赖
git clone <repo-url> ai-agent-passport
cd ai-agent-passport
npm install

# 2. 准备环境变量
cp .env.example .env

# 3. 初始化数据库（建表 + 写 seed）
npm run db:reset

# 4. 启动开发服务器
npm run dev
```

打开浏览器访问 [http://localhost:3000](http://localhost:3000)，点首页右下角「**从 S1 开始演示**」，按 S1 → S7 顺序播放剧本即可看完整功能。

> ⚠️ **演示前先点击首页右上角「重置环境」按钮**，确保从干净状态开始。

### npm scripts 速查

| 命令 | 用途 |
|---|---|
| `npm run dev` | 开发模式启动（http://localhost:3000） |
| `npm run build` | 生产构建 |
| `npm run start` | 启动生产服务器 |
| `npm run lint` | ESLint 检查 |
| `npm run db:push` | 把 prisma schema 同步到数据库 |
| `npm run db:seed` | 写入示例数据（2 用户 + 2 Agent + 7 工具 + 4 策略） |
| `npm run db:reset` | 删库 + 重建 + seed（演示前推荐） |
| `npm run keys:gen` | 重新生成 ES256 密钥对（一般无需手动调用） |

---

## ✦ 使用说明

### 1. 控制台四个 Tab

访问 `/console/passports`，左侧导航有四个面板：

| Tab | 功能 |
|---|---|
| **通行证 Passports** | 签发新通行证、查看通行证卡片（正反面翻转）、查看 JWT、挂起 / 恢复 / 吊销（级联派生） |
| **策略 Policies** | 查看 4 条预置策略：高额报销 STEP_UP、HR 系统默认拒绝、高价机票 STEP_UP、默认允许 |
| **审计与图谱 Audit** | 实时事件时间线（SSE 推送）+ 信任图谱（React Flow）双视图 |
| **风险中心 Risk** | 告警卡片 + 严重级筛选 + 一键吊销 + 确认 |

### 2. 演示舞台 Stage

访问 `/stage` 看 7 个场景卡片，点任一进入单场景页面。每个场景：

- 顶部展示当前活跃通行证 + 派生通行证状态徽标
- 主体是步骤化剧本（每步带 kind / expect / highlight 标签）
- 点「**播放剧本**」按顺序自动执行：调用真实 API、实时展示决策结果
- 步骤可单独失败重试，或点「重置」清空状态

剧本之间通过 `localStorage` 共享通行证，因此**建议从 S1 顺序播放到 S7**。

### 3. JIT 审批流（重点）

S5 场景会触发 STEP_UP 审批：

1. 主屏调用网关，因策略命中 STEP_UP 而**真正阻塞**
2. ScenarioRunner 检测到 PENDING 后自动**弹出新窗口**模拟手机推送
3. 在弹窗中点「**批准**」（或拒绝）
4. 主屏的 invoke 调用立即恢复，继续走 DLP → 工具执行 → 审计落库
5. 时间线上能看到 `STEP_UP → ALLOW(JIT 审批通过) → MASKED → EXECUTED` 的完整链路

> 💡 浏览器需允许弹窗。如果被拦截，可手动访问 `/approve/{approvalRequestId}`（id 在审计流里）。

### 4. 信任图谱

访问 `/console/audit` → 「信任图谱」Tab，可看到：

- **蓝色节点** User · 持有人
- **紫色节点** Agent / Sub-Agent
- **青色节点** Passport（含派生）
- **绿色节点** 被实际调用过的 Tool
- **边的种类**：`owns`（用户拥有 Agent）/ `holds`（Agent 持有通行证）/ `derives`（派生关系，加粗紫色）/ `invokes × N`（调用关系，绿色动画）

S6 场景跑完后，可看到完整的三层委托链可视化。

### 5. 风险中心

访问 `/console/risk`，可看到：

- 顶部统计卡：CRITICAL / WARN / INFO 各级别未确认数
- 告警列表按 severity 着色
- 每条告警两个操作：「**一键吊销**」（带二次确认 + 级联派生）和「**确认**」
- SSE 实时推送新告警，侧边栏菜单上有红色徽标提醒

---

## ✦ API 概览

共 **20 个 RESTful API + 3 个 SSE 流**：

### 通行证管理
- `GET /api/passports` — 列出全部通行证
- `POST /api/passports` — 签发新通行证
- `GET /api/passports/:id` — 通行证详情（含 verify + state 双诊断）
- `PATCH /api/passports/:id` — 挂起 / 恢复（`{ action: "suspend" | "resume" }`）
- `POST /api/passports/:id/revoke` — 吊销（默认级联派生）
- `POST /api/passports/:id/derive` — 派生子通行证（subset 校验）

### 网关
- `POST /api/gateway/invoke` — **唯一**工具调用入口，10 步流水线

### 审计
- `GET /api/audit?limit=&passportId=` — 历史事件查询
- `GET /api/audit/stream` — SSE 实时事件流
- `GET /api/audit/graph` — 信任图谱数据（节点 + 边）

### 审批
- `GET /api/approvals?status=PENDING` — 待审批列表
- `GET /api/approvals/:id` — 审批详情
- `POST /api/approvals/:id` — 决策（`{ action: "approve" | "reject" }`）
- `GET /api/approvals/stream` — SSE 实时审批推送

### 风险
- `GET /api/risk?severity=&acknowledged=` — 告警查询
- `PATCH /api/risk/:id` — 确认告警
- `GET /api/risk/stream` — SSE 实时告警推送

### 元数据
- `GET /api/agents` — Agent 列表
- `GET /api/tools` — 工具注册表
- `GET /api/policies` — 策略列表

### 管理
- `POST /api/admin/reset` — 一键重置环境

---

## ✦ 数据模型

10 个核心实体（基于 Prisma + SQLite）：

| 实体 | 关键字段 | 用途 |
|---|---|---|
| `User` | id / email / role | 持有人与管理员 |
| `Agent` | id / ownerId / riskTier / status | 智能体注册表 |
| `Passport` | id(=jti) / agentId / parentId / jwt / capabilities / constraints / status / expiresAt | 通行证主体，含派生父子关系 |
| `Tool` | id / category / riskTier / sensitiveFields | Mock 工具注册表 |
| `Policy` | id / priority / rule(JSON DSL) | 策略规则（ALLOW/DENY/STEP_UP） |
| `AuditEvent` | passportId / phase / decision / argsRaw vs argsMasked / latencyMs | 10 步流水线的每个事件 |
| `ApprovalRequest` | passportId / status / payloadDigest / expiresAt | JIT 审批请求 |
| `DelegationLink` | parentId / childId / derivedScope | 派生关系记录 |
| `RevocationRecord` | passportId / reason / operatorId | 吊销记录 |
| `RiskAlert` | passportId / rule / severity / evidence(去重 hits) | 风险告警 |

详细 schema 见 [`prisma/schema.prisma`](prisma/schema.prisma)。

---

## ✦ 部署到 Vercel

项目已适配 Vercel 的只读文件系统：DB 与密钥都自动落到 `/tmp`，**首次请求自动 bootstrap**（建表 + 写 seed）。

```bash
# 1. 推到 GitHub
git push origin main

# 2. 在 Vercel.com 上 Import 这个 repo（Build Command 已写在 vercel.json）

# 3. 部署完成后访问首页，首请求 ≈ 2-3s 完成 bootstrap，后续秒级
```

注意事项：

- 默认环境变量 `DATABASE_URL=file:/tmp/dev.db` 已写在 `vercel.json` 里
- `/tmp` 不跨 Lambda 实例共享。同实例热请求保持状态，冷启动会重新 bootstrap
- SSE 流（`/api/*/stream`）的 `maxDuration` 已配为 300s，超时后浏览器自动重连
- 想要持久化数据库可换 [Turso](https://turso.tech)：把 `DATABASE_URL` 改为 `libsql://...` 并改 Prisma provider

---

## ✦ 一键重置

| 方式 | 何时用 |
|---|---|
| 首页右上角「重置环境」按钮 | 演示前 / 演示中翻车 |
| `curl -X POST http://localhost:3000/api/admin/reset` | 自动化脚本 |
| `npm run db:reset` | 本地开发，从零开始（删 DB 文件） |

重置会：
1. 清空所有运行时数据（通行证 / 审计 / 告警 / 审批 / 派生 / 吊销）
2. 重新写入 seed（保留 2 用户 + 2 Agent + 7 工具 + 4 策略）
3. 清空内存吊销名单
4. 不动密钥（已签发的 JWT 仍可验签，但因 jti 不在新 DB 中会被识别为 not_found）

---

## ✦ 目录结构

```
src/
├── app/                      # 路由与 API
│   ├── page.tsx              # 首页
│   ├── console/              # 控制台四个 Tab
│   │   ├── passports/
│   │   ├── policies/
│   │   ├── audit/
│   │   └── risk/
│   ├── stage/                # 演示舞台
│   ├── approve/[reqId]/      # JIT 审批弹窗
│   └── api/                  # 23 个 API 路由
│       ├── admin/reset/
│       ├── agents/
│       ├── approvals/
│       ├── audit/
│       ├── gateway/invoke/
│       ├── passports/
│       ├── policies/
│       ├── risk/
│       └── tools/
├── components/
│   ├── ui/                   # shadcn 风格基础组件（Button/Card/Sheet/Tabs/...）
│   ├── common/               # PageHeader / EmptyState / ResetEnvButton
│   ├── nav/ConsoleNav.tsx
│   ├── passport/             # PassportCard / PassportForm / PassportDetail / ...
│   ├── audit/                # EventTimeline / TrustGraph
│   ├── risk/AlertCard.tsx
│   └── stage/ScenarioRunner.tsx
├── lib/                      # ★ 业务核心
│   ├── prisma.ts             # Prisma 单例 + Proxy 自动 bootstrap
│   ├── bootstrap.ts          # DDL 注入 + seed 自动化
│   ├── eventBus.ts           # 进程内 SSE 事件总线
│   ├── issuer/               # 签发：keys / sign / derive / revoke
│   ├── verifier/             # 验签：verify / stateCheck / revocationCache
│   ├── policy/               # 策略：engine / matcher / constraintCheck / rateLimiter
│   ├── dlp/                  # DLP：rules / detector / masker
│   ├── approval/             # JIT：manager / waiter
│   ├── risk/                 # 风险：rules / monitor / alerter
│   ├── audit/                # 审计：logger / chain
│   └── gateway/pipeline.ts   # ★ 10 步网关编排（项目心脏）
├── mock/
│   ├── scenarios.ts          # 7 个场景剧本
│   └── tools/index.ts        # 7 个 Mock 工具实现
├── stores/                   # Zustand：auditStore / approvalStore / riskStore / demoStore
└── types/                    # 共享 TS 类型
prisma/
├── schema.prisma             # 数据模型定义
└── seed.ts                   # 备用本地 seed 脚本
```

---

## ✦ 技术栈

| 层 | 技术 |
|---|---|
| 框架 | **Next.js 14**（App Router） |
| 语言 | **TypeScript 5** |
| UI | **Tailwind CSS** + 自写 shadcn 风格组件（基于 Radix UI） |
| 动效 | **Framer Motion** |
| 图表 | **React Flow**（信任图谱） + **Recharts** |
| ORM | **Prisma 6** |
| 数据库 | **SQLite**（开发 / Vercel 演示）·可换 Turso/Postgres |
| 鉴权 | **jose** ES256 JWT |
| 实时 | **Server-Sent Events**（进程内 EventEmitter） |
| 状态 | **Zustand**（客户端） |

---

## ✦ License

MIT
