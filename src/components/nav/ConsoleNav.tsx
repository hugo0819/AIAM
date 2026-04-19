"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import {
  IdCard,
  Scale,
  History,
  AlertTriangle,
  Play,
  Home,
} from "lucide-react";

const NAV = [
  { href: "/console/passports", label: "通行证", icon: IdCard },
  { href: "/console/policies", label: "策略", icon: Scale },
  { href: "/console/audit", label: "审计与图谱", icon: History },
  { href: "/console/risk", label: "风险中心", icon: AlertTriangle, hasBadge: true },
];

export function ConsoleNav() {
  const pathname = usePathname();
  const [unAckCount, setUnAckCount] = useState(0);

  useEffect(() => {
    const fetchCount = () =>
      fetch("/api/risk?acknowledged=false&limit=200")
        .then((r) => r.json())
        .then((j) => setUnAckCount(j.items?.length ?? 0))
        .catch(() => {});
    fetchCount();
    const es = new EventSource("/api/risk/stream");
    es.onmessage = fetchCount;
    const t = setInterval(fetchCount, 10000);
    return () => {
      es.close();
      clearInterval(t);
    };
  }, []);

  return (
    <aside className="sticky top-0 flex h-screen w-60 flex-col border-r border-border bg-card/30 px-4 py-6">
      <Link href="/" className="mb-8 flex items-center gap-2 px-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-md bg-gradient-to-br from-primary to-accent">
          <IdCard className="h-4 w-4 text-primary-foreground" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-semibold">Agent Passport</span>
          <span className="text-[10px] text-muted-foreground">AI 身份治理平台</span>
        </div>
      </Link>

      <nav className="flex flex-1 flex-col gap-1">
        {NAV.map((item) => {
          const active = pathname.startsWith(item.href);
          const Icon = item.icon;
          const showBadge = item.hasBadge && unAckCount > 0;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/30"
                  : "text-muted-foreground hover:bg-secondary hover:text-foreground",
              )}
            >
              <Icon className="h-4 w-4" />
              <span className="flex-1">{item.label}</span>
              {showBadge && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-[10px] font-semibold text-destructive-foreground">
                  {unAckCount > 99 ? "99+" : unAckCount}
                </span>
              )}
            </Link>
          );
        })}

        <div className="mt-4 border-t border-border pt-4">
          <Link
            href="/stage"
            className={cn(
              "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
              pathname.startsWith("/stage")
                ? "bg-accent/15 text-accent ring-1 ring-inset ring-accent/30"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground",
            )}
          >
            <Play className="h-4 w-4" />
            <span>演示舞台</span>
          </Link>
        </div>
      </nav>

      <Link
        href="/"
        className="flex items-center gap-3 rounded-md px-3 py-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground"
      >
        <Home className="h-3.5 w-3.5" />
        <span>返回首页</span>
      </Link>
    </aside>
  );
}
