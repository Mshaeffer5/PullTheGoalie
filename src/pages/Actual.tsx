import { useMemo, useState } from "react";
import { AppLink as Link, useSubTab } from "@/lib/nav";
import { Bar, BarChart, CartesianGrid, LabelList, Legend, ReferenceLine, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartTooltipBox, ResponsiveChart, DeficitLegend, GRID, TrendChart, xLabel, yLabel } from "@/components/charts";
import { SortableTable, type Column } from "@/components/SortableTable";
import { Card, Note, Segmented, SectionTitle, SubTabs, Term } from "@/components/ui";
import { DEFICITS, distribution, homeRoad, meta, records, trend, type Deficit } from "@/lib/data";
import { DEFICIT_COLORS, DEFICIT_LABEL, fmt, friendlyDate, int, mss, niceTicks, pct, pval, secondTicks, signed, teamName } from "@/lib/format";
import { useSolution } from "@/lib/model";

const TABS = [
  { id: "trend", label: "Trend by season" },
  { id: "distribution", label: "Distribution" },
  { id: "home-road", label: "Home vs road" },
  { id: "records", label: "Records" },
];

export default function Actual() {
  const sub = useSubTab();
  return (
    <div>
      <SectionTitle
        sub={
          <>
            We've analyzed {int(meta.firstPulls)} goalie pulls across NHL regular-season games dating back to 2010–11.
            Explore how pull timing has changed over time, how it varies by score, whether home teams pull differently, and
            the record books. (Which teams have been the most aggressive is on{" "}
            <Link to="/deeper/teams" className="text-brand underline">
              Deeper dives → Teams
            </Link>
            .) Times are minutes:seconds left in regulation when the goalie came off.
          </>
        }
      >
        When do NHL teams actually pull their goalie?
      </SectionTitle>
      <SubTabs base="/actual" tabs={TABS} />
      {(!sub || sub === "trend") && <TrendTab />}
      {sub === "distribution" && <DistributionTab />}
      {sub === "home-road" && <HomeRoadTab />}
      {sub === "records" && <RecordsTab />}
    </div>
  );
}

type SeasonRow = { season: string; partial: boolean } & Record<string, number | string | boolean>;

function TrendTab() {
  const [stat, setStat] = useState<"mean" | "median">("mean");
  const [shown, setShown] = useState<Deficit[]>([1, 2, 3]);
  const [band, setBand] = useState(false);
  const [firstOnly, setFirstOnly] = useState(false);
  const src = firstOnly ? trend.rowsFirstOnly : trend.rows;
  const rows: SeasonRow[] = useMemo(() => {
    const seasons = [...new Set(src.map((r) => r.season))];
    return seasons.map((s) => {
      const o: SeasonRow = { season: s, partial: false };
      for (const d of DEFICITS) {
        const t = src.find((r) => r.season === s && r.deficit === d)!;
        o.partial = t.partial;
        o[`n${d}`] = t.n;
        o[`v${d}`] = t[stat];
      }
      return o;
    });
  }, [stat, src]);
  const pooledRow: SeasonRow = { season: "All full seasons", partial: false };
  for (const p of firstOnly ? trend.pooledFirstOnly : trend.pooled) {
    pooledRow[`n${p.deficit}`] = p.n;
    pooledRow[`v${p.deficit}`] = p[stat];
  }
  const cols: Column<SeasonRow>[] = [
    {
      key: "season",
      label: "Season",
      render: (r) => (r.partial ? <em>{r.season} (partial)</em> : r.season),
      sort: (r) => (r.season === "All full seasons" ? "" : r.season),
    },
    ...DEFICITS.flatMap((d) => [
      {
        key: `n${d}`,
        label: `Down ${d}: pulls`,
        tip: `Number of first pulls when trailing by ${d}.`,
        align: "right" as const,
        render: (r: SeasonRow) => int(r[`n${d}`] as number),
        sort: (r: SeasonRow) => r[`n${d}`] as number,
      },
      {
        key: `v${d}`,
        label: `Down ${d}: ${stat}`,
        tip: `${stat === "mean" ? "Average" : "Median"} time left (m:ss) at the first pull when trailing by ${d}.`,
        align: "right" as const,
        render: (r: SeasonRow) => mss(r[`v${d}`] as number),
        sort: (r: SeasonRow) => r[`v${d}`] as number,
      },
    ]),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-3 flex flex-wrap items-center gap-3">
          <Segmented
            label="Statistic"
            value={stat}
            onChange={setStat}
            options={[
              { value: "mean", label: "Mean" },
              { value: "median", label: "Median" },
            ]}
          />
          <div className="flex gap-1" role="group" aria-label="Deficits shown">
            {DEFICITS.map((d) => {
              const on = shown.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setShown((s) => (on ? (s.length > 1 ? s.filter((x) => x !== d) : s) : [...s, d].sort()))}
                  className="rounded-lg px-3 py-1 text-sm font-medium ring-1"
                  style={on ? { background: DEFICIT_COLORS[d], color: "white", borderColor: DEFICIT_COLORS[d] } : { color: "#475569" }}
                >
                  {DEFICIT_LABEL[d]}
                </button>
              );
            })}
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={band} onChange={(e) => setBand(e.target.checked)} />
            Show middle 50% of pulls
          </label>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input type="checkbox" checked={firstOnly} onChange={(e) => setFirstOnly(e.target.checked)} />
            Exclude <Term id="repull">repeat pulls</Term>
          </label>
        </div>
        <TrendChart stat={stat} deficits={shown} showBand={band} firstOnly={firstOnly} height={400} />
        <DeficitLegend deficits={shown} />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {trend.tests.map((t) => (
            <div key={t.deficit} className="rounded-lg bg-ice px-3 py-2 text-[14px]">
              <span className="font-semibold">{DEFICIT_LABEL[t.deficit]}:</span> {fmt(t.slope, 1)} seconds earlier per season (±
              {fmt(1.96 * t.se, 1)} s, {pval(t.p)}, n = {int(t.n)})
            </div>
          ))}
        </div>
        <p className="mt-4 text-[15px] leading-relaxed text-ink">
          {firstOnly ? (
            <>Showing each team's first pull of the game only, so repeat pulls are left out.</>
          ) : (
            <>
              We count each team's first goalie pull at each deficit. This means a team can appear more than once in the
              same game if it pulls its goalie again after conceding an empty-net goal. These repeat pulls account for{" "}
              {pct(meta.repulls["2"].share, 0)} of the observations when teams trail by two goals and tend to occur much
              later in the game ({mss(meta.repulls["2"].meanRepull)} left on average). Tick "Exclude repeat pulls" to see
              first pulls of the game only.
            </>
          )}
        </p>
        <Note>
          What counts as a pull: the goalie must stay off for at least 20 seconds, unless a goal is scored or the spell
          runs to the final horn, so quick trips to the bench during a delayed penalty are left out. Pulls with more than
          5:00 left down one, 8:00 down two or 12:00 down three are also left out. The trend test is a linear regression
          of each pull's time left on season (2010–11 = 0), full seasons only. 2012–13 (48 games), 2019–20 and 2020–21
          were short seasons, and 2026–27 covers games through November 7 only. Details on the About page.
        </Note>
      </Card>
      <Card>
        <h3 className="mb-2 font-semibold">Season by season</h3>
        <SortableTable
          columns={cols}
          rows={rows}
          pinned={[pooledRow]}
          rowKey={(r) => r.season}
          maxHeight={520}
          rowClass={(r) => (r.partial ? "text-muted" : undefined)}
          caption="Click a column to sort. The pinned row pools every full season (2010–11 to 2025–26)."
        />
      </Card>
    </div>
  );
}

function DistributionTab() {
  const seasons = distribution.seasons;
  const [season, setSeason] = useState("2025–26");
  const [deficit, setDeficit] = useState<Deficit>(1);
  const sol = useSolution("regular");
  const data = (distribution.data as Record<string, Record<string, number[]>>)[season]?.[String(deficit)] ?? [];
  const bin = deficit === 1 ? 5 : 15;
  const bins = useMemo(() => {
    const max = Math.max(...data, 60);
    const nb = Math.ceil((max + 1) / bin);
    const counts = Array.from({ length: nb }, (_, i) => ({ start: i * bin, mid: i * bin + bin / 2, n: 0 }));
    for (const x of data) counts[Math.floor(x / bin)].n += 1;
    return counts;
  }, [data, bin]);
  const mean = data.reduce((a, b) => a + b, 0) / Math.max(data.length, 1);
  const sorted = [...data].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * (sorted.length - 1)))];
  const model = sol.latestPull[deficit];
  const xmax = Math.max(bins.length * bin, (model ?? 0) + bin);
  const yTicks = niceTicks(Math.max(...bins.map((b) => b.n), 1), 5);
  const ticksStep = xmax > 600 ? 120 : 60;
  const ticks = Array.from({ length: Math.floor(xmax / ticksStep) + 1 }, (_, i) => i * ticksStep);
  return (
    <Card>
      <div className="mb-3 flex flex-wrap items-center gap-3">
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
        <Segmented
          label="Deficit"
          value={deficit}
          onChange={setDeficit}
          options={DEFICITS.map((d) => ({ value: d, label: DEFICIT_LABEL[d] }))}
        />
      </div>
      <div className="mb-2 grid grid-cols-2 gap-2 text-[14px] md:grid-cols-5">
        <Mini label="Pulls" value={int(data.length)} />
        <Mini label="Mean" value={mss(mean)} />
        <Mini label="Median" value={mss(q(0.5))} />
        <Mini label="Middle 50%" value={`${mss(q(0.25))}–${mss(q(0.75))}`} />
        <Mini label="Model recommends" value={mss(model)} red />
      </div>
      <ResponsiveChart height={340}>
        <BarChart data={bins} margin={{ top: 16, right: 24, bottom: 28, left: 4 }} barCategoryGap={1}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis
            dataKey="mid"
            type="number"
            domain={[0, xmax]}
            ticks={ticks}
            tickFormatter={(v: number) => mss(v)}
            tick={AXIS}
            label={xLabel("Time left at first pull (m:ss)")}
          />
          <YAxis
            tick={AXIS}
            ticks={yTicks}
            domain={[0, yTicks[yTicks.length - 1]]}
            allowDecimals={false}
            label={yLabel("Pulls")}
            width={76}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const b = payload[0].payload as { start: number; n: number };
              return <ChartTooltipBox title={`${mss(b.start)} to ${mss(b.start + bin - 1)} left`} lines={[{ text: `${b.n} pulls` }]} />;
            }}
          />
          <Bar dataKey="n" fill={DEFICIT_COLORS[deficit]} isAnimationActive={false} />
          <ReferenceLine x={mean} stroke="#0f172a" strokeDasharray="4 3" label={{ value: "mean", position: "top", fontSize: 12, fill: "#0f172a" }} />
          {model != null && (
            <ReferenceLine x={model} stroke="#dc2626" strokeWidth={2} label={{ value: "model", position: "top", fontSize: 12, fill: "#dc2626" }} />
          )}
        </BarChart>
      </ResponsiveChart>
      <Note>
        Each bar represents a {bin === 5 ? "five" : "15"}-second interval. Teams trailing by one goal tend to pull their
        goalies at relatively similar times. When trailing by three, however, the timing varies much more widely. The red
        line is the time our model recommends (regular season, at the current scoring rates).
      </Note>
    </Card>
  );
}

function Mini({ label, value, red }: { label: string; value: string; red?: boolean }) {
  return (
    <div className="rounded-lg bg-ice px-3 py-2">
      <div className="text-[12px] uppercase tracking-wide text-muted">{label}</div>
      <div className={`font-semibold tabular-nums ${red ? "text-pull" : "text-ink"}`}>{value}</div>
    </div>
  );
}

function HomeRoadTab() {
  type Row = (typeof homeRoad.tests)[number];
  const side = (d: number, s: string) => homeRoad.rows.find((r) => r.deficit === d && r.side === s)!;
  const hrData = DEFICITS.map((d) => ({
    label: DEFICIT_LABEL[d],
    home: side(d, "home").mean,
    road: side(d, "road").mean,
    hn: side(d, "home").n,
    rn: side(d, "road").n,
  }));
  const hrTicks = secondTicks(Math.max(...hrData.map((r) => Math.max(r.home, r.road))) * 1.1, 60);
  const cols: Column<Row>[] = [
    { key: "d", label: "Deficit", render: (r) => DEFICIT_LABEL[r.deficit] },
    { key: "hn", label: "Home pulls", align: "right", render: (r) => int(side(r.deficit, "home").n) },
    { key: "hm", label: "Home mean", align: "right", render: (r) => mss(side(r.deficit, "home").mean) },
    { key: "rn", label: "Road pulls", align: "right", render: (r) => int(side(r.deficit, "road").n) },
    { key: "rm", label: "Road mean", align: "right", render: (r) => mss(side(r.deficit, "road").mean) },
    {
      key: "diff",
      label: "Home − road",
      tip: "Positive: home teams pull earlier (more time left). Raw difference in seconds.",
      align: "right",
      render: (r) => `${signed(r.diff, 1)} s`,
    },
    { key: "p", label: "Welch t-test", tip: "Two-sided test that home and road means are equal.", align: "right", render: (r) => pval(r.p) },
    {
      key: "fe",
      label: "Within-season difference",
      tip: "Regression of pull time on a home dummy with season fixed effects, so differences between eras don't leak in.",
      align: "right",
      render: (r) => `${signed(r.coefFE, 1)} s (${pval(r.pFE)})`,
    },
  ];
  return (
    <Card>
      <h3 className="font-semibold">Does playing at home affect when coaches pull their goalie?</h3>
      <p className="mb-3 mt-1 text-[15px] text-muted">
        Not by a meaningful margin. Home and road teams pull within about 4 seconds of each other at every deficit, and
        none of the differences is significant at the 5% level. Full seasons 2010–11 to 2025–26.
      </p>
      <ResponsiveChart height={280}>
        <BarChart data={hrData} margin={{ top: 24, right: 16, bottom: 8, left: 4 }} barGap={4}>
          <CartesianGrid stroke={GRID} vertical={false} />
          <XAxis dataKey="label" tick={AXIS} />
          <YAxis
            tick={AXIS}
            ticks={hrTicks}
            domain={[0, hrTicks[hrTicks.length - 1]]}
            tickFormatter={(v: number) => mss(v)}
            width={76}
            label={yLabel("Average time left (m:ss)")}
          />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const r = payload[0].payload as (typeof hrData)[number];
              return (
                <ChartTooltipBox
                  title={r.label}
                  lines={[
                    { color: "#1e3a8a", text: `Home: ${mss(r.home)} (${int(r.hn)} pulls)` },
                    { color: "#94a3b8", text: `Road: ${mss(r.road)} (${int(r.rn)} pulls)` },
                  ]}
                />
              );
            }}
          />
          <Legend wrapperStyle={{ fontSize: 13 }} />
          <Bar dataKey="home" name="Home" fill="#1e3a8a" isAnimationActive={false}>
            <LabelList dataKey="home" position="top" formatter={(v: number) => mss(v)} style={{ fontSize: 12, fill: "#334155" }} />
          </Bar>
          <Bar dataKey="road" name="Road" fill="#94a3b8" isAnimationActive={false}>
            <LabelList dataKey="road" position="top" formatter={(v: number) => mss(v)} style={{ fontSize: 12, fill: "#334155" }} />
          </Bar>
        </BarChart>
      </ResponsiveChart>
      <div className="mt-4" />
      <SortableTable columns={cols} rows={homeRoad.tests} rowKey={(r) => String(r.deficit)} />
    </Card>
  );
}

function RecordsTab() {
  const [d, setD] = useState<Deficit>(1);
  type Rec = (typeof records.latestDown1)[number];
  const outcomeText: Record<string, string> = {
    won: "Came back and won",
    tiedLostOT: "Tied, lost in OT/SO",
    noChange: "Lost by the same margin",
    conceded: "Conceded again",
    partial: "Scored, still lost",
  };
  const recCols: Column<Rec>[] = [
    { key: "date", label: "Date", render: (r) => <span className="whitespace-nowrap">{friendlyDate(r.date)}</span>, sort: (r) => r.date },
    {
      key: "team",
      label: "Game",
      tip: "The pulling team first. vs: at home; at: on the road.",
      render: (r) => `${teamName(r.team)} ${r.home ? "vs" : "at"} ${teamName(r.opp)}`,
      sort: (r) => teamName(r.team),
    },
    { key: "sec", label: "Pulled with", align: "right", render: (r) => mss(r.sec), sort: (r) => r.sec },
    { key: "final", label: "Final", align: "right", tip: "Pulling team's goals first. OT / SO: decided in overtime or a shootout.", render: (r) => r.final },
    { key: "out", label: "What happened", render: (r) => outcomeText[r.outcome] },
  ];
  const comebackCols: Column<Rec>[] = [
    ...recCols.slice(0, 2),
    { key: "deficit", label: "Trailing by", align: "right", render: (r) => r.deficit, sort: (r) => r.deficit },
    ...recCols.slice(2, 4),
  ];
  type Long = (typeof records.longest)[number];
  const longCols: Column<Long>[] = [
    {
      key: "date",
      label: "Date",
      render: (r) => (
        <span className="whitespace-nowrap">
          {friendlyDate(r.date)}
          {r.playoff ? " (playoffs)" : ""}
        </span>
      ),
      sort: (r) => r.date,
    },
    {
      key: "team",
      label: "Game",
      tip: "The pulling team first. vs: at home; at: on the road.",
      render: (r) => `${teamName(r.team)} ${r.home ? "vs" : "at"} ${teamName(r.opp)}`,
      sort: (r) => teamName(r.team),
    },
    { key: "deficit", label: "Trailing by", align: "right", render: (r) => r.deficit },
    { key: "from", label: "Goalie out", align: "right", render: (r) => `${mss(r.start)} → ${mss(r.end)}` },
    { key: "dur", label: "Length", align: "right", render: (r) => mss(r.duration), sort: (r) => r.duration },
  ];
  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">The earliest recorded goalie pulls</h3>
          <Segmented label="Deficit" value={d} onChange={setD} options={DEFICITS.map((x) => ({ value: x, label: DEFICIT_LABEL[x] }))} />
        </div>
        <SortableTable columns={recCols} rows={(records.earliest as Record<string, Rec[]>)[String(d)]} rowKey={(r, i) => `${r.date}${r.team}${i}`} />
        <Note>
          Regular season. Our data cleaning leaves out pulls with more than 5:00 left down one, 8:00 down two or 12:00
          down three, so no earlier pull can appear here.
        </Note>
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">The longest waits to pull while trailing by one</h3>
        <SortableTable columns={recCols} rows={records.latestDown1} rowKey={(r, i) => `${r.date}${r.team}${i}`} />
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">The longest stretches played without a goalie</h3>
        <SortableTable columns={longCols} rows={records.longest} rowKey={(r, i) => `${r.date}${r.team}${i}`} />
        <Note>
          A single continuous stretch with the goalie pulled, regular season and playoffs.
          {records.longest.every((r) => r.deficit >= 3) ? " Every one came when trailing by three or more." : ""}
        </Note>
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">
          Against the odds: comeback wins after pulling while down two or more goals ({records.comebacksFrom2Plus.length}{" "}
          games)
        </h3>
        <SortableTable columns={comebackCols} rows={records.comebacksFrom2Plus} rowKey={(r, i) => `${r.date}${r.team}${i}`} maxHeight={420} />
      </Card>
    </div>
  );
}
