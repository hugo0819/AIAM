"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  CheckCircle2,
  Ban,
  Clock,
  ChevronDown,
  Shield,
  ShieldAlert,
  AlertOctagon,
} from "lucide-react";
import { cn, formatDateTime, shortId } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { useAuditStore } from "@/stores/auditStore";
import type {
  AuditEventData,
  EventDecision,
  EventPhase,
} from "@/types/events";

const PHASE_TONE: Record<EventPhase, string> = {
  RECEIVED: "text-info",
  VERIFIED: "text-info",
  POLICY_CHECKED: "text-warning",
  MASKED: "text-accent",
  EXECUTED: "text-success",
  LOGGED: "text-muted-foreground",
};

const DECISION_UI: Record<
  EventDecision,
  { variant: "success" | "destructive" | "warning" | "secondary" | "info"; icon: React.ReactNode }
> = {
  ALLOW: { variant: "success", icon: <CheckCircle2 className="h-3 w-3" /> },
  EXECUTED: { variant: "success", icon: <CheckCircle2 className="h-3 w-3" /> },
  DENY: { variant: "destructive", icon: <Ban className="h-3 w-3" /> },
  STEP_UP: { variant: "warning", icon: <ShieldAlert className="h-3 w-3" /> },
  ERROR: { variant: "destructive", icon: <AlertOctagon className="h-3 w-3" /> },
};

interface EventTimelineProps {
  passportId?: string;
  limit?: number;
  className?: string;
}

export function EventTimeline({ passportId, limit = 80, className }: EventTimelineProps) {
  const { events, push, prepend, setStreaming } = useAuditStore();
  const [expanded, setExpanded] = useState<string | null>(null);

  // 初次拉一次历史
  useEffect(() => {
    fetch(`/api/audit?limit=${limit}${passportId ? `&passportId=${passportId}` : ""}`)
      .then((r) => r.json())
      .then((json) => prepend(json.items));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [passportId, limit]);

  // SSE 订阅
  useEffect(() => {
    const es = new EventSource("/api/audit/stream");
    setStreaming(true);
    es.onmessage = (ev) => {
      try {
        const data = JSON.parse(ev.data) as AuditEventData;
        if (passportId && data.passportId !== passportId) return;
        push(data);
      } catch {
        // ignore
      }
    };
    es.onerror = () => setStreaming(false);
    return () => {
      setStreaming(false);
      es.close();
    };
  }, [passportId, push, setStreaming]);

  const filtered = passportId ? events.filter((e) => e.passportId === passportId) : events;

  if (filtered.length === 0) {
    return (
      <div className={cn("rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground", className)}>
        暂无事件。回到演示舞台触发一次场景后，事件会实时出现在这里。
      </div>
    );
  }

  return (
    <div className={cn("space-y-1", className)}>
      <AnimatePresence initial={false}>
        {filtered.slice(0, limit).map((evt) => {
          const decUI = DECISION_UI[evt.decision];
          const open = expanded === evt.id;
          return (
            <motion.div
              key={evt.id}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className={cn(
                "group rounded-md border border-border bg-card/40 transition-colors",
                open && "border-primary/40 bg-card",
              )}
            >
              <button
                type="button"
                onClick={() => setExpanded(open ? null : evt.id)}
                className="flex w-full items-center gap-3 px-3 py-2 text-left"
              >
                <div className={cn("flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-secondary", PHASE_TONE[evt.phase])}>
                  <Shield className="h-3.5 w-3.5" />
                </div>
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className={cn("font-mono text-[11px] uppercase tracking-wider", PHASE_TONE[evt.phase])}>
                    {evt.phase}
                  </span>
                  <Badge variant={decUI.variant} className="gap-1 text-[10px]">
                    {decUI.icon}
                    {evt.decision}
                  </Badge>
                  {evt.toolName && (
                    <code className="truncate font-mono text-xs text-foreground">
                      {evt.toolId}
                    </code>
                  )}
                  {evt.policyHits.length > 0 && (
                    <span className="text-[10px] text-muted-foreground">
                      hit: {evt.policyHits.map((p) => shortId(p, 6, 3)).join(", ")}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="h-3 w-3" />
                  {formatDateTime(evt.createdAt).slice(11, 19)}
                  {evt.latencyMs !== undefined && (
                    <span className="font-mono">· {evt.latencyMs}ms</span>
                  )}
                  <ChevronDown
                    className={cn(
                      "h-3.5 w-3.5 transition-transform",
                      open && "rotate-180",
                    )}
                  />
                </div>
              </button>

              {open && (
                <div className="border-t border-border px-3 py-3 text-xs">
                  {evt.note && (
                    <div className="mb-3 italic text-muted-foreground">{evt.note}</div>
                  )}
                  <div className="grid gap-3 md:grid-cols-2">
                    {evt.argsRaw !== undefined && (
                      <KVBlock
                        label="入参 (原始)"
                        value={evt.argsRaw}
                      />
                    )}
                    {evt.argsMasked !== undefined &&
                      JSON.stringify(evt.argsMasked) !== JSON.stringify(evt.argsRaw) && (
                        <KVBlock
                          label="入参 (脱敏)"
                          value={evt.argsMasked}
                          tone="accent"
                        />
                      )}
                    {evt.responseRaw !== undefined && (
                      <KVBlock label="出参 (原始)" value={evt.responseRaw} />
                    )}
                    {evt.responseMasked !== undefined &&
                      JSON.stringify(evt.responseMasked) !== JSON.stringify(evt.responseRaw) && (
                        <KVBlock
                          label="出参 (脱敏)"
                          value={evt.responseMasked}
                          tone="accent"
                        />
                      )}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                    <span>passport {shortId(evt.passportId, 6, 4)}</span>
                    {evt.parentEventId && (
                      <span>parent {shortId(evt.parentEventId, 6, 4)}</span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}

function KVBlock({
  label,
  value,
  tone,
}: {
  label: string;
  value: unknown;
  tone?: "accent";
}) {
  return (
    <div
      className={cn(
        "rounded-md border bg-secondary/40 p-2",
        tone === "accent" ? "border-accent/40" : "border-border",
      )}
    >
      <div className="mb-1 text-[10px] uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-[10.5px] text-foreground">
        {typeof value === "string" ? value : JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}
