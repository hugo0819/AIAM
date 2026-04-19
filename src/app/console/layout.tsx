import type { ReactNode } from "react";
import { ConsoleNav } from "@/components/nav/ConsoleNav";

export default function ConsoleLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <ConsoleNav />
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-7xl px-8 py-10">{children}</div>
      </main>
    </div>
  );
}
