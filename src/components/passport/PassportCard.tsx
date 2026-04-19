"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import {
  IdCard,
  Fingerprint,
  Shield,
  Clock,
  Globe,
  RotateCw,
} from "lucide-react";
import { cn, formatDateTime, shortId } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type {
  Capability,
  DataClearance,
  PassportConstraints,
  RiskTier,
} from "@/types/passport";

export type CardStatus = "ACTIVE" | "SUSPENDED" | "EXPIRED" | "REVOKED" | "DRAFT";

export interface PassportCardData {
  id: string;
  agent: { id: string; name: string; avatarUrl?: string | null };
  capabilities: Capability[];
  constraints: PassportConstraints;
  dataClearance: DataClearance[];
  riskTier: RiskTier;
  status: CardStatus;
  issuedAt: string;
  expiresAt: string;
  delegationDepth?: number;
  delegationMax?: number;
}

const STATUS_TO_VARIANT: Record<
  CardStatus,
  { variant: "success" | "warning" | "destructive" | "secondary"; label: string }
> = {
  ACTIVE: { variant: "success", label: "ACTIVE" },
  SUSPENDED: { variant: "warning", label: "SUSPENDED" },
  EXPIRED: { variant: "secondary", label: "EXPIRED" },
  REVOKED: { variant: "destructive", label: "REVOKED" },
  DRAFT: { variant: "secondary", label: "DRAFT" },
};

const RISK_TONE: Record<RiskTier, string> = {
  L1: "text-success",
  L2: "text-warning",
  L3: "text-destructive",
};

interface PassportCardProps {
  data: PassportCardData;
  className?: string;
  flippable?: boolean;
}

export function PassportCard({
  data,
  className,
  flippable = true,
}: PassportCardProps) {
  const [flipped, setFlipped] = useState(false);
  const status = STATUS_TO_VARIANT[data.status];
  const isInactive =
    data.status === "EXPIRED" ||
    data.status === "REVOKED" ||
    data.status === "SUSPENDED";

  return (
    <div
      className={cn("relative w-full", className)}
      style={{ perspective: 1600, aspectRatio: "1.585 / 1" }}
    >
      <motion.div
        className="relative h-full w-full"
        style={{ transformStyle: "preserve-3d" }}
        animate={{ rotateY: flipped ? 180 : 0 }}
        transition={{ duration: 0.7, type: "spring", bounce: 0.18 }}
      >
        {/* ── 正面 ──────────────────────────────────────────────── */}
        <div
          className={cn(
            "absolute inset-0 rounded-2xl border border-border passport-surface p-6 shadow-2xl shadow-black/40",
            !isInactive && "passport-shine",
          )}
          style={{ backfaceVisibility: "hidden" }}
        >
          <div className="absolute inset-0 overflow-hidden rounded-2xl">
            <div className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
            <div className="absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-accent/15 blur-3xl" />
            <div
              className="absolute inset-0 opacity-[0.05]"
              style={{
                backgroundImage:
                  "repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 1px, transparent 12px)",
              }}
            />
          </div>

          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                  <IdCard className="h-3 w-3" />
                  Agent Passport
                </div>
                <div className="mt-1 text-[9px] uppercase tracking-[0.3em] text-muted-foreground/70">
                  agent-passport-authority
                </div>
              </div>
              <Badge variant={status.variant} className="font-mono text-[10px]">
                {status.label}
              </Badge>
            </div>

            <div className="flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg">
                <span className="text-2xl font-semibold">
                  {data.agent.name.slice(0, 1)}
                </span>
              </div>
              <div className="flex-1">
                <div className="text-[10px] uppercase tracking-wider text-muted-foreground">
                  Holder · Agent
                </div>
                <div className="text-lg font-semibold leading-tight">
                  {data.agent.name}
                </div>
                <div className="font-mono text-[11px] text-muted-foreground">
                  {data.agent.id}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 text-[11px]">
              <FieldBlock icon={<Fingerprint className="h-3 w-3" />} label="Passport ID">
                <span className="font-mono">{shortId(data.id, 6, 4)}</span>
              </FieldBlock>
              <FieldBlock icon={<Shield className="h-3 w-3" />} label="Risk Tier">
                <span className={cn("font-semibold", RISK_TONE[data.riskTier])}>
                  {data.riskTier}
                </span>
              </FieldBlock>
              <FieldBlock icon={<Clock className="h-3 w-3" />} label="Expires">
                <span className="font-mono">
                  {formatDateTime(data.expiresAt).slice(5, 16)}
                </span>
              </FieldBlock>
            </div>

            {flippable && (
              <button
                type="button"
                onClick={() => setFlipped(true)}
                className="absolute bottom-2 right-2 flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                <RotateCw className="h-3 w-3" />
                查看背面
              </button>
            )}
          </div>

          {isInactive && (
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="rotate-[-15deg] rounded-md border-2 border-destructive/60 px-6 py-2 text-2xl font-bold tracking-[0.2em] text-destructive/70">
                {status.label}
              </div>
            </div>
          )}
        </div>

        {/* ── 背面 ──────────────────────────────────────────────── */}
        <div
          className="absolute inset-0 rounded-2xl border border-border bg-card p-5 shadow-2xl shadow-black/40"
          style={{ backfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between">
              <div className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                Capabilities & Constraints
              </div>
              {flippable && (
                <button
                  type="button"
                  onClick={() => setFlipped(false)}
                  className="flex items-center gap-1 rounded-md px-2 py-1 text-[10px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <RotateCw className="h-3 w-3" />
                  返回正面
                </button>
              )}
            </div>

            <div className="mt-3 flex-1 space-y-2 overflow-y-auto pr-1">
              {data.capabilities.map((cap, i) => (
                <div
                  key={i}
                  className="rounded-md border border-border/60 bg-secondary/40 px-3 py-2 text-xs"
                >
                  <div className="flex items-center justify-between">
                    <code className="font-mono text-foreground">{cap.tool}</code>
                    <div className="flex gap-1">
                      {cap.scope.map((s) => (
                        <Badge key={s} variant="outline" className="text-[9px]">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  {cap.constraint && (
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      {Object.entries(cap.constraint)
                        .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                        .join(" · ")}
                    </div>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 border-t border-border pt-3 text-[10px]">
              {data.constraints.timeWindow && (
                <FieldBlock icon={<Clock className="h-3 w-3" />} label="Time Window">
                  <span className="font-mono">{data.constraints.timeWindow}</span>
                </FieldBlock>
              )}
              {data.constraints.geo?.length ? (
                <FieldBlock icon={<Globe className="h-3 w-3" />} label="Geo">
                  <span className="font-mono">{data.constraints.geo.join(",")}</span>
                </FieldBlock>
              ) : null}
              <FieldBlock label="Data Clearance">
                <span className="font-mono text-[10px]">
                  {data.dataClearance.join(", ")}
                </span>
              </FieldBlock>
              <FieldBlock label="Issued At">
                <span className="font-mono text-[10px]">
                  {formatDateTime(data.issuedAt).slice(5, 16)}
                </span>
              </FieldBlock>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function FieldBlock({
  icon,
  label,
  children,
}: {
  icon?: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center gap-1 text-[9px] uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-[11px] text-foreground">{children}</div>
    </div>
  );
}
