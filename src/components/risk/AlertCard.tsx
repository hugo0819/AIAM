"use client";

import { motion } from "framer-motion";
import {
  AlertTriangle,
  ShieldAlert,
  AlertOctagon,
  ShieldOff,
  Check,
  Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn, formatDateTime, shortId } from "@/lib/utils";
import type { Severity } from "@/types/events";
import type { EnrichedAlert } from "@/stores/riskStore";

const SEVERITY_UI: Record<
  Severity,
  { bg: string; border: string; icon: React.ReactNode; tone: string }
> = {
  INFO: {
    bg: "bg-info/5",
    border: "border-info/40",
    icon: <AlertTriangle className="h-4 w-4" />,
    tone: "text-info",
  },
  WARN: {
    bg: "bg-warning/10",
    border: "border-warning/50",
    icon: <ShieldAlert className="h-4 w-4" />,
    tone: "text-warning",
  },
  CRITICAL: {
    bg: "bg-destructive/10",
    border: "border-destructive/60",
    icon: <AlertOctagon className="h-4 w-4" />,
    tone: "text-destructive",
  },
};

interface AlertCardProps {
  alert: EnrichedAlert;
  onRevoke?: (passportId: string) => void;
  onAck?: (id: string) => void;
}

export function AlertCard({ alert, onRevoke, onAck }: AlertCardProps) {
  const ui = SEVERITY_UI[alert.severity];
  const hits = (alert.evidence.hits as number) ?? 1;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ type: "spring", stiffness: 260, damping: 22 }}
      className={cn(
        "rounded-lg border-l-4 bg-card shadow-sm",
        ui.border,
        ui.bg,
        alert.acknowledged && "opacity-60",
      )}
    >
      <div className="flex items-start gap-3 p-4">
        <div
          className={cn(
            "mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-background/40",
            ui.tone,
          )}
        >
          {ui.icon}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge
              variant={
                alert.severity === "CRITICAL"
                  ? "destructive"
                  : alert.severity === "WARN"
                    ? "warning"
                    : "info"
              }
              className="font-mono text-[10px]"
            >
              {alert.severity}
            </Badge>
            <code className="font-mono text-xs text-foreground">{alert.rule}</code>
            {hits > 1 && (
              <Badge variant="secondary" className="text-[10px]">
                命中 × {hits}
              </Badge>
            )}
            {alert.acknowledged && (
              <Badge variant="success" className="gap-1 text-[10px]">
                <Check className="h-3 w-3" />
                已确认
              </Badge>
            )}
          </div>

          <p className="mt-2 text-sm">
            {(alert.evidence.description as string) ?? "风险规则命中"}
          </p>

          <div className="mt-2 flex flex-wrap gap-3 text-[11px] text-muted-foreground">
            <span>
              <Clock className="mr-1 inline h-3 w-3" />
              {formatDateTime(alert.createdAt)}
            </span>
            {alert.agentName && <span>Agent · {alert.agentName}</span>}
            <span className="font-mono">passport {shortId(alert.passportId, 6, 4)}</span>
            {alert.passportRevoked && (
              <Badge variant="destructive" className="text-[10px]">
                已吊销
              </Badge>
            )}
          </div>

          <details className="mt-2">
            <summary className="cursor-pointer text-[11px] text-muted-foreground hover:text-foreground">
              证据 / evidence
            </summary>
            <pre className="mt-2 overflow-x-auto rounded bg-secondary/60 p-2 font-mono text-[10px] text-muted-foreground">
              {JSON.stringify(alert.evidence, null, 2)}
            </pre>
          </details>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-2">
          {!alert.passportRevoked && onRevoke && (
            <Button
              variant="destructive"
              size="sm"
              onClick={() => onRevoke(alert.passportId)}
            >
              <ShieldOff className="h-3.5 w-3.5" />
              一键吊销
            </Button>
          )}
          {!alert.acknowledged && onAck && (
            <Button variant="outline" size="sm" onClick={() => onAck(alert.id)}>
              <Check className="h-3.5 w-3.5" />
              确认
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
