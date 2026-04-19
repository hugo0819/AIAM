"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence } from "framer-motion";
import { AlertTriangle, ShieldAlert, AlertOctagon, Activity } from "lucide-react";
import { PageHeader } from "@/components/common/PageHeader";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { AlertCard } from "@/components/risk/AlertCard";
import { useRiskStore, type EnrichedAlert } from "@/stores/riskStore";
import type { Severity } from "@/types/events";

const FILTERS: Array<{ key: "all" | Severity; label: string }> = [
  { key: "all", label: "全部" },
  { key: "CRITICAL", label: "CRITICAL" },
  { key: "WARN", label: "WARN" },
  { key: "INFO", label: "INFO" },
];

export default function RiskPage() {
  const alerts = useRiskStore((s) => s.alerts);
  const streaming = useRiskStore((s) => s.streaming);
  const setAlerts = useRiskStore((s) => s.setAlerts);
  const upsert = useRiskStore((s) => s.upsert);
  const markAck = useRiskStore((s) => s.markAck);
  const setStreaming = useRiskStore((s) => s.setStreaming);

  const [filter, setFilter] = useState<"all" | Severity>("all");
  const [hideAcknowledged, setHideAcknowledged] = useState(true);

  useEffect(() => {
    fetch("/api/risk?limit=80")
      .then((r) => r.json())
      .then((j) => setAlerts(j.items));
  }, [setAlerts]);

  useEffect(() => {
    const es = new EventSource("/api/risk/stream");
    setStreaming(true);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data);
        // SSE 推送不包含 agentName，需要补全（简单方案：直接重拉一次）
        upsert(data as EnrichedAlert);
        fetch("/api/risk?limit=80")
          .then((r) => r.json())
          .then((j) => setAlerts(j.items));
      } catch {
        /* ignore */
      }
    };
    es.onerror = () => setStreaming(false);
    return () => {
      setStreaming(false);
      es.close();
    };
  }, [upsert, setAlerts, setStreaming]);

  const filtered = useMemo(() => {
    return alerts.filter((a) => {
      if (filter !== "all" && a.severity !== filter) return false;
      if (hideAcknowledged && a.acknowledged) return false;
      return true;
    });
  }, [alerts, filter, hideAcknowledged]);

  const stats = useMemo(() => {
    return {
      total: alerts.length,
      critical: alerts.filter((a) => a.severity === "CRITICAL" && !a.acknowledged).length,
      warn: alerts.filter((a) => a.severity === "WARN" && !a.acknowledged).length,
      info: alerts.filter((a) => a.severity === "INFO" && !a.acknowledged).length,
    };
  }, [alerts]);

  const handleRevoke = async (passportId: string) => {
    const reason = window.prompt("吊销理由", "风险告警触发的紧急吊销") ?? "";
    if (!reason) return;
    await fetch(`/api/passports/${passportId}/revoke`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason, operatorId: "user:admin", cascade: true }),
    });
    // 重新拉一次告警列表（passportRevoked 字段会更新）
    fetch("/api/risk?limit=80")
      .then((r) => r.json())
      .then((j) => setAlerts(j.items));
  };

  const handleAck = async (id: string) => {
    markAck(id);
    await fetch(`/api/risk/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "acknowledge" }),
    });
  };

  return (
    <>
      <PageHeader
        title="风险中心"
        description="行为异常检测、告警聚合、一键吊销通行证（级联派生）。"
        actions={
          <Badge variant={streaming ? "success" : "secondary"} className="gap-1">
            <span
              className={`inline-block h-1.5 w-1.5 rounded-full ${
                streaming ? "bg-success animate-pulse" : "bg-muted-foreground"
              }`}
            />
            {streaming ? "SSE 实时" : "未连接"}
          </Badge>
        }
      />

      <div className="mb-6 grid gap-3 md:grid-cols-4">
        <StatCard
          label="告警总数"
          value={stats.total}
          tone="default"
          icon={<Activity className="h-4 w-4" />}
        />
        <StatCard
          label="CRITICAL"
          value={stats.critical}
          tone="destructive"
          icon={<AlertOctagon className="h-4 w-4" />}
        />
        <StatCard
          label="WARN"
          value={stats.warn}
          tone="warning"
          icon={<ShieldAlert className="h-4 w-4" />}
        />
        <StatCard
          label="INFO"
          value={stats.info}
          tone="info"
          icon={<AlertTriangle className="h-4 w-4" />}
        />
      </div>

      <div className="mb-5 flex flex-wrap items-center gap-3">
        <div className="flex gap-1 rounded-md bg-secondary/60 p-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={`rounded-sm px-3 py-1 text-sm transition ${
                filter === f.key
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        <Button
          variant={hideAcknowledged ? "default" : "outline"}
          size="sm"
          onClick={() => setHideAcknowledged(!hideAcknowledged)}
        >
          {hideAcknowledged ? "隐藏已确认" : "显示全部"}
        </Button>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<AlertTriangle className="h-10 w-10" />}
          title="当前没有待处理告警"
          description="到演示舞台运行 S7 场景（凌晨 3 点大量读类调用）触发一条 WARN。"
        />
      ) : (
        <div className="space-y-3">
          <AnimatePresence initial={false}>
            {filtered.map((a) => (
              <AlertCard key={a.id} alert={a} onRevoke={handleRevoke} onAck={handleAck} />
            ))}
          </AnimatePresence>
        </div>
      )}
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
  tone: "default" | "destructive" | "warning" | "info";
  icon: React.ReactNode;
}) {
  const color =
    tone === "destructive"
      ? "text-destructive"
      : tone === "warning"
        ? "text-warning"
        : tone === "info"
          ? "text-info"
          : "text-primary";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`flex h-9 w-9 items-center justify-center rounded-md bg-secondary ${color}`}>
          {icon}
        </div>
        <div>
          <div className="text-xs text-muted-foreground">{label}</div>
          <div className={`text-2xl font-semibold ${color}`}>{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}
