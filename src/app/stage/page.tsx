import Link from "next/link";
import { ArrowLeft, Play } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { SCENARIOS } from "@/mock/scenarios";

export default function StageIndexPage() {
  return (
    <main className="container py-10">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="mb-3">
            <Link href="/">
              <ArrowLeft className="h-4 w-4" />
              返回首页
            </Link>
          </Button>
          <h1 className="text-3xl font-semibold tracking-tight">演示舞台</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            七个场景串起 5 分钟的完整故事线。建议按 S1 → S7 顺序演示。
          </p>
        </div>
        <Badge variant="info">Scripted Demo · 稳定可回放</Badge>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {SCENARIOS.map((s, idx) => (
          <Link key={s.id} href={`/stage/${s.code.toLowerCase()}`} className="group">
            <Card className="h-full transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10">
              <CardContent className="flex h-full flex-col gap-4 p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary/15 text-primary font-mono text-sm">
                      {s.code}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      #{String(idx + 1).padStart(2, "0")}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {s.tags.map((t) => (
                      <Badge
                        key={t}
                        variant={
                          t === "C1" || t === "C2" || t === "C3" || t === "C4"
                            ? "default"
                            : "secondary"
                        }
                      >
                        {t}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="font-semibold leading-snug group-hover:text-primary">
                    {s.title}
                  </div>
                  <div className="mt-1 text-sm text-muted-foreground">
                    {s.subtitle}
                  </div>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-mono text-accent">{s.heroMetric}</span>
                  <span className="flex items-center gap-1 text-muted-foreground group-hover:text-primary">
                    <Play className="h-3 w-3" />
                    {s.steps.length} 步
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </main>
  );
}
