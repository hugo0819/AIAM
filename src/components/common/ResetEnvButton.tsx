"use client";

import { useState } from "react";
import { RotateCw, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ResetEnvButton() {
  const [state, setState] = useState<"idle" | "running" | "ok" | "err">("idle");

  const handle = async () => {
    if (!confirm("确认重置环境？将清空所有通行证 / 审计 / 告警，并重新写入 seed。")) return;
    setState("running");
    try {
      const res = await fetch("/api/admin/reset", { method: "POST" });
      if (!res.ok) throw new Error("reset failed");
      setState("ok");
      // 同时清空 localStorage 中的 demo passport 引用
      try {
        window.localStorage.removeItem("demo:currentPassportId");
        window.localStorage.removeItem("demo:derivedPassportId");
      } catch {
        // ignore
      }
      setTimeout(() => setState("idle"), 2500);
    } catch {
      setState("err");
      setTimeout(() => setState("idle"), 2500);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handle}
      disabled={state === "running"}
    >
      {state === "running" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : state === "ok" ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
      ) : (
        <RotateCw className="h-3.5 w-3.5" />
      )}
      {state === "ok" ? "已重置" : state === "running" ? "重置中…" : "重置环境"}
    </Button>
  );
}
