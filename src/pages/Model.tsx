import * as Slider from "@radix-ui/react-slider";
import { useMemo, useState } from "react";
import { useSubTab } from "@/lib/nav";
import { CartesianGrid, Line, LineChart, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartTooltipBox, ResponsiveChart, Dumbbell, GRID, xLabel, yLabel } from "@/components/charts";
import { RateControls } from "@/components/RateControls";
import { SortableTable, type Column } from "@/components/SortableTable";
import { Callout, Card, cn, Note, Segmented, SectionTitle, Stat, SubTabs, Term } from "@/components/ui";
import { ACTUAL_2025, ACTUAL_PLAYOFF, DEFICITS, rates as rateData, stakes, type Deficit } from "@/lib/data";
import { EITHER, PLAYOFF, PULL, REGULAR, evaluatePolicy, solveDP, type DPResult } from "@/lib/dp";
import { DEFICIT_COLORS, DEFICIT_LABEL, fmt, lateness, mss, pct, secondTicks, signed } from "@/lib/format";
import { useModel, useSolution } from "@/lib/model";

const TABS = [
  { id: "optimal", label: "Optimal vs actual" },
  { id: "pull-now", label: "Should they pull now?" },
  { id: "hood", label: "Under the hood (for analysts)" },
  { id: "test", label: "Test case" },
];

export default function Model() {
  const sub = useSubTab();
  return (
    <div>
      <SectionTitle
        sub={
          <>
            A dynamic program works backward from the final horn, second by second, and at every score and time picks
            whichever is worth more: keeping the goalie in or pulling it. The objective is{" "}
            <Term id="points" /> in the regular season and <Term id="winprob" /> in the playoffs.
          </>
        }
      >
        When should a team pull the goalie?
      </SectionTitle>
      <div className="mb-6">
        <RateControls />
      </div>
      <SubTabs base="/model" tabs={TABS} />
      {(!sub || sub === "optimal") && <OptimalTab />}
      {sub === "pull-now" && <PullNowTab />}
      {sub === "hood" && <HoodTab />}
      {sub === "test" && <TestTab />}
    </div>
  );
}

function OptimalTab() {
  const { mode } = useModel();
  const sol = useSolution();
  const lp = sol.latestPull;
  const actual = mode === "playoff" ? ACTUAL_PLAYOFF : ACTUAL_2025;
  const actualLabel = mode === "playoff" ? `Teams' average playoff pull (${stakes.seasons[0]} to 2025–26)` : "Teams' average pull, 2025–26";
  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        {DEFICITS.map((d) => (
          <Stat
            key={d}
            accent={d === 1}
            label={`Down ${d}: model says pull at`}
            value={<span className="text-pull">{lp[d] === 900 ? "15:00+" : mss(lp[d])}</span>}
            sub={
              <>
                Teams pull at {mss(actual[d])}: {lateness(lp[d], actual[d])}.
              </>
            }
          />
        ))}
      </div>
      <Card>
        <h3 className="font-semibold">Do teams pull when the model says they should?</h3>
        <p className="mb-2 mt-1 text-[14px] text-muted">
          {mode === "playoff"
            ? "Playoff objective (win probability) against teams' actual playoff pulls."
            : "Regular-season objective (expected standings points) against 2025–26 regular-season pulls."}{" "}
          Further right = more time left = an earlier pull.
        </p>
        <Dumbbell actual={actual} model={lp} actualLabel={actualLabel} modelLabel="Model's latest optimal pull" />
        {mode === "regular" && (
          <Note>
            Teams' averages follow the course definition (first pull per game, team and deficit). Leaving out re-pulls after an
            empty-net goal, 2025–26 teams pulled at {mss(rateData.actual2025FirstOnly["1"])}, {mss(rateData.actual2025FirstOnly["2"])} and{" "}
            {mss(rateData.actual2025FirstOnly["3"])}: the gap to the model shrinks down 2 but stays large at every deficit.
          </Note>
        )}
      </Card>
      <Sensitivity />
      <RatesTable />
    </div>
  );
}

type SweepKey = "r65" | "r56" | "r55";
const SWEEPS: Record<SweepKey, { label: string; min: number; max: number; step: number }> = {
  r65: { label: "Pulled offense (6v5)", min: 2, max: 14, step: 0.5 },
  r56: { label: "Empty-net defense (5v6)", min: 10, max: 34, step: 1 },
  r55: { label: "5v5 rate", min: 1, max: 4.5, step: 0.25 },
};

function Sensitivity() {
  const { rates, mode } = useModel();
  const [key, setKey] = useState<SweepKey>("r65");
  const spec = SWEEPS[key];
  const data = useMemo(() => {
    const out = [];
    const payoffs = mode === "playoff" ? PLAYOFF : REGULAR;
    for (let x = spec.min; x <= spec.max + 1e-9; x += spec.step) {
      const lp = solveDP({ ...rates, [key]: x, payoffs }).latestPull;
      out.push({ x: Math.round(x * 100) / 100, d1: lp[1], d2: lp[2], d3: lp[3] });
    }
    return out;
  }, [key, rates, mode, spec]);
  const ticks = secondTicks(900, 180);
  const actual1 = mode === "playoff" ? ACTUAL_PLAYOFF[1] : ACTUAL_2025[1];
  const breakEven = data.find((p) => (p.d1 ?? 0) >= actual1);
  return (
    <Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-semibold">How robust is "pull earlier"?</h3>
          <p className="text-[14px] text-muted">
            The model's latest pull time as one rate varies and the other two stay at the slider values.
          </p>
        </div>
        <Segmented
          label="Rate to vary"
          value={key}
          onChange={setKey}
          options={(Object.keys(SWEEPS) as SweepKey[]).map((k) => ({ value: k, label: SWEEPS[k].label }))}
        />
      </div>
      <ResponsiveChart height={360}>
        <LineChart data={data} margin={{ top: 26, right: 24, bottom: 28, left: 4 }}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="x"
            type="number"
            domain={[spec.min, spec.max]}
            tick={AXIS}
            tickCount={7}
            label={xLabel(`${spec.label}, goals per 60`)}
          />
          <YAxis tick={AXIS} ticks={ticks} domain={[0, 900]} tickFormatter={(v: number) => mss(v)} width={76} label={yLabel("Latest optimal pull (m:ss)")} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as { x: number; d1: number; d2: number; d3: number };
              return (
                <ChartTooltipBox
                  title={`${spec.label} = ${fmt(p.x)}`}
                  lines={DEFICITS.map((d) => ({ color: DEFICIT_COLORS[d], text: `${DEFICIT_LABEL[d]}: pull at ${mss(p[`d${d}` as "d1"])}` }))}
                />
              );
            }}
          />
          <ReferenceLine x={rates[key]} stroke="#dc2626" strokeDasharray="4 3" label={{ value: "current", position: "top", fontSize: 12, fill: "#dc2626" }} />
          {DEFICITS.map((d) => (
            <Line key={d} dataKey={`d${d}`} stroke={DEFICIT_COLORS[d]} strokeWidth={2.5} dot={false} isAnimationActive={false} name={DEFICIT_LABEL[d]} />
          ))}
        </LineChart>
      </ResponsiveChart>
      <div className="flex flex-wrap gap-4 text-[13px] text-muted">
        {DEFICITS.map((d) => (
          <span key={d} className="inline-flex items-center gap-2">
            <span className="inline-block h-0.5 w-6" style={{ background: DEFICIT_COLORS[d] }} />
            {DEFICIT_LABEL[d]}
          </span>
        ))}
        <span>Times are capped at the 15:00 horizon.</span>
      </div>
      {key === "r65" && breakEven && (
        <Note>
          The model's down-1 pull comes earlier than teams' {mss(actual1)} average for any 6v5 rate of about{" "}
          {fmt(breakEven.x, 1)} goals per 60 or more. We measure {fmt(rateData.chosen.r65)}, so the conclusion survives
          very large errors in that estimate.
        </Note>
      )}
      {key !== "r65" && <Note>Each point is a full re-solve of the DP at that rate.</Note>}
    </Card>
  );
}

function RatesTable() {
  type Opt = (typeof rateData.options)[number];
  const cols: Column<Opt>[] = [
    { key: "id", label: "Option", render: (r) => (r.chosen ? <strong>{r.id} (site default)</strong> : r.id) },
    { key: "label", label: "How the rates are combined", render: (r) => r.label, className: "whitespace-normal min-w-[16rem]" },
    { key: "r55", label: "5v5", align: "right", render: (r) => fmt(r.r55) },
    { key: "r65", label: "6v5", align: "right", render: (r) => fmt(r.r65) },
    { key: "r56", label: "5v6", align: "right", render: (r) => fmt(r.r56) },
    ...DEFICITS.map((d) => ({
      key: `l${d}`,
      label: `Down ${d}`,
      tip: "Latest optimal pull time, regular-season objective.",
      align: "right" as const,
      render: (r: Opt) => mss(r.latest[String(d) as "1"]),
    })),
  ];
  return (
    <Card>
      <h3 className="font-semibold">Where the default rates come from, and what the alternatives would say</h3>
      <p className="mb-3 mt-1 text-[14px] text-muted">
        All from 2025–26 play. Our default (option B) uses 5v5 play from the 3rd period, when players are tired and the
        game state is closest to a pull decision, and <Term id="context">pull context</Term> for the two goalie-out rates
        so <Term id="delayed">delayed-penalty</Term> seconds don't make the empty net look safer than it is. Option D
        shows what happens without that fix. Rates in goals per 60.
      </p>
      <SortableTable columns={cols} rows={rateData.options} rowKey={(r) => r.id} rowClass={(r) => (r.chosen ? "bg-brand-light/40" : undefined)} />
      <Note>
        Under every option, teams pull later than the model says at every deficit. Full reasoning is on the About &amp; method
        page.
      </Note>
    </Card>
  );
}

function PullNowTab() {
  const { rates, mode } = useModel();
  const sol = useSolution();
  const [deficit, setDeficit] = useState<Deficit>(1);
  const [t, setT] = useState(180);
  const dec = sol.decision[t][8 - deficit];
  const latest = sol.latestPull[deficit];
  const usual = mode === "playoff" ? ACTUAL_PLAYOFF : ACTUAL_2025;
  const actual = usual[deficit];
  const payoffs = mode === "playoff" ? PLAYOFF : REGULAR;
  const i = 8 - deficit;
  const vModel = sol.value[t][i];
  const vUsual = useMemo(
    () => evaluatePolicy({ ...rates, payoffs, horizon: t }, (k) => usual[Math.min(k, 3) as Deficit])[i],
    [rates, payoffs, t, i, usual],
  );
  const vNever = useMemo(() => evaluatePolicy({ ...rates, payoffs, horizon: t }, () => null)[i], [rates, payoffs, t, i]);
  const show = (x: number) => (mode === "playoff" ? pct(x, 1) : `${fmt(x, 3)} pts`);
  const diff = (x: number) => (mode === "playoff" ? `${signed((vModel - x) * 100, 1)} points of win chance` : `${signed(vModel - x, 3)} pts`);
  const unit = mode === "playoff" ? "chance to win from here" : "expected standings points from here";
  const W = 1000;
  const X = (s: number) => 40 + ((900 - s) / 900) * (W - 80);
  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-wrap items-center gap-4">
          <Segmented label="Deficit" value={deficit} onChange={setDeficit} options={DEFICITS.map((d) => ({ value: d, label: DEFICIT_LABEL[d] }))} />
          <div className="min-w-[260px] flex-1">
            <div className="flex justify-between text-sm">
              <span className="font-medium">Time left in the 3rd</span>
              <span className="font-semibold tabular-nums">{mss(t)}</span>
            </div>
            <Slider.Root
              className="relative mt-2 flex h-5 w-full touch-none select-none items-center"
              min={5}
              max={900}
              step={5}
              value={[900 - t + 5]}
              onValueChange={([v]) => setT(900 - v + 5)}
              aria-label="Time left in the third period"
            >
              <Slider.Track className="relative h-1.5 grow rounded-full bg-line">
                <Slider.Range className="absolute h-full rounded-full bg-brand" />
              </Slider.Track>
              <Slider.Thumb
                aria-label="Time left in the third period"
                aria-valuetext={`${mss(t)} left`}
                className="block h-5 w-5 rounded-full border-2 border-brand bg-white shadow focus:outline-none focus:ring-2 focus:ring-brand/40"
              />
            </Slider.Root>
            <div className="mt-1 flex justify-between text-[12px] text-muted">
              <span>15:00</span>
              <span>0:05</span>
            </div>
          </div>
        </div>
        <div
          className={cn(
            "mt-5 rounded-xl px-5 py-4 text-center",
            dec === PULL ? "bg-pull-light text-pull" : dec === EITHER ? "bg-ice text-ink" : "bg-brand-light text-brand-dark",
          )}
        >
          <div className="text-[13px] font-semibold uppercase tracking-wide">
            Down {deficit} with {mss(t)} left
          </div>
          <div className="mt-1 text-3xl font-bold">
            {dec === PULL ? "Pull the goalie now" : dec === EITHER ? "Either: nothing left to lose" : "Keep the goalie in for now"}
          </div>
        </div>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <Stat accent label="Follow the model" value={show(vModel)} sub={`${unit}; pull at ${mss(latest)}`} />
          <Stat label="Pull at teams' usual time" value={show(vUsual)} sub={`pull at ${mss(actual)}; the model gains ${diff(vUsual)}`} />
          <Stat label="Never pull" value={show(vNever)} sub={`the model gains ${diff(vNever)}`} />
        </div>
        <svg viewBox={`0 0 ${W} 92`} className="mt-5 h-auto w-full" role="img" aria-label="Pull window on the clock">
          <rect x={40} y={30} width={W - 80} height={18} rx={4} fill="#e2e8f0" />
          {latest != null && <rect x={X(latest)} y={30} width={X(0) - X(latest)} height={18} rx={4} fill="#fecaca" />}
          {[900, 720, 540, 360, 180, 0].map((s) => (
            <text key={s} x={X(s)} y={68} textAnchor="middle" fontSize="13" fill="#475569">
              {mss(s)}
            </text>
          ))}
          <line x1={X(actual)} x2={X(actual)} y1={24} y2={54} stroke="#475569" strokeWidth={2} strokeDasharray="3 2" />
          <text x={X(actual)} y={18} textAnchor="middle" fontSize="12" fill="#475569">
            teams' average
          </text>
          <line x1={X(t)} x2={X(t)} y1={24} y2={54} stroke="#1d4ed8" strokeWidth={3} />
          <text x={X(t)} y={86} textAnchor="middle" fontSize="12" fontWeight="600" fill="#1d4ed8">
            you are here
          </text>
        </svg>
        <Note>
          Red band: the model's pull window for this deficit (pulling is optimal from {mss(latest)} to the horn). Each card is
          the expected value from this moment if the team follows that plan, including re-pulling at a deeper deficit after
          an empty-net goal. Differences are per game; they add up over a season (see Deeper dives → Value of pulling).
        </Note>
      </Card>
    </div>
  );
}

function HoodTab() {
  const { mode, rates } = useModel();
  const sol = useSolution();
  const [step, setStep] = useState<15 | 30>(30);
  const [win, setWin] = useState<300 | 600 | 900>(600);
  const cols = useMemo(() => Array.from({ length: win / step + 1 }, (_, i) => win - i * step), [win, step]);
  const diffs = [2, 1, 0, -1, -2, -3, -4];
  const pay = mode === "playoff" ? PLAYOFF : REGULAR;
  return (
    <div className="space-y-6">
      <Card>
        <h3 className="text-lg font-semibold">The algorithm</h3>
        <div className="prose-site mt-2">
          <p>
            <strong>State.</strong> Goal difference d from our side (ours minus theirs), from −8 to +8 and clamped at the
            ends, and time left t in the third period, in one-second steps (dt = 1) from 0:00 back to 15:00. The site solves
            the full 901 × 17 grid every time a slider moves; the tables below show every {step} seconds.
          </p>
          <p>
            <strong>Per-step probabilities.</strong> Scoring is a Poisson process, so in one second at most one goal is
            scored. A rate r in goals per 60 minutes becomes a per-second probability p = r × dt / 3600. Goalie in: each
            team scores with p55 = {fmt(rates.r55)}/3600. Goalie pulled: we score with p65 = {fmt(rates.r65)}/3600 and they
            score with p56 = {fmt(rates.r56)}/3600.
          </p>
          <p>
            <strong>Terminal payoffs.</strong> At 0:00 the value is {pay.win} if ahead, {pay.tie} if tied and {pay.loss} if
            behind ({mode === "playoff" ? "win probability: playoff overtime is a coin flip with no loser point" : "standings points: a tie means overtime, worth 1 point plus an even chance at the second"}).
          </p>
          <p>
            <strong>Backward step.</strong> For t = 1, 2, …, 900, using the values one second closer to the horn:
          </p>
          <pre className="formula">{`V_stay(t,d) = p55·V(t−1,d+1) + p55·V(t−1,d−1) + (1 − 2·p55)·V(t−1,d)
V_pull(t,d) = p65·V(t−1,d+1) + p56·V(t−1,d−1) + (1 − p65 − p56)·V(t−1,d)
V(t,d)      = max( V_stay(t,d), V_pull(t,d) )
decision    = Pull if V_pull − V_stay > 1e−12, Either if |difference| ≤ 1e−12, else Don't pull`}</pre>
          <p>
            <strong>Reading off the critical times.</strong> For a deficit k, the latest pull time is the largest t whose
            decision at d = −k is Pull. From that moment to the horn, pulling stays optimal. Right now: down 1{" "}
            <strong>{mss(sol.latestPull[1])}</strong>, down 2 <strong>{mss(sol.latestPull[2])}</strong>, down 3{" "}
            <strong>{mss(sol.latestPull[3])}</strong>. "Either" appears only in the last second or two when down 2 or more,
            where no goal can change the result.
          </p>
          <p>
            <strong>Assumptions.</strong> Only our team decides (the opponent never pulls); no penalties; rates don't depend on
            the score except through the pull; the goalie can come back and go out freely, because the choice is re-made every
            second. Source code: <code>src/lib/dp.ts</code>, checked against a Python reference (<code>analysis/dp.py</code>)
            to 1e−12.
          </p>
        </div>
      </Card>
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Segmented label="Column step" value={step} onChange={setStep} options={[{ value: 15, label: "Every 15 s" }, { value: 30, label: "Every 30 s" }]} />
          <Segmented
            label="Window"
            value={win}
            onChange={setWin}
            options={[
              { value: 300, label: "Last 5 min" },
              { value: 600, label: "Last 10 min" },
              { value: 900, label: "Last 15 min" },
            ]}
          />
        </div>
        <h3 className="font-semibold">Value grid: {mode === "playoff" ? "win probability" : "expected standings points"}</h3>
        <p className="mb-2 text-[13px] text-muted">
          Rows: goal difference. Columns: time left (m:ss). Shaded cells: pulling is optimal there. Every cell is read from
          the one-second solution.
        </p>
        <Grid sol={sol} cols={cols} diffs={diffs} kind="value" />
        <h3 className="mt-6 font-semibold">Decision grid</h3>
        <p className="mb-2 text-[13px] text-muted">Pull region in red. "—" = keep the goalie in.</p>
        <Grid sol={sol} cols={cols} diffs={diffs} kind="decision" />
      </Card>
    </div>
  );
}

function Grid({ sol, cols, diffs, kind }: { sol: DPResult; cols: number[]; diffs: number[]; kind: "value" | "decision" }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-line">
      <table className="border-collapse text-[12.5px] tabular-nums">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 border-b-2 border-slate-300 bg-ice px-2 py-1.5 text-left font-semibold">Goal diff</th>
            {cols.map((t) => (
              <th key={t} className="border-b-2 border-slate-300 bg-ice px-2 py-1.5 text-right font-semibold">
                {mss(t)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {diffs.map((d) => (
            <tr key={d}>
              <th scope="row" className="sticky left-0 z-10 whitespace-nowrap border-b border-line bg-white px-2 py-1 text-left font-semibold">
                {d > 0 ? `+${d}` : d === 0 ? "0 (tied)" : `${d}`}
              </th>
              {cols.map((t) => {
                const dec = t === 0 ? 0 : sol.decision[t][d + 8];
                const isPull = dec === PULL;
                return (
                  <td
                    key={t}
                    className={cn(
                      "border-b border-line px-2 py-1 text-right",
                      isPull && (kind === "decision" ? "bg-pull font-semibold text-white" : "bg-pull-light"),
                    )}
                  >
                    {kind === "value" ? sol.value[t][d + 8].toFixed(3) : t === 0 ? "horn" : isPull ? "Pull" : dec === EITHER ? "Either" : "—"}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TestTab() {
  const res = useMemo(() => solveDP({ r55: 3, r65: 8, r56: 20, horizon: 900, cap: 8, dt: 1, payoffs: REGULAR }), []);
  const expected = rateData.testCase.expected;
  type Row = { d: Deficit; exp: number; got: number | null };
  const rows: Row[] = DEFICITS.map((d) => ({ d, exp: expected[String(d) as "1"], got: res.latestPull[d] }));
  const ok = rows.every((r) => r.got === r.exp);
  const cols: Column<Row>[] = [
    { key: "d", label: "Deficit", render: (r) => DEFICIT_LABEL[r.d] },
    { key: "exp", label: "Expected latest pull (handout)", align: "right", render: (r) => mss(r.exp) },
    { key: "got", label: "This site's DP", tip: "Computed live by the same solveDP function the rest of the site uses.", align: "right", render: (r) => mss(r.got) },
    {
      key: "diff",
      label: "Difference",
      align: "right",
      render: (r) => (r.got === null ? "—" : r.got === r.exp ? "0:00 ✓" : mss(r.got - r.exp)),
    },
  ];
  return (
    <Card>
      <h3 className="font-semibold">Verification against the course test case</h3>
      <p className="mb-3 mt-1 text-[14px] text-muted">
        Inputs (deliberately round, not estimates): 5v5 = 3.0, 6v5 = 8.0, 5v6 = 20.0 goals per 60; payoffs 2 / 1.5 / 0;
        horizon 15:00; goal-difference cap ±8; dt = 1 second. These ignore the sliders.
      </p>
      <SortableTable columns={cols} rows={rows} rowKey={(r) => String(r.d)} />
      <div className="mt-4">
        <Callout tone={ok ? "finding" : "info"}>
          {ok ? "All three differences are zero: the site's DP reproduces the test case exactly." : "Mismatch: the DP does not reproduce the test case."}
        </Callout>
      </div>
      <Note>
        The same code also passes seven parity checks against the Python reference implementation (values within 1e−12,
        identical decisions), run with <code>npm test</code>.
      </Note>
    </Card>
  );
}
