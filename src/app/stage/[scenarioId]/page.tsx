import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { SCENARIOS, getScenario } from "@/mock/scenarios";
import { ScenarioRunner } from "@/components/stage/ScenarioRunner";

export function generateStaticParams() {
  return SCENARIOS.map((s) => ({ scenarioId: s.code.toLowerCase() }));
}

export default function ScenarioPage({ params }: { params: { scenarioId: string } }) {
  const scenario = getScenario(params.scenarioId);
  if (!scenario) return notFound();

  return (
    <main className="container max-w-5xl py-10">
      <Button asChild variant="ghost" size="sm" className="mb-4">
        <Link href="/stage">
          <ArrowLeft className="h-4 w-4" />
          返回舞台
        </Link>
      </Button>

      <div className="mb-8">
        <div className="mb-3 flex items-center gap-2">
          <Badge variant="outline" className="font-mono">
            {scenario.code}
          </Badge>
          {scenario.tags.map((t) => (
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
        <h1 className="text-3xl font-semibold tracking-tight">{scenario.title}</h1>
        <p className="mt-2 text-muted-foreground">{scenario.subtitle}</p>
        <div className="mt-3 font-mono text-sm text-accent">{scenario.heroMetric}</div>
      </div>

      <ScenarioRunner scenario={scenario} />
    </main>
  );
}
