"use client";

import { create } from "zustand";

interface DemoState {
  /** 当前活跃的通行证 id（S1 签发后填入，后续场景复用）。 */
  currentPassportId: string | null;
  setCurrentPassportId: (id: string | null) => void;

  /** 派生出的子通行证 id（S6 使用）。 */
  derivedPassportId: string | null;
  setDerivedPassportId: (id: string | null) => void;
}

const g = globalThis as unknown as { __demoStore?: unknown };

export const useDemoStore = create<DemoState>((set) => ({
  currentPassportId:
    typeof window !== "undefined"
      ? window.localStorage.getItem("demo:currentPassportId")
      : null,
  setCurrentPassportId: (id) => {
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem("demo:currentPassportId", id);
      else window.localStorage.removeItem("demo:currentPassportId");
    }
    set({ currentPassportId: id });
  },
  derivedPassportId:
    typeof window !== "undefined"
      ? window.localStorage.getItem("demo:derivedPassportId")
      : null,
  setDerivedPassportId: (id) => {
    if (typeof window !== "undefined") {
      if (id) window.localStorage.setItem("demo:derivedPassportId", id);
      else window.localStorage.removeItem("demo:derivedPassportId");
    }
    set({ derivedPassportId: id });
  },
}));

void g;
