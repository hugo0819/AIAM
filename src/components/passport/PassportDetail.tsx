"use client";

import { useEffect, useState } from "react";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  PauseCircle,
  PlayCircle,
  ShieldOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CapabilityList } from "./CapabilityList";
import { PassportCard, type PassportCardData, type CardStatus } from "./PassportCard";
import { formatDateTime, shortId } from "@/lib/utils";
import type {
  Capability,
  DataClearance,
  PassportConstraints,
  RiskTier,
} from "@/types/passport";
import {
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from "@/components/ui/sheet";

interface DetailData {
  id: string;
  agent: { id: string; name: string; avatarUrl?: string | null; owner: { displayName: string; email: string } };
  parentId: string | null;
  childrenIds: string[];
  jwt: string;
  capabilities: Capability[];
  constraints: PassportConstraints;
  dataClearance: DataClearance[];
  riskTier: RiskTier;
  delegationDepth: number;
  delegationMax: number;
  status: CardStatus;
  issuedAt: string;
  expiresAt: string;
  revocation?: { reason: string; operatorId: string; revokedAt: string };
  diagnostics: {
    verify:
      | { ok: true }
      | { ok: false; code: string; message: string };
    state: { code: string; detail?: string };
  };
}

interface PassportDetailProps {
  passportId: string;
  onChanged?: () => void;
  onClose?: () => void;
}

export function PassportDetail({ passportId, onChanged, onClose }: PassportDetailProps) {
  const [data, setData] = useState<DetailData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/passports/${passportId}`);
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId]);

  const callAction = async (action: "suspend" | "resume" | "revoke") => {
    setActing(action);
    try {
      if (action === "revoke") {
        const reason =
          typeof window !== "undefined"
            ? window.prompt("请输入吊销理由", "管理员手动吊销") ?? ""
            : "管理员手动吊销";
        if (!reason) return;
        await fetch(`/api/passports/${passportId}/revoke`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ reason, operatorId: "user:admin", cascade: true }),
        });
      } else {
        await fetch(`/api/passports/${passportId}`, {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ action }),
        });
      }
      await load();
      onChanged?.();
    } finally {
      setActing(null);
    }
  };

  if (loading || !data) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        加载中…
      </div>
    );
  }

  const cardData: PassportCardData = {
    id: data.id,
    agent: data.agent,
    capabilities: data.capabilities,
    constraints: data.constraints,
    dataClearance: data.dataClearance,
    riskTier: data.riskTier,
    status: data.status,
    issuedAt: data.issuedAt,
    expiresAt: data.expiresAt,
    delegationDepth: data.delegationDepth,
    delegationMax: data.delegationMax,
  };

  const isActive = data.status === "ACTIVE";
  const isSuspended = data.status === "SUSPENDED";
  const isFinal = data.status === "REVOKED" || data.status === "EXPIRED";

  return (
    <div className="flex h-full flex-col">
      <SheetHeader>
        <SheetTitle>通行证详情</SheetTitle>
        <SheetDescription className="font-mono text-xs">
          jti = {data.id}
        </SheetDescription>
      </SheetHeader>

      <div className="mt-6 flex-1 space-y-5 overflow-y-auto pr-1">
        <PassportCard data={cardData} />

        <section>
          <SectionTitle>诊断 · Diagnostics</SectionTitle>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <DiagItem
              ok={data.diagnostics.verify.ok}
              label="JWT 验签"
              detail={
                data.diagnostics.verify.ok
                  ? "ES256 通过"
                  : `${data.diagnostics.verify.code} · ${data.diagnostics.verify.message}`
              }
            />
            <DiagItem
              ok={data.diagnostics.state.code === "ok"}
              label="状态检查"
              detail={
                data.diagnostics.state.code === "ok"
                  ? "ACTIVE / 未过期 / 未吊销"
                  : `${data.diagnostics.state.code}${data.diagnostics.state.detail ? " · " + data.diagnostics.state.detail : ""}`
              }
            />
          </div>
        </section>

        <Separator />

        <section>
          <SectionTitle>能力清单</SectionTitle>
          <CapabilityList capabilities={data.capabilities} />
        </section>

        <section>
          <SectionTitle>约束</SectionTitle>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <KV label="时间窗" value={data.constraints.timeWindow ?? "—"} />
            <KV label="速率限制" value={data.constraints.rateLimit ? `${data.constraints.rateLimit.count}/${data.constraints.rateLimit.per}` : "—"} />
            <KV label="地理" value={data.constraints.geo?.join(", ") ?? "—"} />
            <KV label="数据等级" value={data.dataClearance.join(", ")} />
          </div>
        </section>

        <section>
          <SectionTitle>委托</SectionTitle>
          <div className="grid grid-cols-2 gap-2 text-sm">
            <KV label="父通行证" value={data.parentId ? shortId(data.parentId) : "—"} />
            <KV label="派生子通行证数" value={String(data.childrenIds.length)} />
            <KV label="当前层" value={String(data.delegationDepth)} />
            <KV label="允许最大层" value={String(data.delegationMax)} />
          </div>
        </section>

        {data.revocation && (
          <section className="rounded-md border border-destructive/40 bg-destructive/10 p-3">
            <SectionTitle className="text-destructive">吊销记录</SectionTitle>
            <div className="text-sm">
              <div>原因：{data.revocation.reason}</div>
              <div className="text-xs text-muted-foreground">
                操作人：{data.revocation.operatorId} ·{" "}
                {formatDateTime(data.revocation.revokedAt)}
              </div>
            </div>
          </section>
        )}

        <section>
          <SectionTitle>JWT</SectionTitle>
          <pre className="overflow-x-auto rounded-md bg-secondary/50 p-3 text-[10px] font-mono text-muted-foreground">
            {data.jwt}
          </pre>
        </section>
      </div>

      <SheetFooter className="mt-4 gap-2">
        {!isFinal && isActive && (
          <Button
            variant="outline"
            onClick={() => callAction("suspend")}
            disabled={!!acting}
          >
            <PauseCircle className="h-4 w-4" />
            挂起
          </Button>
        )}
        {!isFinal && isSuspended && (
          <Button
            variant="outline"
            onClick={() => callAction("resume")}
            disabled={!!acting}
          >
            <PlayCircle className="h-4 w-4" />
            恢复
          </Button>
        )}
        {!isFinal && (
          <Button
            variant="destructive"
            onClick={() => callAction("revoke")}
            disabled={!!acting}
          >
            <ShieldOff className="h-4 w-4" />
            吊销（级联派生）
          </Button>
        )}
        <Button variant="ghost" onClick={onClose}>
          关闭
        </Button>
      </SheetFooter>
    </div>
  );
}

function SectionTitle({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground ${className}`}
    >
      {children}
    </div>
  );
}

function KV({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-secondary/40 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div className="mt-0.5 font-mono text-xs text-foreground">{value}</div>
    </div>
  );
}

function DiagItem({
  ok,
  label,
  detail,
}: {
  ok: boolean;
  label: string;
  detail: string;
}) {
  return (
    <div
      className={`rounded-md border px-3 py-2 ${
        ok
          ? "border-success/40 bg-success/10"
          : "border-destructive/40 bg-destructive/10"
      }`}
    >
      <div className="flex items-center gap-2">
        {ok ? (
          <CheckCircle2 className="h-4 w-4 text-success" />
        ) : (
          <AlertCircle className="h-4 w-4 text-destructive" />
        )}
        <span className="text-sm font-medium">{label}</span>
        <Badge variant={ok ? "success" : "destructive"} className="ml-auto">
          {ok ? "OK" : "FAIL"}
        </Badge>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{detail}</div>
    </div>
  );
}
