"use client";

import { useEffect, useState } from "react";
import { Activity, RefreshCcw, Network, History } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { EventTimeline } from "@/components/audit/EventTimeline";
import { TrustGraph } from "@/components/audit/TrustGraph";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { useAuditStore } from "@/stores/auditStore";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

interface PassportOption {
  id: string;
  agent: { id: string; name: string };
  status: string;
}

export default function AuditPage() {
  const [passports, setPassports] = useState<PassportOption[]>([]);
  const [selected, setSelected] = useState<string>("all");
  const [graphKey, setGraphKey] = useState(0);
  const streaming = useAuditStore((s) => s.streaming);
  const events = useAuditStore((s) => s.events);

  useEffect(() => {
    fetch("/api/passports")
      .then((r) => r.json())
      .then((j) => setPassports(j.items ?? []));
  }, []);

  // 事件变化时刷新图谱（调用完就重画）
  useEffect(() => {
    const t = setTimeout(() => setGraphKey((k) => k + 1), 800);
    return () => clearTimeout(t);
  }, [events.length]);

  const filterPassportId = selected === "all" ? undefined : selected;
  const stats = {
    total: events.length,
    allow: events.filter((e) => e.decision === "ALLOW" || e.decision === "EXECUTED").length,
    deny: events.filter((e) => e.decision === "DENY").length,
    stepup: events.filter((e) => e.decision === "STEP_UP").length,
  };

  return (
    <>
      <PageHeader
        title="审计与信任图谱"
        description="实时滚动的工具调用事件 + 用户→Agent→Passport→Tool 的信任图谱。"
        actions={
          <div className="flex items-center gap-2">
            <Badge variant={streaming ? "success" : "secondary"} className="gap-1">
              <span
                className={`inline-block h-1.5 w-1.5 rounded-full ${streaming ? "bg-success animate-pulse" : "bg-muted-foreground"}`}
              />
              {streaming ? "SSE 实时" : "未连接"}
            </Badge>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setGraphKey((k) => k + 1)}
            >
              <RefreshCcw className="h-3.5 w-3.5" />
              重绘图谱
            </Button>
          </div>
        }
      />

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <StatCard label="事件总数" value={stats.total} tone="default" icon={<Activity className="h-4 w-4" />} />
        <StatCard label="允许 / 执行" value={stats.allow} tone="success" />
        <StatCard label="拒绝" value={stats.deny} tone="destructive" />
        <StatCard label="需审批" value={stats.stepup} tone="warning" />
      </div>

      <Tabs defaultValue="timeline">
        <TabsList>
          <TabsTrigger value="timeline">
            <History className="mr-1 h-3.5 w-3.5" />
            事件时间线
          </TabsTrigger>
          <TabsTrigger value="graph">
            <Network className="mr-1 h-3.5 w-3.5" />
            信任图谱
          </TabsTrigger>
        </TabsList>

        <TabsContent value="timeline">
          <div className="mb-4 flex items-center gap-3">
            <span className="text-sm text-muted-foreground">按通行证过滤：</span>
            <div className="w-80">
              <Select value={selected} onValueChange={setSelected}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">全部</SelectItem>
                  {passports.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.agent.name} · {p.id.slice(0, 6)}… · {p.status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <EventTimeline passportId={filterPassportId} limit={80} />
        </TabsContent>

        <TabsContent value="graph">
          <TrustGraph refreshKey={graphKey} />
          <div className="mt-3 flex flex-wrap gap-3 text-[10px] text-muted-foreground">
            <LegendDot color="hsl(217 91% 60%)" label="owns (User→Agent)" />
            <LegendDot color="hsl(199 89% 48%)" label="holds (Agent→Passport)" />
            <LegendDot color="hsl(262 83% 58%)" label="derives (派生链)" />
            <LegendDot color="hsl(142 76% 45%)" label="invokes (调用)" />
          </div>
        </TabsContent>
      </Tabs>
    </>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
}: {
  label: string;
  value: number;
  tone: "default" | "success" | "destructive" | "warning";
  icon?: React.ReactNode;
}) {
  const color =
    tone === "success"
      ? "text-success"
      : tone === "destructive"
        ? "text-destructive"
        : tone === "warning"
          ? "text-warning"
          : "text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-md bg-secondary ${color}`}>
          {icon ?? <Activity className="h-4 w-4" />}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-2xl font-semibold ${color}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function LegendDot({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1">
      <span className="inline-block h-2 w-6 rounded" style={{ background: color }} />
      <span>{label}</span>
    </div>
  );
}
