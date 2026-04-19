"use client";

import { create } from "zustand";
import type { AuditEventData } from "@/types/events";

interface AuditState {
  events: AuditEventData[];
  streaming: boolean;
  prepend: (evts: AuditEventData[]) => void;
  push: (evt: AuditEventData) => void;
  clear: () => void;
  setStreaming: (v: boolean) => void;
}

export const useAuditStore = create<AuditState>((set) => ({
  events: [],
  streaming: false,
  prepend: (evts) =>
    set((s) => ({
      events: [
        ...evts,
        ...s.events.filter((e) => !evts.some((x) => x.id === e.id)),
      ].slice(0, 500),
    })),
  push: (evt) =>
    set((s) => {
      if (s.events.some((e) => e.id === evt.id)) return s;
      return { events: [evt, ...s.events].slice(0, 500) };
    }),
  clear: () => set({ events: [] }),
  setStreaming: (v) => set({ streaming: v }),
}));
