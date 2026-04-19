"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Play,
  Check,
  X,
  Loader2,
  Pause,
  RotateCw,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Scenario, ScenarioStep } from "@/mock/scenarios";
import { useDemoStore } from "@/stores/demoStore";

type StepStatus = "pending" | "running" | "ok" | "fail" | "skipped";

interface StepState {
  status: StepStatus;
  detail?: string;
  data?: unknown;
}

interface ScenarioRunnerProps {
  scenario: Scenario;
}

export function ScenarioRunner({ scenario }: ScenarioRunnerProps) {
  const [states, setStates] = useState<StepState[]>(() =>
    scenario.steps.map(() => ({ status: "pending" as const })),
  );
  const [running, setRunning] = useState(false);
  const [cursor, setCursor] = useState(-1);

  const currentPassportId = useDemoStore((s) => s.currentPassportId);
  const setCurrentPassportId = useDemoStore((s) => s.setCurrentPassportId);
  const derivedPassportId = useDemoStore((s) => s.derivedPassportId);
  const setDerivedPassportId = useDemoStore((s) => s.setDerivedPassportId);

  useEffect(() => {
    setStates(scenario.steps.map(() => ({ status: "pending" as const })));
    setCursor(-1);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario.id]);

  const updateState = (idx: number, patch: Partial<StepState>) =>
    setStates((prev) =>
      prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)),
    );

  async function runStep(idx: number, step: ScenarioStep): Promise<boolean> {
    updateState(idx, { status: "running" });

    if (step.kind === "narration" || step.kind === "wait") {
      await wait(step.delayMs ?? 600);
      updateState(idx, { status: "ok" });
      return true;
    }

    if (step.kind === "issue") {
      if (step.payload && "parentPassport" in step.payload) {
        // 派生通行证（S6）
        if (!currentPassportId) {
          updateState(idx, {
            status: "fail",
            detail: "❌ 还没有父通行证。请先回到 /stage/s1 完整播放 S1。",
          });
          return false;
        }

        // ★ 防呆 ★ 派生前先校验父通行证是否有所需的子能力
        try {
          const parentRes = await fetch(`/api/passports/${currentPassportId}`);
          if (!parentRes.ok) {
            updateState(idx, {
              status: "fail",
              detail: `❌ 父通行证 ${currentPassportId.slice(0, 10)}… 不存在（可能已被重置或过期）。请先重置环境并重新播放 S1。`,
            });
            return false;
          }
          const parent = await parentRes.json();
          const parentTools = (parent.capabilities ?? []) as Array<{ tool: string }>;
          const wantedTools = (step.payload.capabilities as Array<{ tool: string }>).map((c) => c.tool);
          const missing = wantedTools.filter(
            (t) =>
              !parentTools.some(
                (p) =>
                  p.tool === t ||
                  (p.tool.endsWith(".*") && t.startsWith(p.tool.slice(0, -2) + ".")),
              ),
          );
          if (missing.length > 0) {
            const have = parentTools.map((c) => c.tool).join(", ");
            updateState(idx, {
              status: "fail",
              detail: `❌ 父通行证缺少子能力 [${missing.join(", ")}]。父当前能力：[${have}]。请先回到 /stage/s1 重新播放（重置环境后重播）。`,
            });
            return false;
          }
        } catch (err) {
          updateState(idx, {
            status: "fail",
            detail:
              "⚠ 派生预检失败：" +
              (err instanceof Error ? err.message : "无法读取父通行证"),
          });
          return false;
        }

        try {
          const res = await fetch(
            `/api/passports/${currentPassportId}/derive`,
            {
              method: "POST",
              headers: { "content-type": "application/json" },
              body: JSON.stringify(step.payload),
            },
          );
          const json = await res.json();
          if (!res.ok) {
            updateState(idx, {
              status: "fail",
              detail: json.error ?? "派生失败",
            });
            return false;
          }
          setDerivedPassportId(json.id);
          updateState(idx, {
            status: "ok",
            detail: `派生成功 · ${json.id.slice(0, 10)}…`,
            data: json,
          });
          return true;
        } catch (err) {
          updateState(idx, {
            status: "fail",
            detail: err instanceof Error ? err.message : "派生失败",
          });
          return false;
        }
      }

      // 签发主通行证（S1）
      const body = {
        agentId: (step.payload?.agentId as string) ?? "agent:aria-7f3a",
        capabilities: step.payload?.capabilities ?? [],
        constraints: step.payload?.constraints ?? {},
        dataClearance: step.payload?.dataClearance ?? ["public", "internal"],
        riskTier: (step.payload?.riskTier as string) ?? "L2",
        ttlHours: (step.payload?.ttlHours as number) ?? 8,
      };
      try {
        const res = await fetch("/api/passports", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(body),
        });
        const json = await res.json();
        if (!res.ok) {
          updateState(idx, { status: "fail", detail: json.error });
          return false;
        }
        setCurrentPassportId(json.id);
        // 重新签发父通行证后，清空旧的派生子通行证引用
        setDerivedPassportId(null);
        updateState(idx, {
          status: "ok",
          detail: `签发成功 · ${json.id.slice(0, 10)}…`,
          data: json,
        });
        return true;
      } catch (err) {
        updateState(idx, {
          status: "fail",
          detail: err instanceof Error ? err.message : "签发失败",
        });
        return false;
      }
    }

    if (step.kind === "invoke") {
      const tool = (step.payload?.tool as string) ?? "";
      const args = (step.payload?.args as Record<string, unknown>) ?? {};
      const ctxOverride = step.payload?.ctxOverride as
        | { timeOfDay?: string; hour?: number }
        | undefined;
      const useDerived = tool.startsWith("flight.");
      const pid = useDerived && derivedPassportId ? derivedPassportId : currentPassportId;
      if (!pid) {
        updateState(idx, {
          status: "fail",
          detail: "没有可用的通行证，请先运行 S1",
        });
        return false;
      }
      try {
        // 调用网关 —— 如果触发 STEP_UP，网关会阻塞等待审批
        // 因此我们异步发起、同时在短暂延迟后打开审批页，由用户在另一个窗口操作
        const invokePromise = fetch("/api/gateway/invoke", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ passportId: pid, tool, args, ctxOverride }),
        }).then((r) => r.json());

        // 如果预期是 STEP_UP，监听审批事件以自动打开审批页
        let approvalWindow: Window | null = null;
        if (step.expect === "STEP_UP") {
          const es = new EventSource("/api/approvals/stream");
          const openIfNeeded = (data: { id: string; status: string; passportId: string }) => {
            if (data.status !== "PENDING") return;
            if (data.passportId !== pid) return;
            if (approvalWindow) return;
            approvalWindow = window.open(
              `/approve/${data.id}`,
              "_blank",
              "width=420,height=740,left=100,top=100",
            );
            es.close();
          };
          es.onmessage = (ev) => {
            try {
              openIfNeeded(JSON.parse(ev.data));
            } catch {
              /* ignore */
            }
          };
          setTimeout(() => es.close(), 120_000);
        }

        const json = await invokePromise;
        const matched =
          step.expect === undefined ||
          (step.expect === "EXECUTED" && json.decision === "EXECUTED") ||
          (step.expect === "DENY" && json.decision === "DENIED") ||
          (step.expect === "STEP_UP" &&
            (json.decision === "EXECUTED" || json.decision === "STEP_UP")) ||
          (step.expect === "ALLOW" && json.decision === "EXECUTED");
        updateState(idx, {
          status: matched ? "ok" : "fail",
          detail: matched
            ? `decision=${json.decision}${json.reason ? " · " + json.reason : ""}`
            : `期望 ${step.expect} 但得到 ${json.decision}`,
          data: json,
        });
        return matched;
      } catch (err) {
        updateState(idx, {
          status: "fail",
          detail: err instanceof Error ? err.message : "调用失败",
        });
        return false;
      }
    }

    if (step.kind === "revoke") {
      if (!currentPassportId) {
        updateState(idx, { status: "fail", detail: "无活跃通行证" });
        return false;
      }
      try {
        await fetch(`/api/passports/${currentPassportId}/revoke`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            reason: (step.payload?.reason as string) ?? "演示吊销",
            operatorId: "user:admin",
            cascade: true,
          }),
        });
        updateState(idx, {
          status: "ok",
          detail: `${currentPassportId.slice(0, 10)}… 及派生通行证已吊销`,
        });
        return true;
      } catch (err) {
        updateState(idx, {
          status: "fail",
          detail: err instanceof Error ? err.message : "吊销失败",
        });
        return false;
      }
    }

    if (step.kind === "approve") {
      // Day 4 真正接入审批流；Day 3 给用户一个提示跳转
      updateState(idx, {
        status: "ok",
        detail: "Day 4 接入 JIT 审批后自动处理",
      });
      return true;
    }

    updateState(idx, { status: "skipped" });
    return true;
  }

  async function playAll() {
    setRunning(true);
    for (let i = 0; i < scenario.steps.length; i++) {
      setCursor(i);
      const ok = await runStep(i, scenario.steps[i]);
      await wait(350);
      if (!ok) break;
    }
    setRunning(false);
  }

  function reset() {
    setStates(scenario.steps.map(() => ({ status: "pending" as const })));
    setCursor(-1);
  }

  return (
    <div>
      <Card className="mb-6">
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-5">
          <div className="flex items-center gap-2">
            <Badge variant={currentPassportId ? "success" : "secondary"} className="font-mono text-[10px]">
              passport: {currentPassportId ? currentPassportId.slice(0, 10) + "…" : "(未签发)"}
            </Badge>
            {derivedPassportId && (
              <Badge variant="info" className="font-mono text-[10px]">
                derived: {derivedPassportId.slice(0, 10)}…
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={reset} disabled={running}>
              <RotateCw className="h-3.5 w-3.5" />
              重置
            </Button>
            <Button onClick={playAll} disabled={running}>
              {running ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
              {running ? "播放中…" : "播放剧本"}
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-2">
        {scenario.steps.map((step, i) => {
          const st = states[i];
          const active = cursor === i;
          return (
            <motion.div
              key={i}
              animate={{
                scale: active ? 1.01 : 1,
                borderColor: active
                  ? "hsl(var(--primary) / 0.6)"
                  : "hsl(var(--border))",
              }}
              transition={{ duration: 0.2 }}
              className={cn(
                "rounded-md border bg-card/50 p-4 transition-colors",
                active && "bg-card shadow-lg shadow-primary/10",
              )}
            >
              <div className="flex items-start gap-3">
                <StatusDot status={st.status} index={i + 1} />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {step.kind}
                    </Badge>
                    <span className="font-semibold">{step.title}</span>
                    {step.expect && (
                      <Badge
                        variant={
                          step.expect === "DENY"
                            ? "destructive"
                            : step.expect === "STEP_UP"
                              ? "warning"
                              : "success"
                        }
                      >
                        expect {step.expect}
                      </Badge>
                    )}
                    {step.highlight && (
                      <Badge variant="info">锚点 {step.highlight}</Badge>
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{step.detail}</p>
                  <AnimatePresence>
                    {st.detail && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className={cn(
                          "mt-2 rounded bg-secondary/60 px-2 py-1 font-mono text-[11px]",
                          st.status === "fail"
                            ? "text-destructive"
                            : "text-muted-foreground",
                        )}
                      >
                        <ArrowRight className="mr-1 inline h-3 w-3" />
                        {st.detail}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function StatusDot({ status, index }: { status: StepStatus; index: number }) {
  if (status === "ok") {
    return (
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-success text-success-foreground">
        <Check className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (status === "fail") {
    return (
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-destructive text-destructive-foreground">
        <X className="h-3.5 w-3.5" />
      </div>
    );
  }
  if (status === "running") {
    return (
      <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      </div>
    );
  }
  return (
    <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-secondary font-mono text-[10px] text-muted-foreground">
      {index}
    </div>
  );
}

function wait(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
