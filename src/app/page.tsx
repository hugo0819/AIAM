import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ResetEnvButton } from "@/components/common/ResetEnvButton";
import { SCENARIOS } from "@/mock/scenarios";

const INNOVATIONS = [
  {
    code: "C1",
    title: "能力令牌",
    tagline: "Capability Token",
    desc: "不是粗粒度 scope，而是工具白名单 + 数据域 + 调用配额 + 风险等级的结构化签名声明。",
  },
  {
    code: "C2",
    title: "数据平面管控",
    tagline: "Data-Plane DLP",
    desc: "网关不止拦请求，还拦数据。出参 PII 自动脱敏，避免「权限过了但数据漏了」。",
  },
  {
    code: "C3",
    title: "即时风险升级",
    tagline: "JIT Elevation",
    desc: "高风险动作触发人在回路的二次确认，告别「提前给足所有权限」的粗放模式。",
  },
  {
    code: "C4",
    title: "信任链路可视化",
    tagline: "Trust Graph",
    desc: "用户 → Agent → 子 Agent → 工具 → 数据，端到端实时绘图，责任归属一眼明了。",
  },
];

export default function Home() {
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-[600px] bg-gradient-to-b from-primary/20 via-accent/10 to-transparent"
        aria-hidden
      />

      <section className="container relative z-10 pt-20 pb-12">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Badge variant="info">参赛作品 · 字节跳动创新项目挑战赛</Badge>
          </div>
          <ResetEnvButton />
        </div>

        <h1 className="mt-8 text-5xl font-semibold leading-tight tracking-tight md:text-6xl">
          给 AI 发通行证
          <br />
          <span className="text-gradient">构建 Agent 身份与权限系统</span>
        </h1>

        <p className="mt-6 max-w-2xl text-lg text-muted-foreground">
          一张可签发、可验证、可吊销、最小权限、全程留痕的数字通行证，
          让每一次 AI 行动都可控、可审、可追责。
        </p>

        <div className="mt-10 flex flex-wrap gap-3">
          <Button asChild size="lg">
            <Link href="/stage/s1">
              <Sparkles className="h-4 w-4" />
              从 S1 开始演示
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/console/passports">进入控制台</Link>
          </Button>
        </div>
      </section>

      <section className="container relative z-10 pb-16">
        <h2 className="mb-6 text-sm font-medium uppercase tracking-widest text-muted-foreground">
          四个差异化锚点（不是又一个 OAuth）
        </h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {INNOVATIONS.map((item) => (
            <Card key={item.code} className="glass">
              <CardContent className="flex flex-col gap-3 p-6">
                <div className="flex items-center justify-between">
                  <Badge>{item.code}</Badge>
                  <span className="text-xs text-muted-foreground">{item.tagline}</span>
                </div>
                <div className="text-lg font-semibold">{item.title}</div>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {item.desc}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container relative z-10 pb-24">
        <div className="mb-6 flex items-end justify-between">
          <div>
            <h2 className="text-sm font-medium uppercase tracking-widest text-muted-foreground">
              七个 Demo 场景
            </h2>
            <p className="mt-2 text-xl font-semibold">一条 5 分钟可讲完的故事线</p>
          </div>
          <Button asChild variant="link">
            <Link href="/stage">全部查看 →</Link>
          </Button>
        </div>

        <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {SCENARIOS.map((s) => (
            <Link key={s.id} href={`/stage/${s.code.toLowerCase()}`} className="group">
              <Card className="h-full transition-all hover:border-primary/60 hover:shadow-lg hover:shadow-primary/10">
                <CardContent className="flex h-full flex-col gap-3 p-5">
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="font-mono">
                      {s.code}
                    </Badge>
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
                  <div className="font-semibold leading-snug group-hover:text-primary">
                    {s.title}
                  </div>
                  <div className="text-sm text-muted-foreground line-clamp-2">
                    {s.subtitle}
                  </div>
                  <div className="mt-auto text-xs font-mono text-accent">
                    {s.heroMetric}
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      </section>

      <footer className="container relative z-10 pb-10 text-xs text-muted-foreground">
        AI Agent Passport · Concept Prototype · Built with Next.js + Prisma + shadcn-style UI
      </footer>
    </main>
  );
}
