"use client";

import { useEffect, useState, useCallback } from "react";
import { Plus, Loader2, IdCard } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/common/EmptyState";
import { PassportCard, type PassportCardData, type CardStatus } from "./PassportCard";
import { PassportForm } from "./PassportForm";
import { PassportDetail } from "./PassportDetail";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
} from "@/components/ui/sheet";
import { formatDateTime, shortId } from "@/lib/utils";
import type {
  Capability,
  DataClearance,
  PassportConstraints,
  RiskTier,
} from "@/types/passport";

interface ListItem {
  id: string;
  agentId: string;
  agent: { id: string; name: string; avatarUrl?: string | null };
  parentId: string | null;
  capabilities: Capability[];
  constraints: PassportConstraints;
  dataClearance: DataClearance[];
  riskTier: RiskTier;
  delegationDepth: number;
  delegationMax: number;
  status: CardStatus;
  issuedAt: string;
  expiresAt: string;
  revoked: boolean;
  revocationReason?: string;
}

export function PassportList() {
  const [items, setItems] = useState<ListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [issueOpen, setIssueOpen] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/passports");
      const json = await res.json();
      setItems(json.items);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleIssued = async () => {
    setIssueOpen(false);
    await load();
  };

  return (
    <div>
      <div className="mb-6 flex items-center justify-end">
        <Sheet open={issueOpen} onOpenChange={setIssueOpen}>
          <SheetTrigger asChild>
            <Button>
              <Plus className="h-4 w-4" />
              签发通行证
            </Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-full sm:max-w-xl">
            <PassportForm
              onSubmitted={handleIssued}
              onClose={() => setIssueOpen(false)}
            />
          </SheetContent>
        </Sheet>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-muted-foreground">
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          加载中…
        </div>
      ) : items.length === 0 ? (
        <EmptyState
          icon={<IdCard className="h-10 w-10" />}
          title="还没有签发任何通行证"
          description="点击右上角「签发通行证」为示例 Agent Aria 颁发第一张通行证。"
        />
      ) : (
        <div className="grid gap-5 lg:grid-cols-2 xl:grid-cols-3">
          {items.map((p) => {
            const card: PassportCardData = {
              id: p.id,
              agent: p.agent,
              capabilities: p.capabilities,
              constraints: p.constraints,
              dataClearance: p.dataClearance,
              riskTier: p.riskTier,
              status: p.status,
              issuedAt: p.issuedAt,
              expiresAt: p.expiresAt,
            };
            return (
              <Card
                key={p.id}
                className="overflow-hidden transition-all hover:border-primary/50"
              >
                <CardContent className="p-4">
                  <PassportCard data={card} flippable />

                  <div className="mt-4 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {shortId(p.id, 6, 4)}
                      </Badge>
                      {p.parentId && (
                        <Badge variant="info" className="text-[10px]">
                          派生 · L{p.delegationDepth}
                        </Badge>
                      )}
                    </div>
                    <span>签发 {formatDateTime(p.issuedAt).slice(5, 16)}</span>
                  </div>

                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 w-full"
                    onClick={() => setDetailId(p.id)}
                  >
                    查看详情 / 操作
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Sheet
        open={!!detailId}
        onOpenChange={(open) => {
          if (!open) setDetailId(null);
        }}
      >
        <SheetContent side="right" className="w-full sm:max-w-xl">
          {detailId && (
            <PassportDetail
              passportId={detailId}
              onChanged={load}
              onClose={() => setDetailId(null)}
            />
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
