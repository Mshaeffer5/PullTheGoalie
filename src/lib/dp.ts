/**
 * Pull-the-goalie dynamic program — TypeScript port of analysis/dp.py.
 *
 * State: goal difference d (ours minus theirs), clamped to [-cap, cap].
 * Time: seconds left t = 0, dt, ..., horizon, solved backward from the horn.
 * Each step at most one goal; a rate in goals per 60 becomes rate × dt / 3600.
 * Terminal payoff at 0:00: win / tie / loss (regular season 2 / 1.5 / 0,
 * playoffs 1 / 0.5 / 0 = win probability).
 * At every (t, d) the team takes the better of keeping the goalie in or pulling it.
 *
 * src/lib/dp.test.ts checks this file against fixtures written by the Python version.
 */

export type Decision = 0 | 1 | 2; // 0 = don't pull, 1 = pull, 2 = either (exact tie)
export const STAY: Decision = 0;
export const PULL: Decision = 1;
export const EITHER: Decision = 2;
export const TIE_EPS = 1e-12;

export interface Payoffs {
  win: number;
  tie: number;
  loss: number;
}
export const REGULAR: Payoffs = { win: 2, tie: 1.5, loss: 0 };
export const PLAYOFF: Payoffs = { win: 1, tie: 0.5, loss: 0 };

export interface DPInput {
  /** Goals per 60 for each team with both goalies in. */
  r55: number;
  /** Our goals per 60 with the goalie pulled (6v5). A function of seconds left for the lines extension. */
  r65: number | ((secLeft: number) => number);
  /** Their goals per 60 into our empty net (5v6). */
  r56: number;
  horizon?: number;
  cap?: number;
  dt?: number;
  payoffs?: Payoffs;
}

export interface DPResult {
  /** Goal differences from -cap to +cap. */
  diffs: number[];
  dt: number;
  /** value[k][i]: expected payoff with k·dt seconds left at goal difference diffs[i]. */
  value: Float64Array[];
  /** decision[k][i]: optimal choice with k·dt seconds left. Row 0 (the horn) is all STAY. */
  decision: Uint8Array[];
  /** Latest time (seconds left) at which pulling is optimal, by deficit 1..cap; null = never. */
  latestAll: Record<number, number | null>;
  latestPull: { 1: number | null; 2: number | null; 3: number | null };
}

function terminal(diffs: number[], p: Payoffs): Float64Array {
  return Float64Array.from(diffs, (d) => (d > 0 ? p.win : d === 0 ? p.tie : p.loss));
}

export function solveDP(input: DPInput): DPResult {
  const horizon = input.horizon ?? 900;
  const cap = input.cap ?? 8;
  const dt = input.dt ?? 1;
  const payoffs = input.payoffs ?? REGULAR;
  const n = 2 * cap + 1;
  const diffs = Array.from({ length: n }, (_, i) => i - cap);
  const steps = Math.floor(horizon / dt);
  const p55 = (input.r55 * dt) / 3600;
  const p56 = (input.r56 * dt) / 3600;
  const r65 = input.r65;

  const value: Float64Array[] = new Array(steps + 1);
  const decision: Uint8Array[] = new Array(steps + 1);
  let v = terminal(diffs, payoffs);
  value[0] = v;
  decision[0] = new Uint8Array(n);

  for (let k = 1; k <= steps; k++) {
    const t = k * dt;
    const rate65 = typeof r65 === "function" ? r65(t) : r65;
    const p65 = (rate65 * dt) / 3600;
    const next = new Float64Array(n);
    const dec = new Uint8Array(n);
    for (let i = 0; i < n; i++) {
      const up = v[i === n - 1 ? i : i + 1];
      const down = v[i === 0 ? i : i - 1];
      const here = v[i];
      const stay = p55 * up + p55 * down + (1 - 2 * p55) * here;
      const pull = p65 * up + p56 * down + (1 - p65 - p56) * here;
      const diff = pull - stay;
      dec[i] = diff > TIE_EPS ? PULL : diff < -TIE_EPS ? STAY : EITHER;
      next[i] = Math.max(pull, stay);
    }
    v = next;
    value[k] = next;
    decision[k] = dec;
  }

  const latestAll: Record<number, number | null> = {};
  for (let deficit = 1; deficit <= cap; deficit++) {
    const i = cap - deficit;
    let latest: number | null = null;
    for (let k = steps; k >= 1; k--) {
      if (decision[k][i] === PULL) {
        latest = k * dt;
        break;
      }
    }
    latestAll[deficit] = latest;
  }
  return {
    diffs,
    dt,
    value,
    decision,
    latestAll,
    latestPull: { 1: latestAll[1], 2: latestAll[2], 3: latestAll[3] },
  };
}

/**
 * Value of a fixed threshold policy: when trailing by k, the goalie is pulled once
 * seconds left <= pullFrom(k) (null = never). Tied or leading: never pull.
 * Returns the value row at the horizon (one entry per goal difference).
 */
export function evaluatePolicy(
  input: Omit<DPInput, "r65"> & { r65: number },
  pullFrom: (deficit: number) => number | null,
): Float64Array {
  const horizon = input.horizon ?? 900;
  const cap = input.cap ?? 8;
  const dt = input.dt ?? 1;
  const payoffs = input.payoffs ?? REGULAR;
  const n = 2 * cap + 1;
  const diffs = Array.from({ length: n }, (_, i) => i - cap);
  const thresholds = diffs.map((d) => (d < 0 ? pullFrom(-d) : null));
  const p55 = (input.r55 * dt) / 3600;
  const p65 = (input.r65 * dt) / 3600;
  const p56 = (input.r56 * dt) / 3600;
  let v = terminal(diffs, payoffs);
  const steps = Math.floor(horizon / dt);
  for (let k = 1; k <= steps; k++) {
    const t = k * dt;
    const next = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      const up = v[i === n - 1 ? i : i + 1];
      const down = v[i === 0 ? i : i - 1];
      const here = v[i];
      const th = thresholds[i];
      next[i] =
        th !== null && t <= th
          ? p65 * up + p56 * down + (1 - p65 - p56) * here
          : p55 * up + p55 * down + (1 - 2 * p55) * here;
    }
    v = next;
  }
  return v;
}

/** Forward line on the ice with `secLeft` seconds left, counting back from the horn. */
export function lineAt(secLeft: number, blocks: { line: number; seconds: number }[]): number {
  const cycle = blocks.reduce((s, b) => s + b.seconds, 0);
  let x = (secLeft - 1) % cycle;
  for (const b of blocks) {
    if (x < b.seconds) return b.line;
    x -= b.seconds;
  }
  return blocks[blocks.length - 1].line;
}

/**
 * 6v5 rate as a function of seconds left (lines extension): the best line covers the last block
 * before the horn, the next-best line the block before, and so on. Before that final rotation the
 * line on the ice is unknown, so the overall 6v5 rate applies.
 */
export function lineRateFn(
  lineRates: Record<number, number>,
  baseRate: number,
  blocks: { line: number; seconds: number }[],
): (secLeft: number) => number {
  const total = blocks.reduce((s, b) => s + b.seconds, 0);
  return (t) => (t <= total ? lineRates[lineAt(t, blocks)] : baseRate);
}

/** Seconds -> "m:ss". */
export function mss(seconds: number | null | undefined): string {
  if (seconds === null || seconds === undefined || !Number.isFinite(seconds)) return "—";
  const s = Math.round(seconds);
  const sign = s < 0 ? "−" : "";
  const a = Math.abs(s);
  return `${sign}${Math.floor(a / 60)}:${String(a % 60).padStart(2, "0")}`;
}
