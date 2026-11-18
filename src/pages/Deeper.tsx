import { useMemo, useState } from "react";
import { useSubTab } from "@/lib/nav";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Line,
  LineChart,
  ReferenceLine,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
  ZAxis,
} from "recharts";
import { AXIS, ChartTooltipBox, ResponsiveChart, GRID, xLabel, yLabel } from "@/components/charts";
import { RateControls } from "@/components/RateControls";
import { SortableTable, type Column } from "@/components/SortableTable";
import { Callout, Card, InfoDot, Note, Segmented, SectionTitle, Stat, SubTabs, Term } from "@/components/ui";
import { DEFICITS, lines, outcomes, rates as rateData, stakes, teams, value, type Deficit } from "@/lib/data";
import { PLAYOFF, REGULAR, evaluatePolicy, lineAt, lineRateFn, solveDP } from "@/lib/dp";
import { DEFICIT_LABEL, fmt, int, mss, pct, pval, secondTicks, signed } from "@/lib/format";
import { useIsNarrow } from "@/lib/hooks";
import { useModel, useSolution } from "@/lib/model";

const TABS = [
  { id: "value", label: "Value of pulling" },
  { id: "teams", label: "Teams" },
  { id: "lines", label: "Line changes" },
  { id: "outcomes", label: "After the pull" },
  { id: "stakes", label: "Do stakes matter?" },
];

export default function Deeper() {
  const sub = useSubTab();
  return (
    <div>
      <SectionTitle sub="Five follow-up questions the data and the model can answer. Tabs that use the model respond to the scoring-rate sliders.">
        Deeper dives
      </SectionTitle>
      <SubTabs base="/deeper" tabs={TABS} />
      {(!sub || sub === "value") && <ValueTab />}
      {sub === "teams" && <TeamsTab />}
      {sub === "lines" && <LinesTab />}
      {sub === "outcomes" && <OutcomesTab />}
      {sub === "stakes" && <StakesTab />}
    </div>
  );
}

/* ------------------------------------------------------------------ value */

function ValueTab() {
  const { rates, isDefault } = useModel();
  const calc = useMemo(() => {
    const th = value.actualThresholds as Record<string, number>;
    const opt = solveDP({ ...rates, payoffs: REGULAR }).value[900];
    const act = evaluatePolicy(rates, (k) => th[String(Math.min(k, 3))]);
    const never = evaluatePolicy(rates, () => null);
    let o = 0;
    let a = 0;
    let n = 0;
    const by = value.freq.map((f) => {
      const i = f.d + 8;
      o += f.share * opt[i];
      a += f.share * act[i];
      n += f.share * never[i];
      return { d: f.d, share: f.share, opt: opt[i], act: act[i], never: never[i], gain82: 82 * f.share * (opt[i] - act[i]) };
    });
    return { o, a, n, by };
  }, [rates]);
  const g = (x: number) => 82 * x;
  const rows = calc.by.filter((r) => r.d >= -3 && r.d <= 2).reverse();
  type Row = (typeof rows)[number];
  const cols: Column<Row>[] = [
    { key: "d", label: "Score with 15:00 left", render: (r) => (r.d === 99 ? "All team-games" : r.d > 0 ? `Up ${r.d}` : r.d === 0 ? "Tied" : `Down ${-r.d}`) },
    { key: "share", label: "Share of team-games", align: "right", render: (r) => pct(r.share, 1) },
    { key: "never", label: "Never pull", tip: "Expected standings points from here if the team never pulls.", align: "right", render: (r) => fmt(r.never, 3) },
    { key: "act", label: "Pull at today's times", tip: `Pull at 2025–26 average times: down 1 ${mss(value.actualThresholds["1"])}, down 2 ${mss(value.actualThresholds["2"])}, down 3+ ${mss(value.actualThresholds["3"])}.`, align: "right", render: (r) => fmt(r.act, 3) },
    { key: "opt", label: "Pull at the model's times", align: "right", render: (r) => fmt(r.opt, 3) },
    { key: "gain", label: "Gain per 82 games", tip: "Share × (model − today) × 82: this row's contribution to the season total.", align: "right", render: (r) => fmt(r.gain82, 3) },
  ];
  return (
    <div className="space-y-6">
      <RateControls showMode={false} />
      <h3 className="text-lg font-semibold text-ink">How many standings points is pulling the goalie worth?</h3>
      <div className="grid gap-4 md:grid-cols-3">
        <Stat
          accent
          label="Additional points from pulling at the optimal time"
          value={`${signed(g(calc.o - calc.a), 2)}`}
          sub="standings points per team per 82-game season, vs pulling at today's average times"
        />
        <Stat
          label="Points gained from current pulling strategies"
          value={`${signed(g(calc.a - calc.n), 2)}`}
          sub="today's average pull times vs never pulling"
        />
        <Stat
          label="Total potential benefit of pulling the goalie"
          value={`${signed(g(calc.o - calc.n), 2)}`}
          sub="the model's times vs never pulling"
        />
      </div>
      <Callout tone="finding">
        NHL teams already capture about {pct((calc.a - calc.n) / (calc.o - calc.n), 0)} of the potential benefit of pulling
        their goalies. But by pulling earlier, they could gain another {fmt(g(calc.o - calc.a), 2)} standings points per
        season on average. Over time, those small improvements add up.
        {isDefault && (
          <> 95% bootstrap interval at our default rates: {fmt(value.perSeasonGain.ci95OptimalVsActual[0], 2)} to {fmt(value.perSeasonGain.ci95OptimalVsActual[1], 2)} points.</>
        )}
      </Callout>
      <Card>
        <h3 className="font-semibold">Where the points come from</h3>
        <p className="mb-3 mt-1 text-[14px] text-muted">
          Expected standings points from 15:00 left under each policy, by the score at that moment. Shares are from{" "}
          {int(value.teamGames)} team-games in 2025–26.
        </p>
        <SortableTable
          columns={cols}
          rows={rows}
          rowKey={(r) => String(r.d)}
          pinned={[{ d: 99, share: 1, opt: calc.o, act: calc.a, never: calc.n, gain82: g(calc.o - calc.a) }]}
        />
        <Note>
          Pinned row: all team-games, including scores beyond ±3 not listed. Method: the model values three policies over the
          last 15 minutes. "Never pull" keeps the goalie in throughout. "Today's
          times" pulls exactly at the 2025–26 average time for each deficit (down 3 or more uses the down-3 time). "Model's
          times" is the optimal policy. Each team-game's score at 15:00 left comes from the 2025–26 play-by-play intervals, and
          the per-game average is multiplied by 82. The values are model-based: they assume our scoring rates and treat the
          average pull time as if every team used it. The bootstrap resamples team-games to show sampling noise in the score
          distribution only, not uncertainty in the rates.
        </Note>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ teams */

type TeamRow = (typeof teams.teamSeasons)[number];

function TeamsTab() {
  const seasons = [...new Set(teams.teamSeasons.map((t) => t.season))];
  const [season, setSeason] = useState("2025–26");
  const rows = teams.teamSeasons.filter((t) => t.season === season);
  const prior = teams.priors.find((p) => p.season === season)!;
  const league: TeamRow = {
    ...rows[0],
    team: "League",
    name: "League average",
    n: rows.reduce((s, r) => s + r.n, 0),
    mean: prior.mu0,
    shrunk: prior.mu0,
    rank: null,
    pct: rows.reduce((s, r) => s + r.pct, 0) / rows.length,
    srs: 0,
  };
  const cols: Column<TeamRow>[] = [
    { key: "rank", label: "Rank", tip: `Earliest = 1, by adjusted pull time. Teams with fewer than ${teams.minPulls} pulls are not ranked.`, align: "right", render: (r) => r.rank ?? "—", sort: (r) => r.rank ?? 99 },
    { key: "name", label: "Team", render: (r) => r.name, sort: (r) => r.name },
    { key: "n", label: "Pulls", tip: "Goalie pulls while trailing by one that season.", align: "right", render: (r) => int(r.n), sort: (r) => r.n },
    { key: "mean", label: "Average pull", tip: "Raw average time left at the pull (m:ss).", align: "right", render: (r) => mss(r.mean), sort: (r) => r.mean },
    {
      key: "shrunk",
      label: "Adjusted pull time",
      tip: "The team's average moved toward the league average based on its number of pulls. Fewer pulls = a bigger adjustment.",
      align: "right",
      render: (r) => mss(r.shrunk),
      sort: (r) => r.shrunk,
    },
    { key: "vs", label: "vs league", tip: "Adjusted pull time minus the league average, seconds. Positive = earlier.", align: "right", render: (r) => (r.team === "League" ? "—" : `${signed(r.shrunk - prior.mu0, 1)} s`), sort: (r) => r.shrunk - prior.mu0 },
    { key: "pct", label: "Points %", tip: "Standings points ÷ (2 × games played).", align: "right", render: (r) => fmt(r.pct, 3), sort: (r) => r.pct },
    { key: "srs", label: "SRS", tip: "Goals per game better than average, adjusted for opponents and home ice.", align: "right", render: (r) => signed(r.srs, 2), sort: (r) => r.srs },
  ];
  const narrow = useIsNarrow();
  const base = rows.filter((r) => r.n >= teams.minPulls).map((r) => ({ x: r.pct, y: r.shrunk - prior.mu0, name: r.name, team: r.team, n: r.n }));
  const byY = [...base].sort((a, b) => b.y - a.y);
  const standouts = new Set([...byY.slice(0, 2), ...byY.slice(-2)].map((p) => p.team));
  const scatter = base.map((p) => ({ ...p, label: standouts.has(p.team) ? p.team : "" }));
  const yLim = Math.max(10, Math.ceil(Math.max(...scatter.map((p) => Math.abs(p.y)), 1) / 5) * 5);
  const yTicks = Array.from({ length: (2 * yLim) / 5 + 1 }, (_, i) => -yLim + i * 5);
  const xLo = Math.floor(Math.min(...scatter.map((p) => p.x), 0.4) * 10) / 10;
  const xHi = Math.ceil(Math.max(...scatter.map((p) => p.x), 0.7) * 10) / 10;
  const xTicks = Array.from({ length: Math.round((xHi - xLo) / 0.1) + 1 }, (_, i) => Math.round((xLo + i * 0.1) * 10) / 10);
  const q = teams.quality.pct;
  const fitLine = [
    { x: xLo, y: q.intercept + q.slope * xLo },
    { x: xHi, y: q.intercept + q.slope * xHi },
  ];
  const c = teams.compare2025;
  type Fr = (typeof teams.franchises)[number];
  const frCols: Column<Fr>[] = [
    { key: "name", label: "Franchise", render: (r) => r.name, sort: (r) => r.name },
    { key: "dev", label: "Earlier than league", tip: "Average of (pull time − that season's league average), seconds, full seasons 2010–11 to 2025–26.", align: "right", render: (r) => `${signed(r.dev, 1)} s`, sort: (r) => r.dev },
    { key: "ci", label: "95% interval", align: "right", render: (r) => `${signed(r.dev - 1.96 * r.se, 1)} to ${signed(r.dev + 1.96 * r.se, 1)}` },
    { key: "n", label: "Pulls", align: "right", render: (r) => int(r.n), sort: (r) => r.n },
    { key: "seasons", label: "Seasons", align: "right", render: (r) => r.seasons, sort: (r) => r.seasons },
  ];
  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Which NHL teams are the most aggressive about pulling their goalie?</h3>
            <p className="text-[14px] text-muted">Ranked by how early they pull when trailing by one goal. Pick a season.</p>
          </div>
          <label className="text-sm text-muted">
            Season{" "}
            <select className="ml-1 rounded-md border border-line px-2 py-1 text-ink" value={season} onChange={(e) => setSeason(e.target.value)}>
              {seasons.map((s) => (
                <option key={s} value={s}>
                  {s}
                  {s === "2026–27" ? " (partial)" : ""}
                </option>
              ))}
            </select>
          </label>
        </div>
        <SortableTable
          columns={cols}
          rows={rows}
          pinned={[league]}
          rowKey={(r) => r.team}
          initialSort={{ key: "rank", dir: "asc" }}
          maxHeight={520}
        />
        {season === "2025–26" && (
          <p className="mt-3 text-[15px] text-ink">
            In 2025–26, {c.early.name} pulled earliest ({mss(c.early.mean)} left on average over {c.early.n} pulls) and{" "}
            {c.late.name} latest ({mss(c.late.mean)} over {c.late.n} pulls). That gap is larger than chance alone would
            explain (Welch t-test: t = {fmt(c.t, 2)}, {pval(c.p)}).
          </p>
        )}
        <Note>
          With only about 15 qualifying pulls per team each season, a few unusual games can significantly affect the
          averages. To make team comparisons more reliable, we adjust each team's average toward the league average based
          on its sample size, and rank teams by that <Term id="shrink">adjusted pull time</Term>.
          <InfoDot
            content={
              <>
                Normal–normal Bayes update for {season}: prior mean {mss(prior.mu0)}, spread of true team averages{" "}
                {fmt(prior.sigma0, 1)} s, noise of a single pull {fmt(prior.sigmaD, 1)} s. A team with n pulls keeps a weight
                of σ₀² ÷ (σ₀² + σ²/n) on its own average.
              </>
            }
          />
        </Note>
      </Card>
      <Card>
        <h3 className="font-semibold">Are better teams more aggressive about pulling their goalies?</h3>
        <p className="mt-1 text-[15px] text-ink">
          Slightly, but the difference is small. Across {int(q.n)} team-seasons, stronger teams tended to pull their goalies
          a little earlier. However, a 10-percentage-point improvement in standings points percentage was associated with
          pulling only about {fmt(q.slope / 10, 1)} seconds earlier.
        </p>
        <p className="mb-2 mt-1 text-[14px] text-muted">
          The relationship is statistically significant ({pval(q.p)}, r = {fmt(q.r, 2)}; using <Term id="srs">SRS</Term>{" "}
          instead gives the same answer, {pval(teams.quality.srs.p)}) but too small to matter in practice. Full seasons
          2010–11 to 2025–26, teams with {teams.minPulls}+ pulls. Dots show {season}; the line is the fit across all
          team-seasons; the two earliest and two latest teams are labelled.
        </p>
        <ResponsiveChart height={340}>
          <ScatterChart margin={{ top: 10, right: 24, bottom: 28, left: 4 }}>
            <CartesianGrid stroke={GRID} />
            <XAxis dataKey="x" type="number" domain={[xLo, xHi]} ticks={xTicks} tick={AXIS} tickFormatter={(v: number) => v.toFixed(1)} label={xLabel("Points % (standings points ÷ points available)")} />
            <YAxis dataKey="y" type="number" domain={[-yLim, yLim]} ticks={yTicks} tick={AXIS} label={yLabel("Seconds earlier than league")} width={76} />
            <ZAxis range={[60, 60]} />
            <ReferenceLine y={0} stroke="#94a3b8" />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { x: number; y: number; name: string; n: number };
                if (!p.name) return null;
                return <ChartTooltipBox title={p.name} lines={[{ text: `Points % ${p.x.toFixed(3)}` }, { text: `${signed(p.y, 1)} s vs league (${p.n} pulls)` }]} />;
              }}
            />
            <Scatter data={fitLine} line={{ stroke: "#dc2626", strokeWidth: 2 }} shape={() => <g />} isAnimationActive={false} legendType="none" tooltipType="none" />
            <Scatter data={scatter} fill="#1d4ed8" fillOpacity={0.75} isAnimationActive={false}>
              {!narrow && <LabelList dataKey="label" position="right" style={{ fontSize: 12, fill: "#0f172a", fontWeight: 600 }} />}
            </Scatter>
          </ScatterChart>
        </ResponsiveChart>
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">Which franchises have pulled earliest over 16 seasons?</h3>
        <SortableTable columns={frCols} rows={teams.franchises} rowKey={(r) => r.franchise} maxHeight={480} initialSort={{ key: "dev", dir: "desc" }} />
        <Note>
          Atlanta and Winnipeg, and Phoenix, Arizona and Utah, are counted as one franchise each, following the franchise
          moves. Intervals that exclude zero mark franchises that pull reliably earlier or later than their peers.
        </Note>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ lines */

function LinesTab() {
  const { rates, mode } = useModel();
  const lineRates = Object.fromEntries(lines.rates.map((l) => [l.line, l.rate]));
  const fn = useMemo(() => lineRateFn(lineRates, rates.r65, lines.blocks), [rates.r65]); // eslint-disable-line react-hooks/exhaustive-deps
  const payoffs = mode === "playoff" ? PLAYOFF : REGULAR;
  const constant = useSolution().latestPull;
  const byLine = useMemo(() => solveDP({ ...rates, r65: fn, payoffs }).latestPull, [rates, fn, payoffs]);
  const stepData = useMemo(() => Array.from({ length: 301 }, (_, i) => ({ t: 300 - i, rate: i === 300 ? fn(1) : fn(300 - i), line: 300 - i <= 158 ? lineAt(Math.max(1, 300 - i), lines.blocks) : null })), [fn]);
  const lineShift1 = (byLine[1] ?? 0) - (constant[1] ?? 0);
  const r65 = rateData.components.find((c) => c.key === "r65")!;
  const overallLine = { line: 0, seconds: r65.seconds, goals: r65.goals, rate: r65.rate };
  type LR = (typeof lines.rates)[number];
  const lrCols: Column<LR>[] = [
    {
      key: "line",
      label: "Forward line",
      render: (r) => (r.line === 0 ? "All extra-attacker time (our default rate)" : `Line ${r.line}${r.line === 1 ? " (most-used)" : ""}`),
    },
    {
      key: "toi",
      label: "Shift length",
      tip: "Assumed time on ice before a change.",
      align: "right",
      render: (r) => (r.line === 0 ? "—" : `${lines.blocks.find((b) => b.line === r.line)!.seconds} s`),
    },
    { key: "sec", label: "Time with goalie pulled", align: "right", render: (r) => `${fmt(r.seconds / 3600, 1)} h` },
    { key: "g", label: "Goals", align: "right", render: (r) => r.goals },
    { key: "rate", label: "Goals per 60", align: "right", render: (r) => fmt(r.rate) },
  ];
  return (
    <div className="space-y-6">
      <RateControls />
      <Card>
        <h3 className="font-semibold">Does having your best players on the ice change when you should pull?</h3>
        <p className="mt-1 text-[15px] text-ink">
          Not all forward lines are equally dangerous with an extra attacker on the ice. Our data suggest that a team's
          most-used line scores at a higher rate than its other lines, although the samples are relatively small. We
          examine whether accounting for those differences changes the optimal time to pull the goalie.
        </p>
        <p className="mt-2 text-[15px] text-ink">
          {lineShift1 === 0
            ? "It doesn't: the recommended pull when trailing by one stays the same."
            : `${Math.abs(lineShift1) <= 20 ? "Only a little" : "Yes"}: saving the best line for the end moves the recommended pull ${Math.abs(lineShift1)} seconds ${lineShift1 > 0 ? "earlier" : "later"} when trailing by one (${mss(byLine[1])} instead of ${mss(constant[1])}).`}
        </p>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {DEFICITS.map((d) => (
          <Stat
            key={d}
            accent={d === 1}
            label={`Down ${d} goal${d > 1 ? "s" : ""}, with line changes`}
            value={
              <span className="text-2xl">
                Pull with <span className="text-pull">{mss(byLine[d])}</span> remaining
              </span>
            }
            sub={`${Math.abs((byLine[d] ?? 0) - (constant[d] ?? 0))} s ${(byLine[d] ?? 0) >= (constant[d] ?? 0) ? "earlier" : "later"} than with a single extra-attacker rate (${mss(constant[d])})`}
          />
        ))}
      </div>
      <Card>
        <h3 className="font-semibold">How we model the line changes</h3>
        <p className="mt-1 text-[14px] text-muted">
          We assume the most-used line covers the last {lines.blocks[0].seconds} seconds, line 2 the{" "}
          {lines.blocks[1].seconds} seconds before that, then lines 3 and 4 ({lines.blocks[2].seconds} and{" "}
          {lines.blocks[3].seconds} seconds). Before that final {mss(lines.blocks.reduce((a, b) => a + b.seconds, 0))}{" "}
          rotation the line on the ice is unknown, so the overall extra-attacker rate (the slider) applies. Line rates are
          from 2025–26 games with the goalie pulled.
        </p>
        <div className="mt-3">
          <SortableTable columns={lrCols} rows={lines.rates} pinned={[overallLine]} rowKey={(r) => String(r.line)} />
        </div>
        <Note>
          A further {fmt(lines.unranked.seconds / 3600, 1)} hours of extra-attacker time had no ranked line on the ice{" "}
          <span className="whitespace-nowrap">({lines.unranked.goals} goals,</span> {fmt(lines.unranked.rate)} per 60). Line 4 rests on only {lines.rates[3].goals}{" "}
          goals, so treat its rate as rough.
        </Note>
        <h3 className="mt-6 font-semibold">The extra-attacker scoring rate the model uses, by time left</h3>
        <ResponsiveChart height={300}>
          <LineChart data={stepData} margin={{ top: 28, right: 24, bottom: 28, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="t" type="number" domain={[0, 300]} reversed ticks={[300, 240, 180, 120, 60, 0]} tickFormatter={(v: number) => mss(v)} tick={AXIS} label={xLabel("Time left (m:ss)")} />
            <YAxis tick={AXIS} domain={[0, 10]} ticks={[0, 2, 4, 6, 8, 10]} label={yLabel("Goals per 60 (6-on-5)")} width={76} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as { t: number; rate: number; line: number | null };
                return <ChartTooltipBox title={`${mss(p.t)} left`} lines={[{ text: `${p.line ? `Line ${p.line}` : "Any line (overall rate)"}: ${fmt(p.rate)} per 60` }]} />;
              }}
            />
            <ReferenceLine x={158} stroke="#94a3b8" strokeDasharray="3 3" label={{ value: "final rotation starts", position: "top", fontSize: 12, fill: "#475569" }} />
            <Line dataKey="rate" type="stepAfter" stroke="#1d4ed8" strokeWidth={2.5} dot={false} isAnimationActive={false} />
          </LineChart>
        </ResponsiveChart>
        <Note>
          {lines.cyclingVariant.note} Under that assumption the latest pull down one would be{" "}
          {mss(lines.cyclingVariant.latest["1"])}, but only during line 1's shifts.
        </Note>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ outcomes */

const OUTCOME_KEYS = ["won", "tiedLostOT", "partial", "noChange", "conceded"] as const;
const OUTCOME_META: Record<(typeof OUTCOME_KEYS)[number], { label: string; color: string; tip: string }> = {
  won: { label: "Came back and won", color: "#15803d", tip: "Pulling team won, in regulation, OT or a shootout." },
  tiedLostOT: { label: "Tied it, lost in OT/SO", color: "#86efac", tip: "Got to overtime (one standings point) but lost." },
  partial: { label: "Scored, still lost", color: "#94a3b8", tip: "Down 2 or 3: closed the gap but did not tie." },
  noChange: { label: "Lost by the same margin", color: "#cbd5e1", tip: "No goal either way after the pull (or one each)." },
  conceded: { label: "Conceded again", color: "#f87171", tip: "Lost by more than the deficit at the pull, usually an empty-net goal." },
};

function OutcomesTab() {
  const [d, setD] = useState<Deficit>(1);
  const rows = outcomes.rows.filter((r) => r.deficit === d);
  const data = rows.map((r) => ({
    season: r.season,
    partialSeason: r.partialSeason,
    n: r.n,
    ...Object.fromEntries(OUTCOME_KEYS.map((k) => [k, r[k] / r.n])),
  }));
  const keys = OUTCOME_KEYS.filter((k) => d > 1 || k !== "partial");
  const pooled = outcomes.pooled[String(d) as "1"];
  const lastFull = rows.filter((r) => !r.partialSeason).at(-1)!;
  const cb = (r: (typeof rows)[number]) => (r.won + r.tiedLostOT) / r.n;
  const tt = outcomes.trendTest;
  const ct = outcomes.concedeTrendTest;
  const narrow = useIsNarrow();
  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="font-semibold">Does pulling the goalie actually work?</h3>
            <p className="text-[14px] text-muted">
              The final result of every regular-season goalie pull, by season. Since 2010–11, {pct(pooled.cameBack, 1)} of
              pulls when {DEFICIT_LABEL[d].toLowerCase()} got the game to overtime or better and {pct(pooled.won, 1)} ended
              in a win.
            </p>
          </div>
          <Segmented label="Deficit" value={d} onChange={setD} options={DEFICITS.map((x) => ({ value: x, label: DEFICIT_LABEL[x] }))} />
        </div>
        <ResponsiveChart height={380}>
          <BarChart data={data} margin={{ top: 10, right: 24, bottom: 28, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis
              dataKey="season"
              tick={AXIS}
              interval={narrow ? 3 : 1}
              tickFormatter={(x: string) => (narrow ? `'${x.slice(-2)}` : x)}
              label={xLabel(narrow ? "Season (ending year)" : "Season")}
            />
            <YAxis tick={AXIS} domain={[0, 1]} ticks={[0, 0.25, 0.5, 0.75, 1]} tickFormatter={(v: number) => `${Math.round(v * 100)}%`} label={yLabel("Share of pulls")} width={76} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Record<string, number | string | boolean>;
                return (
                  <ChartTooltipBox
                    title={`${p.season}${p.partialSeason ? " (partial)" : ""}: ${p.n} pulls`}
                    lines={keys.map((k) => ({ color: OUTCOME_META[k].color, text: `${OUTCOME_META[k].label}: ${pct(p[k] as number, 1)}` }))}
                  />
                );
              }}
            />
            {keys.map((k) => (
              <Bar key={k} dataKey={k} stackId="a" fill={OUTCOME_META[k].color} isAnimationActive={false}>
                {data.map((row) => (
                  <Cell key={row.season} fillOpacity={row.partialSeason ? 0.5 : 1} />
                ))}
              </Bar>
            ))}
          </BarChart>
        </ResponsiveChart>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
          {keys.map((k) => (
            <span key={k} className="inline-flex items-center gap-2" title={OUTCOME_META[k].tip}>
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: OUTCOME_META[k].color }} />
              {OUTCOME_META[k].label}
            </span>
          ))}
          <span>Faded bar: 2026–27 (partial)</span>
        </div>
        {d === 1 && (
          <div className="mt-4">
            <Callout tone="finding">
              <p>
                Pulling the goalie has become a higher-risk, higher-reward strategy. When trailing by one goal, teams forced
                overtime or better following {pct(cb(rows[0]), 0)} of goalie pulls in {rows[0].season}, compared with{" "}
                {pct(cb(lastFull), 0)} in {lastFull.season}. But the share of games in which they conceded another goal also
                increased, from {pct(rows[0].conceded / rows[0].n, 0)} to {pct(lastFull.conceded / lastFull.n, 0)}.
              </p>
              <p className="mt-2">
                This is consistent with teams pulling earlier: more time with an extra attacker creates more opportunities to
                score, but also more opportunities for the opponent to capitalize on an empty net.
              </p>
              <p className="mt-2 text-[13px] text-muted">
                Both trends are statistically significant (logistic regression on season, n = {int(tt.n)}: overtime or
                better {signed(tt.coef, 3)} log-odds per season, {pval(tt.p)}; conceding again {signed(ct.coef, 3)},{" "}
                {pval(ct.p)}).
              </p>
            </Callout>
          </div>
        )}
        <Note>
          How we know: the pull file records goals during a pull only from 2024–25 on, so outcomes come from each game's final
          score instead. Where both exist (2024–25 onward), "got to OT or better" agrees with "scored during the pull" in{" "}
          {int(outcomes.validation.agree)} of {int(outcomes.validation.n)} down-1 pulls ({pct(outcomes.validation.agree / outcomes.validation.n, 1)}). The
          mismatches are teams that tied it after the goalie had gone back in, or tied it during the pull and then lost in regulation.
        </Note>
      </Card>
    </div>
  );
}

/* ------------------------------------------------------------------ stakes */

const GROUPS = [
  { id: "regular", label: "Regular season (before the last 10 games)", color: "#94a3b8" },
  { id: "otherLast10", label: "Last 10 games, other teams", color: "#60a5fa" },
  { id: "bubbleLast10", label: "Last 10 games, bubble teams", color: "#1d4ed8" },
  { id: "playoffs", label: "Playoffs", color: "#dc2626" },
] as const;

function StakesTab() {
  const playoffLp = useSolution("playoff").latestPull;
  const regularLp = useSolution("regular").latestPull;
  const data = DEFICITS.map((d) => ({
    deficit: DEFICIT_LABEL[d],
    ...Object.fromEntries(GROUPS.map((g) => [g.id, stakes.rows.find((r) => r.group === g.id && r.deficit === d)!.mean])),
  }));
  type Row = { group: string; label: string; deficit: number; n: number; mean: number; median: number; coef: number | null; p: number | null };
  const rows: Row[] = GROUPS.flatMap((g) =>
    DEFICITS.map((d) => {
      const r = stakes.rows.find((x) => x.group === g.id && x.deficit === d)!;
      const t = stakes.tests.find((x) => x.group === g.id && x.deficit === d);
      return { group: g.id, label: g.label, deficit: d, n: r.n, mean: r.mean, median: r.median, coef: t?.coef ?? null, p: t?.p ?? null };
    }),
  );
  const cols: Column<Row>[] = [
    { key: "label", label: "Group", render: (r) => r.label, sort: (r) => r.label },
    { key: "deficit", label: "Deficit", render: (r) => DEFICIT_LABEL[r.deficit], sort: (r) => r.deficit },
    { key: "n", label: "Pulls", align: "right", render: (r) => int(r.n), sort: (r) => r.n },
    { key: "mean", label: "Mean", align: "right", render: (r) => mss(r.mean), sort: (r) => r.mean },
    { key: "median", label: "Median", align: "right", render: (r) => mss(r.median), sort: (r) => r.median },
    {
      key: "coef",
      label: "vs regular season",
      tip: "Seconds earlier (+) or later (−) than regular-season pulls at the same deficit, from a regression with season fixed effects.",
      align: "right",
      render: (r) => (r.coef === null ? "baseline" : `${signed(r.coef, 1)} s`),
      sort: (r) => r.coef ?? 0,
    },
    { key: "p", label: "p-value", align: "right", render: (r) => (r.p === null ? "—" : pval(r.p)), sort: (r) => r.p ?? 1 },
  ];
  const top = Math.max(...stakes.rows.map((r) => r.mean));
  const ticks = secondTicks(top * 1.05, 60);
  return (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-ink">Do coaches pull earlier when more is at stake?</h3>
      <Callout tone="finding">
        <p>
          You might expect coaches to take bigger risks when their season is on the line. Surprisingly, we found little
          evidence that they do.
        </p>
        <p className="mt-2">
          Teams pull their goalies at nearly identical times in the regular season and playoffs, even though our model
          recommends pulling earlier in playoff games ({mss(playoffLp[1])} vs {mss(regularLp[1])} when trailing by one).
          Teams fighting for a playoff spot also show little difference in their approach during the final 10 games of the
          season. None of the differences below is statistically significant at the 5% level.
        </p>
      </Callout>
      <Card>
        <h3 className="font-semibold">Average time left at the first pull, by stakes</h3>
        <p className="mb-2 mt-1 text-[14px] text-muted">
          Seasons {stakes.seasons[0]} to {stakes.seasons[stakes.seasons.length - 1]}, except 2019–20 (no normal stretch run).
          Regular-season groups count each team's first pull at each deficit; playoff pulls use the same rules.
        </p>
        <ResponsiveChart height={340}>
          <BarChart data={data} margin={{ top: 10, right: 24, bottom: 28, left: 4 }}>
            <CartesianGrid stroke={GRID} vertical={false} />
            <XAxis dataKey="deficit" tick={AXIS} label={xLabel("Deficit when the goalie came off")} />
            <YAxis tick={AXIS} ticks={ticks} domain={[0, ticks[ticks.length - 1]]} tickFormatter={(v: number) => mss(v)} label={yLabel("Time left at pull (m:ss)")} width={76} />
            <Tooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0].payload as Record<string, number | string>;
                return <ChartTooltipBox title={String(p.deficit)} lines={GROUPS.map((g) => ({ color: g.color, text: `${g.label}: ${mss(p[g.id] as number)}` }))} />;
              }}
            />
            {GROUPS.map((g) => (
              <Bar key={g.id} dataKey={g.id} fill={g.color} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveChart>
        <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
          {GROUPS.map((g) => (
            <span key={g.id} className="inline-flex items-center gap-2">
              <span className="inline-block h-3 w-3 rounded-sm" style={{ background: g.color }} />
              {g.label}
            </span>
          ))}
        </div>
      </Card>
      <Card>
        <SortableTable columns={cols} rows={rows} rowKey={(r) => `${r.group}${r.deficit}`} />
        <Note>
          <Term id="bubble">Bubble team</Term>: {stakes.bubbleRule.toLowerCase()}, measured with 10 games left against last
          season's playoff line (8th place in the conference by points %, 4th per division in 2020–21). That gives{" "}
          {Math.min(...Object.values(stakes.bubbleTeamsPerSeason))} to {Math.max(...Object.values(stakes.bubbleTeamsPerSeason))} bubble
          teams a season. Conference membership follows the 2013 realignment and the Vegas, Seattle and Utah additions.
        </Note>
      </Card>
    </div>
  );
}
