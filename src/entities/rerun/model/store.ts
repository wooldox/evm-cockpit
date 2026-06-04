"use client";
import { create } from "zustand";

/**
 * A one-shot request to re-open the originating card for a history entry,
 * prefilled with the originally-typed args. NEVER auto-executes — the user must
 * re-simulate and (for writes) sign manually. `argCount` disambiguates overloads
 * (= Object.keys(args).length, which equals the matching fn's inputs.length).
 */
export type TRerunIntent = {
  contractId: string;
  fnName: string;
  argCount: number;
  args: Record<string, string>;
  type: "read" | "simulate" | "write";
};

export type RerunState = {
  intent: TRerunIntent | null;
  request: (i: TRerunIntent) => void;
  /** Returns the current intent AND clears it (one-shot). */
  consume: () => TRerunIntent | null;
};

/**
 * Non-persisted (plain create, no persist): a re-run intent is ephemeral —
 * it exists only long enough to navigate to the browser and prime one card.
 */
export const useRerunStore = create<RerunState>()((set, get) => ({
  intent: null,
  request: (i) => set({ intent: i }),
  consume: () => {
    const i = get().intent;
    set({ intent: null });
    return i;
  },
}));
