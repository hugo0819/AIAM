"use client";

import { create } from "zustand";
import type { RiskAlertData } from "@/types/events";

export interface EnrichedAlert extends RiskAlertData {
  agentName?: string;
  agentId?: string;
  passportStatus?: string;
  passportRevoked?: boolean;
}

interface RiskState {
  alerts: EnrichedAlert[];
  streaming: boolean;
  setAlerts: (xs: EnrichedAlert[]) => void;
  upsert: (a: EnrichedAlert) => void;
  markAck: (id: string) => void;
  setStreaming: (v: boolean) => void;
}

export const useRiskStore = create<RiskState>((set) => ({
  alerts: [],
  streaming: false,
  setAlerts: (xs) => set({ alerts: xs }),
  upsert: (a) =>
    set((s) => {
      const idx = s.alerts.findIndex((x) => x.id === a.id);
      if (idx >= 0) {
        const next = [...s.alerts];
        next[idx] = { ...next[idx], ...a };
        return { alerts: next };
      }
      return { alerts: [a, ...s.alerts].slice(0, 200) };
    }),
  markAck: (id) =>
    set((s) => ({
      alerts: s.alerts.map((x) => (x.id === id ? { ...x, acknowledged: true } : x)),
    })),
  setStreaming: (v) => set({ streaming: v }),
}));
