import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_RATES } from "./data";
import { PLAYOFF, REGULAR, solveDP, type DPResult } from "./dp";

export type Mode = "regular" | "playoff";
export interface Rates {
  r55: number;
  r65: number;
  r56: number;
}

interface ModelState {
  rates: Rates;
  setRates: (r: Rates) => void;
  resetRates: () => void;
  mode: Mode;
  setMode: (m: Mode) => void;
  isDefault: boolean;
}

const KEY = "pull-the-goalie:model";
const Ctx = createContext<ModelState | null>(null);
const LIMITS: Record<keyof Rates, [number, number]> = { r55: [0.5, 6], r65: [2, 15], r56: [5, 40] };

/** Saved slider state, or null. Browser-only: returns null during server rendering. */
function loadSaved(): { rates: Rates; mode: Mode } | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    const ok = (k: keyof Rates) =>
      typeof p?.rates?.[k] === "number" && p.rates[k] >= LIMITS[k][0] && p.rates[k] <= LIMITS[k][1];
    if (!ok("r55") || !ok("r65") || !ok("r56")) return null;
    return { rates: { r55: p.rates.r55, r65: p.rates.r65, r56: p.rates.r56 }, mode: p.mode === "playoff" ? "playoff" : "regular" };
  } catch {
    return null; // storage blocked or corrupt: use defaults
  }
}

export function ModelProvider({ children }: { children: ReactNode }) {
  // Start from the defaults on every render path (server and first client render match),
  // then restore any saved sliders after mount.
  const [rates, setRates] = useState<Rates>(DEFAULT_RATES);
  const [mode, setMode] = useState<Mode>("regular");
  const [restored, setRestored] = useState(false);
  useEffect(() => {
    const saved = loadSaved();
    if (saved) {
      setRates(saved.rates);
      setMode(saved.mode);
    }
    setRestored(true);
  }, []);
  useEffect(() => {
    if (!restored) return;
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ rates, mode }));
    } catch {
      /* storage unavailable: sliders still work for this visit */
    }
  }, [rates, mode, restored]);
  const isDefault =
    rates.r55 === DEFAULT_RATES.r55 && rates.r65 === DEFAULT_RATES.r65 && rates.r56 === DEFAULT_RATES.r56;
  const value = useMemo(
    () => ({ rates, setRates, resetRates: () => setRates(DEFAULT_RATES), mode, setMode, isDefault }),
    [rates, mode, isDefault],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useModel(): ModelState {
  const c = useContext(Ctx);
  if (!c) throw new Error("useModel outside ModelProvider");
  return c;
}

/** DP solution for the current slider rates. `forceMode` overrides the global toggle. */
export function useSolution(forceMode?: Mode): DPResult {
  const { rates, mode } = useModel();
  const m = forceMode ?? mode;
  const { r55, r65, r56 } = rates;
  return useMemo(() => solveDP({ r55, r65, r56, payoffs: m === "playoff" ? PLAYOFF : REGULAR }), [r55, r65, r56, m]);
}
