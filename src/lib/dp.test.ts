import { describe, expect, it } from "vitest";
import fixtures from "./dp.fixtures.json";
import { EITHER, PLAYOFF, PULL, REGULAR, evaluatePolicy, lineAt, lineRateFn, mss, solveDP } from "./dp";
import lines from "../data/lines.json";

const blocks = lines.blocks;
const lineRates: Record<number, number> = Object.fromEntries(
  Object.entries(fixtures.lineRates).map(([k, v]) => [Number(k), v as number]),
);

describe("handout test case", () => {
  it("returns 4:00 / 8:15 / 12:33 at 3.0 / 8.0 / 20.0, dt = 1 s", () => {
    const res = solveDP({ r55: 3, r65: 8, r56: 20 });
    expect(res.latestPull).toEqual({ 1: 240, 2: 495, 3: 753 });
    expect([1, 2, 3].map((d) => mss(res.latestPull[d as 1 | 2 | 3]))).toEqual(["4:00", "8:15", "12:33"]);
  });
});

describe("parity with the Python reference (analysis/dp.py)", () => {
  for (const c of fixtures.cases) {
    it(c.name, () => {
      const payoffs = c.payoffs[0] === 1 ? PLAYOFF : REGULAR;
      const r65 = c.lines ? lineRateFn(lineRates, c.r65, blocks) : c.r65;
      const res = solveDP({ r55: c.r55, r65, r56: c.r56, payoffs });
      expect(res.latestPull).toEqual({ 1: c.latest["1"], 2: c.latest["2"], 3: c.latest["3"] });
      for (const s of c.samples) {
        const i = s.d + 8;
        expect(Math.abs(res.value[s.t][i] - s.v)).toBeLessThan(1e-12);
        expect(res.decision[s.t][i]).toBe(s.dec);
      }
    });
  }

  it("fixed-threshold policy values", () => {
    const def = fixtures.cases.find((c) => c.name === "site defaults")!;
    const th = fixtures.policy.thresholds as Record<string, number>;
    const v = evaluatePolicy({ r55: def.r55, r65: def.r65, r56: def.r56 }, (k) => th[String(Math.min(k, 3))]);
    fixtures.policy.v900.forEach((x, i) => expect(Math.abs(v[i] - x)).toBeLessThan(1e-12));
  });
});

describe("properties", () => {
  it("values stay within the payoff range", () => {
    for (const payoffs of [REGULAR, PLAYOFF]) {
      const res = solveDP({ r55: 2.35, r65: 7.1, r56: 21.78, payoffs });
      for (const row of res.value) for (const x of row) {
        expect(x).toBeGreaterThanOrEqual(-1e-12);
        expect(x).toBeLessThanOrEqual(payoffs.win + 1e-12);
      }
    }
  });

  it("pull region is one block per deficit (ties at the horn allowed)", () => {
    const res = solveDP({ r55: 3, r65: 8, r56: 20 });
    for (const d of [1, 2, 3] as const) {
      const latest = res.latestPull[d]!;
      for (let k = 1; k <= latest; k++) expect([PULL, EITHER]).toContain(res.decision[k][8 - d]);
      for (let k = latest + 1; k <= 900; k++) expect(res.decision[k][8 - d]).not.toBe(PULL);
    }
  });

  it("a higher 6v5 rate never makes the pull later", () => {
    let prev = [0, 0, 0];
    for (const r65 of [4, 6, 8, 10, 12]) {
      const lp = solveDP({ r55: 2.35, r65, r56: 21.78 }).latestPull;
      const cur = [lp[1]!, lp[2]!, lp[3]!];
      cur.forEach((x, i) => expect(x).toBeGreaterThanOrEqual(prev[i]));
      prev = cur;
    }
  });

  it("line schedule counts back from the horn", () => {
    expect([1, 44, 45, 84, 85, 122, 123, 158, 159].map((t) => lineAt(t, blocks))).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 1]);
  });

  it("formats m:ss", () => {
    expect(mss(0)).toBe("0:00");
    expect(mss(231)).toBe("3:51");
    expect(mss(null)).toBe("—");
  });
});
