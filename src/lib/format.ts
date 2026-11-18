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

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen"];
/** A plain-English length of time, e.g. 117 s → "nearly two minutes", 220 s → "nearly four minutes", 70 s → "just over a minute". */
export function approxDuration(seconds: number): string {
  const s = Math.abs(Math.round(seconds));
  if (s < 50) return `${s} seconds`;
  const m = s / 60;
  const whole = Math.floor(m);
  const frac = m - whole;
  const w = (n: number) => (n === 1 ? "a minute" : `${WORDS[n] ?? n} minutes`);
  if (frac >= 0.5) return `nearly ${w(whole + 1)}`;
  if (frac < 0.15) return whole === 1 ? "about a minute" : `about ${w(whole)}`;
  return whole === 1 ? "just over a minute" : `more than ${w(whole)}`;
}

/** "2026-10-04" → "Oct 4, 2026" (no time zones involved). */
export function friendlyDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${months[m - 1]} ${d}, ${y}`;
}

/** Round, evenly spaced ticks (step 1, 2, 5 × 10^k) from 0 up to at least `max`. */
export function niceTicks(max: number, target = 5): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / target;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 5, 10].map((f) => f * mag).find((x) => x >= raw) ?? 10 * mag;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => Math.round(i * step * 1e9) / 1e9);
}

/** Display a signed goal difference with a true minus sign. */
export function goalDiff(d: number): string {
  return d > 0 ? `+${d}` : d === 0 ? "0 (tied)" : `−${-d}`;
}

/** Team names as they were in each era (abbreviation → name). */
export const TEAM_NAME: Record<string, string> = {
  ANA: "Anaheim", ARI: "Arizona", ATL: "Atlanta", BOS: "Boston", BUF: "Buffalo", CAR: "Carolina", CBJ: "Columbus",
  CGY: "Calgary", CHI: "Chicago", COL: "Colorado", DAL: "Dallas", DET: "Detroit", EDM: "Edmonton", FLA: "Florida",
  LAK: "Los Angeles", MIN: "Minnesota", MTL: "Montreal", NJD: "New Jersey", NSH: "Nashville", NYI: "NY Islanders",
  NYR: "NY Rangers", OTT: "Ottawa", PHI: "Philadelphia", PHX: "Phoenix", PIT: "Pittsburgh", SEA: "Seattle",
  SJS: "San Jose", STL: "St. Louis", TBL: "Tampa Bay", TOR: "Toronto", UTA: "Utah", VAN: "Vancouver", VGK: "Vegas",
  WPG: "Winnipeg", WSH: "Washington",
};
export const teamName = (abbr: string) => TEAM_NAME[abbr] ?? abbr;
