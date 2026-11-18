import { useMemo, useState } from "react";
import { useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { AXIS, ChartTooltipBox, DeficitLegend, GRID, TrendChart, xLabel, yLabel } from "@/components/charts";
import { SortableTable, type Column } from "@/components/SortableTable";
import { Card, Note, Segmented, SectionTitle, SubTabs, Term } from "@/components/ui";
import { DEFICITS, distribution, homeRoad, meta, records, trend, type Deficit } from "@/lib/data";
import { DEFICIT_COLORS, DEFICIT_LABEL, fmt, int, mss, pval, signed } from "@/lib/format";
import { useSolution } from "@/lib/model";

const TABS = [
  { id: "trend", label: "Trend by season" },
  { id: "distribution", label: "Distribution" },
  { id: "home-road", label: "Home vs road" },
  { id: "records", label: "Records" },
];

export default function Actual() {
  const { sub } = useParams();
  return (
    <div>
      <SectionTitle
        sub={
          <>
            Every regular-season <Term id="first">first genuine pull</Term> from 2010–11 through November 7, 2026:{" "}
            {int(meta.firstPulls)} pulls. Times are minutes:seconds left in regulation when the goalie came off.
          </>
        }
      >
        When NHL teams actually pull the goalie
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
  const rows: SeasonRow[] = useMemo(() => {
    const seasons = [...new Set(trend.rows.map((r) => r.season))];
    return seasons.map((s) => {
      const o: SeasonRow = { season: s, partial: false };
      for (const d of DEFICITS) {
        const t = trend.rows.find((r) => r.season === s && r.deficit === d)!;
        o.partial = t.partial;
        o[`n${d}`] = t.n;
        o[`v${d}`] = t[stat];
      }
      return o;
    });
  }, [stat]);
  const pooledRow: SeasonRow = { season: "All full seasons", partial: false };
  for (const p of trend.pooled) {
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
        tip: `Number of first genuine pulls when trailing by ${d}.`,
        align: "right" as const,
        render: (r: SeasonRow) => int(r[`n${d}`] as number),
        sort: (r: SeasonRow) => r[`n${d}`] as number,
      },
      {
        key: `v${d}`,
        label: `Down ${d}: ${stat}`,
        tip: `${stat === "mean" ? "Average" : "Median"} time left (m:ss) at the first genuine pull when trailing by ${d}.`,
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
        </div>
        <TrendChart stat={stat} deficits={shown} showBand={band} height={400} />
        <DeficitLegend deficits={shown} />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {trend.tests.map((t) => (
            <div key={t.deficit} className="rounded-lg bg-ice px-3 py-2 text-[14px]">
              <span className="font-semibold">{DEFICIT_LABEL[t.deficit]}:</span> {fmt(t.slope, 1)} s earlier per season (±
              {fmt(1.96 * t.se, 1)} s, {pval(t.p)}, n = {int(t.n)})
            </div>
          ))}
        </div>
        <Note>
          Trend test: linear regression of each pull's time left on season (2010–11 = 0), full seasons only. The class
          figure shows down 1 rising from about 1.2 to about 1.9 minutes; our data give {mss(trend.rows[0].mean)} to{" "}
          {mss(trend.rows.find((r) => r.season === "2025–26" && r.deficit === 1)!.mean)}. 2012–13 (48 games), 2019–20 and
          2020–21 were short seasons, and 2026–27 covers games through November 7 only.
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
        <Mini label="Model says" value={mss(model)} red />
      </div>
      <ResponsiveContainer width="100%" height={340}>
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
          <YAxis tick={AXIS} allowDecimals={false} label={yLabel("Pulls")} width={76} />
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
      </ResponsiveContainer>
      <Note>
        Each bar is {bin} seconds wide. Down 1 the distribution is tight; down 3 it is wide, because the score, the opponent
        and the coach all vary more. The red line is the model's latest optimal pull time (regular season, current rates).
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
      <h3 className="font-semibold">Do road teams pull earlier?</h3>
      <p className="mb-3 mt-1 text-[15px] text-muted">
        Not by a meaningful margin. Home and road teams pull within about 4 seconds of each other at every deficit, and
        none of the differences is significant at the 5% level. Full seasons 2010–11 to 2025–26.
      </p>
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
    { key: "date", label: "Date", render: (r) => r.date, sort: (r) => r.date },
    { key: "team", label: "Team", render: (r) => `${r.team} ${r.home ? "vs" : "at"} ${r.opp}`, sort: (r) => r.team },
    { key: "sec", label: "Pulled with", align: "right", render: (r) => mss(r.sec), sort: (r) => r.sec },
    { key: "final", label: "Final", align: "right", tip: "Pulling team's goals first. OT / SO: decided in overtime or a shootout.", render: (r) => r.final },
    { key: "out", label: "What happened", render: (r) => outcomeText[r.outcome] },
  ];
  type Long = (typeof records.longest)[number];
  const longCols: Column<Long>[] = [
    { key: "date", label: "Date", render: (r) => `${r.date}${r.playoff ? " (playoffs)" : ""}` },
    { key: "team", label: "Team", render: (r) => `${r.team} vs ${r.opp}` },
    { key: "deficit", label: "Deficit", align: "right", render: (r) => `Down ${r.deficit}` },
    { key: "from", label: "Goalie out", align: "right", render: (r) => `${mss(r.start)} → ${mss(r.end)}` },
    { key: "dur", label: "Length", align: "right", render: (r) => mss(r.duration), sort: (r) => r.duration },
  ];
  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h3 className="font-semibold">Earliest first pulls, regular season</h3>
          <Segmented label="Deficit" value={d} onChange={setD} options={DEFICITS.map((x) => ({ value: x, label: DEFICIT_LABEL[x] }))} />
        </div>
        <SortableTable columns={recCols} rows={(records.earliest as Record<string, Rec[]>)[String(d)]} rowKey={(r, i) => `${r.date}${r.team}${i}`} />
        <Note>Window limits from the data cleaning apply: no pull earlier than 5:00 down 1, 8:00 down 2 or 12:00 down 3 is in the data.</Note>
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">Latest first pulls down one goal</h3>
        <SortableTable columns={recCols} rows={records.latestDown1} rowKey={(r, i) => `${r.date}${r.team}${i}`} />
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">Longest single empty-net spells</h3>
        <SortableTable columns={longCols} rows={records.longest} rowKey={(r, i) => `${r.date}${r.team}${i}`} />
        <Note>
          Genuine spells, regular season and playoffs.
          {records.longest.every((r) => r.deficit >= 3) ? " Every one came when trailing by three or more." : ""}
        </Note>
      </Card>
      <Card>
        <h3 className="mb-3 font-semibold">Comebacks from two or more down after pulling ({records.comebacksFrom2Plus.length} wins)</h3>
        <SortableTable columns={recCols} rows={records.comebacksFrom2Plus} rowKey={(r, i) => `${r.date}${r.team}${i}`} maxHeight={420} />
      </Card>
    </div>
  );
}
