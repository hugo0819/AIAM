"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";
import type {
  Capability,
  DataClearance,
  PassportConstraints,
  RiskTier,
  ToolScope,
} from "@/types/passport";

interface AgentLite {
  id: string;
  name: string;
}
interface ToolLite {
  id: string;
  displayName: string;
  category: string;
  riskTier: string;
}

const CLEARANCE_OPTS: DataClearance[] = ["public", "internal", "confidential", "secret"];
const SCOPE_OPTS: ToolScope[] = ["read", "write", "invoke"];

interface PassportFormProps {
  onSubmitted?: (passportId: string) => void;
  onClose?: () => void;
}

export function PassportForm({ onSubmitted, onClose }: PassportFormProps) {
  const [agents, setAgents] = useState<AgentLite[]>([]);
  const [tools, setTools] = useState<ToolLite[]>([]);
  const [agentId, setAgentId] = useState<string>("");
  const [riskTier, setRiskTier] = useState<RiskTier>("L2");
  const [ttlHours, setTtlHours] = useState<number>(8);

  const [selectedTools, setSelectedTools] = useState<Set<string>>(new Set());
  const [scopes, setScopes] = useState<Record<string, ToolScope[]>>({});
  const [constraints, setConstraints] = useState<Record<string, { amountMax?: number }>>({});

  const [timeWindow, setTimeWindow] = useState("Mon-Fri 09:00-19:00 Asia/Shanghai");
  const [geo, setGeo] = useState("CN");
  const [rateLimitCount, setRateLimitCount] = useState(60);
  const [clearance, setClearance] = useState<Set<DataClearance>>(
    () => new Set<DataClearance>(["public", "internal"]),
  );
  const [delegationMax, setDelegationMax] = useState(2);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/agents").then((r) => r.json()),
      fetch("/api/tools").then((r) => r.json()),
    ]).then(([a, t]) => {
      setAgents(a.items);
      setTools(t.items);
      if (a.items.length && !agentId) setAgentId(a.items[0].id);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleTool = (id: string) => {
    setSelectedTools((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
        setScopes((s) => ({ ...s, [id]: s[id] ?? ["invoke"] }));
      }
      return next;
    });
  };

  const toggleScope = (toolId: string, scope: ToolScope) => {
    setScopes((prev) => {
      const cur = new Set(prev[toolId] ?? []);
      if (cur.has(scope)) cur.delete(scope);
      else cur.add(scope);
      return { ...prev, [toolId]: Array.from(cur) };
    });
  };

  const toggleClearance = (c: DataClearance) => {
    setClearance((prev) => {
      const next = new Set(prev);
      if (next.has(c)) next.delete(c);
      else next.add(c);
      return next;
    });
  };

  const capabilities = useMemo<Capability[]>(() => {
    return Array.from(selectedTools).map((toolId) => ({
      tool: toolId,
      scope: (scopes[toolId] ?? ["invoke"]) as ToolScope[],
      constraint: constraints[toolId],
    }));
  }, [selectedTools, scopes, constraints]);

  const handleSubmit = async () => {
    setError(null);
    setSubmitting(true);
    try {
      const body = {
        agentId,
        capabilities,
        constraints: {
          timeWindow: timeWindow.trim() || undefined,
          geo: geo.trim() ? geo.split(",").map((s) => s.trim()) : undefined,
          rateLimit: { count: rateLimitCount, per: "minute" as const },
        } satisfies PassportConstraints,
        dataClearance: Array.from(clearance),
        riskTier,
        ttlHours,
        delegationMax,
      };
      const res = await fetch("/api/passports", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "签发失败");
      onSubmitted?.(json.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "未知错误");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>签发新通行证</SheetTitle>
        <SheetDescription>
          为指定 Agent 配置能力、约束、风险等级和有效期，签名后产出一张可验签的 JWT。
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 flex-1 space-y-6 overflow-y-auto pr-1">
        <Section title="持有人 / Agent">
          <Select value={agentId} onValueChange={setAgentId}>
            <SelectTrigger>
              <SelectValue placeholder="选择 Agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}（{a.id}）
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Section>

        <Section title="能力清单（Capabilities）">
          <div className="space-y-2">
            {tools.map((tool) => {
              const checked = selectedTools.has(tool.id);
              return (
                <div
                  key={tool.id}
                  className="rounded-md border border-border bg-secondary/30 p-3"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Switch checked={checked} onCheckedChange={() => toggleTool(tool.id)} />
                      <div>
                        <div className="text-sm font-medium">{tool.displayName}</div>
                        <code className="font-mono text-[10px] text-muted-foreground">
                          {tool.id}
                        </code>
                      </div>
                    </div>
                    <Badge
                      variant={
                        tool.riskTier === "L3"
                          ? "destructive"
                          : tool.riskTier === "L2"
                            ? "warning"
                            : "secondary"
                      }
                    >
                      {tool.riskTier}
                    </Badge>
                  </div>

                  {checked && (
                    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
                      <span className="text-xs text-muted-foreground">scope:</span>
                      {SCOPE_OPTS.map((s) => {
                        const on = (scopes[tool.id] ?? []).includes(s);
                        return (
                          <button
                            key={s}
                            type="button"
                            onClick={() => toggleScope(tool.id, s)}
                            className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                              on
                                ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/40"
                                : "bg-background text-muted-foreground hover:bg-secondary"
                            }`}
                          >
                            {s}
                          </button>
                        );
                      })}

                      {tool.id === "expense.submit" && (
                        <div className="ml-auto flex items-center gap-1">
                          <span className="text-xs text-muted-foreground">amountMax</span>
                          <Input
                            type="number"
                            className="h-7 w-24 text-xs"
                            value={constraints[tool.id]?.amountMax ?? 500}
                            onChange={(e) =>
                              setConstraints((p) => ({
                                ...p,
                                [tool.id]: { amountMax: Number(e.target.value) },
                              }))
                            }
                          />
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>

        <Section title="全局约束（Constraints）">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>时间窗</Label>
              <Input
                value={timeWindow}
                onChange={(e) => setTimeWindow(e.target.value)}
                placeholder="Mon-Fri 09:00-19:00 Asia/Shanghai"
              />
            </div>
            <div>
              <Label>地理</Label>
              <Input value={geo} onChange={(e) => setGeo(e.target.value)} />
            </div>
            <div>
              <Label>速率限制（次/分钟）</Label>
              <Input
                type="number"
                value={rateLimitCount}
                onChange={(e) => setRateLimitCount(Number(e.target.value))}
              />
            </div>
            <div>
              <Label>派生层数上限</Label>
              <Input
                type="number"
                value={delegationMax}
                onChange={(e) => setDelegationMax(Number(e.target.value))}
              />
            </div>
          </div>
        </Section>

        <Section title="数据等级（Data Clearance）">
          <div className="flex flex-wrap gap-2">
            {CLEARANCE_OPTS.map((c) => {
              const on = clearance.has(c);
              return (
                <button
                  key={c}
                  type="button"
                  onClick={() => toggleClearance(c)}
                  className={`rounded-md border px-3 py-1 text-xs transition-colors ${
                    on
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : "border-border bg-secondary/40 text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c}
                </button>
              );
            })}
          </div>
        </Section>

        <Section title="风险等级 & 有效期">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Risk Tier</Label>
              <Select value={riskTier} onValueChange={(v) => setRiskTier(v as RiskTier)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="L1">L1 · 低风险</SelectItem>
                  <SelectItem value="L2">L2 · 中风险</SelectItem>
                  <SelectItem value="L3">L3 · 高风险</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>有效期（小时）</Label>
              <Input
                type="number"
                value={ttlHours}
                onChange={(e) => setTtlHours(Number(e.target.value))}
              />
            </div>
          </div>
        </Section>
      </div>

      {error && (
        <div className="my-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      )}

      <SheetFooter className="mt-4 gap-2">
        <Button variant="outline" onClick={onClose} disabled={submitting}>
          取消
        </Button>
        <Button onClick={handleSubmit} disabled={submitting || capabilities.length === 0}>
          {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitting ? "签发中…" : "签发通行证"}
        </Button>
      </SheetFooter>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <div className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>
      {children}
    </section>
  );
}
