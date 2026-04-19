"use client";

import { useEffect, useState } from "react";
import { Scale, CircleCheck, ShieldAlert, Ban } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import type { PolicyRecord } from "@/types/policy";

const DECISION_UI = {
  ALLOW: { variant: "success" as const, icon: <CircleCheck className="h-3 w-3" /> },
  DENY: { variant: "destructive" as const, icon: <Ban className="h-3 w-3" /> },
  STEP_UP: { variant: "warning" as const, icon: <ShieldAlert className="h-3 w-3" /> },
};

export default function PoliciesPage() {
  const [policies, setPolicies] = useState<PolicyRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/policies")
      .then((r) => r.json())
      .then((j) => setPolicies(j.items ?? []))
      .finally(() => setLoading(false));
  }, []);

  return (
    <>
      <PageHeader
        title="策略管理"
        description="按 priority 从低到高依次评估。第一条 DENY / STEP_UP 决定最终结果；全部允许则默认 ALLOW。"
      />

      {loading ? (
        <div className="py-20 text-center text-sm text-muted-foreground">加载中…</div>
      ) : policies.length === 0 ? (
        <EmptyState
          icon={<Scale className="h-10 w-10" />}
          title="暂无策略"
          description="执行 npm run db:seed 初始化 5 条示例策略。"
        />
      ) : (
        <div className="space-y-3">
          {policies.map((p) => {
            const dec = DECISION_UI[p.rule.decide];
            return (
              <Card key={p.id}>
                <CardContent className="flex items-start justify-between gap-6 p-5">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <Badge variant={dec.variant} className="gap-1 text-[10px]">
                        {dec.icon}
                        {p.rule.decide}
                      </Badge>
                      <span className="font-semibold">{p.name}</span>
                      <span className="text-xs text-muted-foreground">priority {p.priority}</span>
                      {!p.enabled && <Badge variant="secondary">disabled</Badge>}
                    </div>
                    {p.description && (
                      <p className="mt-1 text-xs text-muted-foreground">{p.description}</p>
                    )}
                    <div className="mt-3 grid gap-2 text-xs md:grid-cols-2">
                      <KVBlock label="match" value={p.rule.match} />
                      <KVBlock label="reason" value={p.rule.reason} />
                    </div>
                  </div>
                  <code className="shrink-0 font-mono text-[10px] text-muted-foreground">
                    {p.id}
                  </code>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </>
  );
}

function KVBlock({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="rounded-md border border-border bg-secondary/40 p-2">
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10.5px] text-foreground">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
