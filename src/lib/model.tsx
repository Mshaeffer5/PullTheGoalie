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

function load(): { rates: Rates; mode: Mode } {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) {
      const p = JSON.parse(raw);
      if (p && typeof p.rates?.r55 === "number" && typeof p.rates?.r65 === "number" && typeof p.rates?.r56 === "number") {
        return { rates: p.rates, mode: p.mode === "playoff" ? "playoff" : "regular" };
      }
    }
  } catch {
    /* storage unavailable: fall back to defaults */
  }
  return { rates: DEFAULT_RATES, mode: "regular" };
}

export function ModelProvider({ children }: { children: ReactNode }) {
  const initial = useMemo(load, []);
  const [rates, setRates] = useState<Rates>(initial.rates);
  const [mode, setMode] = useState<Mode>(initial.mode);
  useEffect(() => {
    try {
      window.localStorage.setItem(KEY, JSON.stringify({ rates, mode }));
    } catch {
      /* ignore */
    }
  }, [rates, mode]);
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
  return useMemo(
    () => solveDP({ ...rates, payoffs: m === "playoff" ? PLAYOFF : REGULAR }),
    [rates.r55, rates.r65, rates.r56, m], // eslint-disable-line react-hooks/exhaustive-deps
  );
}
