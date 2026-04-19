import { nanoid } from "nanoid";

export interface ToolContext {
  agentId: string;
  passportId: string;
}

export type ToolArgs = Record<string, unknown>;
export type ToolResponse = Record<string, unknown>;

export type ToolImpl = (args: ToolArgs, ctx: ToolContext) => Promise<ToolResponse>;

// ─── calendar ────────────────────────────────────────────────────────────

const calendar_list_events: ToolImpl = async (args) => {
  const date = (args.date as string) ?? "2026-04-20";
  return {
    date,
    events: [
      { id: "evt-1", title: "晨会", start: `${date}T09:30:00+08:00`, end: `${date}T10:00:00+08:00` },
      { id: "evt-2", title: "客户对齐", start: `${date}T11:00:00+08:00`, end: `${date}T12:00:00+08:00` },
    ],
    emptySlots: [
      { start: `${date}T14:00:00+08:00`, end: `${date}T17:00:00+08:00` },
    ],
  };
};

const calendar_create_event: ToolImpl = async (args) => {
  return {
    id: "evt-" + nanoid(6),
    title: args.title,
    start: args.start,
    end: args.end,
    invitees: args.invitees ?? [],
    status: "CONFIRMED",
  };
};

// ─── email ───────────────────────────────────────────────────────────────

const email_draft: ToolImpl = async (args) => {
  return {
    id: "draft-" + nanoid(6),
    to: args.to,
    subject: args.subject,
    body: args.body,
    preview: String(args.body ?? "").slice(0, 120),
    status: "DRAFTED",
  };
};

// ─── expense ─────────────────────────────────────────────────────────────

const expense_submit: ToolImpl = async (args) => {
  return {
    id: "exp-" + nanoid(6),
    amount: args.amount,
    currency: args.currency ?? "CNY",
    category: args.category,
    note: args.note,
    status: "SUBMITTED",
    submittedAt: new Date().toISOString(),
  };
};

// ─── crm（含 PII 的出参，供 DLP 演示） ───────────────────────────────────

const crm_list_customers: ToolImpl = async (args) => {
  const limit = Number(args.limit ?? 3);
  const base = [
    {
      id: "c-001",
      name: "王总",
      phone: "13812341234",
      idCard: "330102199001010012",
      email: "wang@example.com",
      segment: args.segment ?? "vip",
    },
    {
      id: "c-002",
      name: "赵女士",
      phone: "13988887777",
      idCard: "11010519850206005X",
      email: "zhao@example.com",
      segment: args.segment ?? "vip",
    },
    {
      id: "c-003",
      name: "孙先生",
      phone: "13700001111",
      idCard: "440308197802260013",
      email: "sun@example.com",
      segment: args.segment ?? "vip",
    },
  ];
  return { customers: base.slice(0, limit) };
};

// ─── hr（默认被策略拒绝） ────────────────────────────────────────────────

const hr_query_salary: ToolImpl = async (args) => {
  return {
    employeeId: args.employeeId,
    baseSalary: 32000,
    bonus: 8000,
    currency: "CNY",
  };
};

// ─── travel ──────────────────────────────────────────────────────────────

const flight_book: ToolImpl = async (args) => {
  return {
    pnr: "PNR-" + nanoid(6).toUpperCase(),
    from: args.from,
    to: args.to,
    date: args.date,
    returnDate: args.returnDate,
    amount: args.amount,
    status: "BOOKED",
  };
};

// ─── registry ────────────────────────────────────────────────────────────

export const TOOL_REGISTRY: Record<string, ToolImpl> = {
  "calendar.list_events": calendar_list_events,
  "calendar.create_event": calendar_create_event,
  "email.draft": email_draft,
  "expense.submit": expense_submit,
  "crm.list_customers": crm_list_customers,
  "hr.query_salary": hr_query_salary,
  "flight.book": flight_book,
};

export async function invokeTool(
  toolId: string,
  args: ToolArgs,
  ctx: ToolContext,
): Promise<ToolResponse> {
  const impl = TOOL_REGISTRY[toolId];
  if (!impl) throw new Error(`tool not implemented: ${toolId}`);
  const started = Date.now();
  const res = await impl(args, ctx);
  const elapsed = Date.now() - started;
  return { ...res, __elapsedMs: elapsed };
}
