import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { Capability } from "@/types/passport";

interface CapabilityListProps {
  capabilities: Capability[];
  className?: string;
}

export function CapabilityList({ capabilities, className }: CapabilityListProps) {
  if (capabilities.length === 0) {
    return (
      <div className="rounded-md border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
        无能力（不应出现）
      </div>
    );
  }

  return (
    <div className={cn("space-y-2", className)}>
      {capabilities.map((cap, i) => (
        <div
          key={i}
          className="rounded-md border border-border bg-secondary/30 px-3 py-2"
        >
          <div className="flex items-center justify-between gap-2">
            <code className="font-mono text-sm text-foreground">{cap.tool}</code>
            <div className="flex gap-1">
              {cap.scope.map((s) => (
                <Badge key={s} variant="outline" className="text-[10px]">
                  {s}
                </Badge>
              ))}
            </div>
          </div>
          {cap.constraint && Object.keys(cap.constraint).length > 0 && (
            <div className="mt-1 flex flex-wrap gap-2 text-xs text-muted-foreground">
              {Object.entries(cap.constraint).map(([k, v]) => (
                <span
                  key={k}
                  className="rounded bg-background px-1.5 py-0.5 font-mono"
                >
                  {k}={JSON.stringify(v)}
                </span>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
