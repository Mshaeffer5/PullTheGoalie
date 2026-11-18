export { mss } from "./dp";

/** Signed m:ss gap, e.g. "1:57 later". */
export function gapWords(seconds: number): string {
  const a = Math.abs(Math.round(seconds));
  const t = `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
  if (a === 0) return "the same time";
  return seconds > 0 ? `${t} earlier` : `${t} later`;
}

export function fmt(x: number | null | undefined, digits = 2): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return x.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function int(x: number | null | undefined): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return Math.round(x).toLocaleString("en-US");
}

export function pct(x: number | null | undefined, digits = 1): string {
  if (x === null || x === undefined || !Number.isFinite(x)) return "—";
  return `${(x * 100).toFixed(digits)}%`;
}

export function signed(x: number, digits = 1, unit = ""): string {
  const s = Math.abs(x).toFixed(digits);
  return `${x > 0 ? "+" : x < 0 ? "−" : ""}${s}${unit}`;
}

export function pval(p: number): string {
  if (!Number.isFinite(p)) return "—";
  if (p < 0.001) return "p < 0.001";
  return `p = ${p.toFixed(3)}`;
}

/** Tick values every `step` seconds from 0 up to at least `max`. */
export function secondTicks(max: number, step: number): number[] {
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

export const DEFICIT_COLORS: Record<number, string> = { 1: "#1e3a8a", 2: "#2563eb", 3: "#60a5fa" };
export const DEFICIT_LABEL: Record<number, string> = { 1: "Down 1", 2: "Down 2", 3: "Down 3" };

/** "1:57 too late" / "0:20 too early" for an actual pull time vs the model's time (both seconds left). */
export function lateness(modelSec: number | null, actualSec: number): string {
  if (modelSec === null) return "model never pulls";
  const d = Math.round(modelSec - actualSec);
  if (d === 0) return "right on time";
  const a = Math.abs(d);
  const t = `${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
  return d > 0 ? `${t} too late` : `${t} too early`;
}
