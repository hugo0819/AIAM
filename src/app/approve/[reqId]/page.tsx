"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Check,
  X,
  ShieldAlert,
  Loader2,
  AlertCircle,
  CheckCircle2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatDateTime } from "@/lib/utils";

interface ApprovalData {
  id: string;
  passportId: string;
  agentId: string;
  agentName: string;
  approverId: string;
  reason: string;
  payloadDigest: string;
  args: Record<string, unknown>;
  status: "PENDING" | "APPROVED" | "REJECTED" | "TIMEOUT";
  expiresAt: string;
  createdAt: string;
}

export default function ApprovePage() {
  const params = useParams<{ reqId: string }>();
  const router = useRouter();
  const [data, setData] = useState<ApprovalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [acting, setActing] = useState<null | "approve" | "reject">(null);
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const tick = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(tick);
  }, []);

  const load = async () => {
    const res = await fetch(`/api/approvals/${params.reqId}`);
    if (res.ok) setData(await res.json());
    setLoading(false);
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.reqId]);

  const decide = async (action: "approve" | "reject") => {
    setActing(action);
    try {
      const res = await fetch(`/api/approvals/${params.reqId}`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ action }),
      });
      if (res.ok) await load();
    } finally {
      setActing(null);
    }
  };

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </main>
    );
  }

  if (!data) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-muted-foreground">审批请求不存在或已清理</p>
      </main>
    );
  }

  const expiresAt = new Date(data.expiresAt).getTime();
  const remainingMs = Math.max(0, expiresAt - now);
  const remainingSec = Math.ceil(remainingMs / 1000);
  const progressPct =
    data.status === "PENDING"
      ? Math.max(
          0,
          Math.min(100, (remainingMs / (60 * 1000)) * 100),
        )
      : 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-background via-background to-primary/10 p-6">
      <div className="mx-auto w-full max-w-md">
        <div className="mb-3 text-center text-xs uppercase tracking-[0.3em] text-muted-foreground">
          AI Agent Passport · 手机推送
        </div>

        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 260, damping: 22 }}
          className="overflow-hidden rounded-3xl border border-border bg-card shadow-2xl shadow-black/40"
        >
          <div className="flex items-center gap-3 border-b border-border bg-card/40 px-5 py-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-warning/20 text-warning">
              <ShieldAlert className="h-4 w-4" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-semibold">AI 行动需要你确认</div>
              <div className="text-[10px] text-muted-foreground">
                {formatDateTime(data.createdAt).slice(11, 19)}
              </div>
            </div>
            <Bell className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="px-5 py-5">
            <AnimatePresence mode="wait">
              {data.status === "PENDING" ? (
                <motion.div key="pending" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  <Badge variant="warning" className="mb-3">
                    STEP_UP
                  </Badge>
                  <h1 className="text-xl font-semibold leading-snug">
                    {data.reason}
                  </h1>
                  <div className="mt-1 text-sm text-muted-foreground">
                    来自 <span className="text-foreground">{data.agentName}</span>
                  </div>

                  <div className="mt-5 rounded-xl border border-border bg-secondary/40 p-4">
                    <div className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                      请求参数
                    </div>
                    <pre className="whitespace-pre-wrap break-all font-mono text-[11px] text-foreground">
                      {JSON.stringify(data.args, null, 2)}
                    </pre>
                    <div className="mt-3 flex items-center justify-between text-[10px] text-muted-foreground">
                      <span>digest · {data.payloadDigest}</span>
                      <span>passport · {data.passportId.slice(0, 10)}…</span>
                    </div>
                  </div>

                  <div className="mt-5">
                    <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {remainingSec}s 后自动拒绝
                      </span>
                      <span>approver · {data.approverId}</span>
                    </div>
                    <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                      <motion.div
                        className="h-full bg-gradient-to-r from-warning to-destructive"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-6 grid grid-cols-2 gap-3">
                    <Button
                      variant="outline"
                      size="lg"
                      className="h-12"
                      onClick={() => decide("reject")}
                      disabled={!!acting}
                    >
                      {acting === "reject" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <X className="h-4 w-4" />
                      )}
                      拒绝
                    </Button>
                    <Button
                      size="lg"
                      className="h-12"
                      onClick={() => decide("approve")}
                      disabled={!!acting}
                    >
                      {acting === "approve" ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      批准
                    </Button>
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="decided"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="py-6 text-center"
                >
                  {data.status === "APPROVED" ? (
                    <CheckCircle2 className="mx-auto h-14 w-14 text-success" />
                  ) : (
                    <AlertCircle className="mx-auto h-14 w-14 text-destructive" />
                  )}
                  <div className="mt-3 text-lg font-semibold">
                    {data.status === "APPROVED"
                      ? "已批准"
                      : data.status === "REJECTED"
                        ? "已拒绝"
                        : "已超时"}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Agent {data.agentName} 的这次请求已处理。
                  </p>
                  <Button
                    variant="outline"
                    className="mt-5"
                    onClick={() => router.push("/console/audit")}
                  >
                    查看审计
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </div>
    </main>
  );
}
