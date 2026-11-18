import { useMemo } from "react";
import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { trend, type Deficit } from "@/lib/data";
import { DEFICIT_COLORS, DEFICIT_LABEL, mss, secondTicks } from "@/lib/format";

export const AXIS = { fontSize: 13, fill: "#475569" };
export const GRID = "#e2e8f0";

export function yLabel(value: string) {
  return { value, angle: -90, position: "insideLeft" as const, offset: 0, style: { textAnchor: "middle" as const, ...AXIS } };
}
export function xLabel(value: string) {
  return { value, position: "insideBottom" as const, offset: -12, style: AXIS };
}

export function ChartTooltipBox({ title, lines }: { title: string; lines: { color?: string; text: string }[] }) {
  return (
    <div className="rounded-lg border border-line bg-white px-3 py-2 text-[13px] shadow-md">
      <div className="mb-1 font-semibold text-ink">{title}</div>
      {lines.map((l, i) => (
        <div key={i} className="flex items-center gap-2 text-ink">
          {l.color && <span className="inline-block h-2.5 w-2.5 rounded-full" style={{ background: l.color }} />}
          <span className="tabular-nums">{l.text}</span>
        </div>
      ))}
    </div>
  );
}

type Stat = "mean" | "median";
interface TrendProps {
  stat: Stat;
  deficits: Deficit[];
  showBand?: boolean;
  model?: Partial<Record<Deficit, number | null>>;
  height?: number;
}

/** Time left at the first genuine pull, by season and deficit. 2026–27 (partial) is drawn hollow and dashed. */
export function TrendChart({ stat, deficits, showBand = false, model, height = 380 }: TrendProps) {
  const data = useMemo(() => {
    const seasons = [...new Set(trend.rows.map((r) => r.season))];
    return seasons.map((season, si) => {
      const row: Record<string, unknown> = { season, partial: false };
      for (const d of [1, 2, 3] as Deficit[]) {
        const t = trend.rows.find((r) => r.season === season && r.deficit === d)!;
        const v = t[stat];
        const isPartial = t.partial;
        row.partial = isPartial;
        row[`n${d}`] = t.n;
        row[`v${d}`] = v;
        row[`s${d}`] = isPartial ? null : v; // solid segment
        const nextPartial = seasons[si + 1] && trend.rows.find((r) => r.season === seasons[si + 1])?.partial;
        row[`t${d}`] = isPartial || nextPartial ? v : null; // dashed tail into the partial season
        row[`b${d}`] = [t.p25, t.p75];
      }
      return row;
    });
  }, [stat]);

  const maxData = Math.max(
    ...trend.rows.filter((r) => deficits.includes(r.deficit as Deficit)).map((r) => (showBand ? r.p75 : r[stat])),
  );
  const maxModel = Math.max(0, ...deficits.map((d) => model?.[d] ?? 0));
  const top = Math.max(maxData, maxModel) * 1.05;
  const step = top > 600 ? 120 : 60;
  const ticks = secondTicks(top, step);

  return (
    <ResponsiveContainer width="100%" height={height}>
      <ComposedChart data={data} margin={{ top: 10, right: model ? 150 : 44, bottom: 28, left: 4 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis dataKey="season" tick={AXIS} interval={1} tickMargin={6} label={xLabel("Season")} />
        <YAxis
          tick={AXIS}
          ticks={ticks}
          domain={[0, ticks[ticks.length - 1]]}
          tickFormatter={(v: number) => mss(v)}
          width={76}
          label={yLabel("Time left at first pull (m:ss)")}
        />
        <Tooltip
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            const p = payload[0].payload as Record<string, number | string | boolean>;
            return (
              <ChartTooltipBox
                title={`${p.season}${p.partial ? " (partial, to Nov 7)" : ""}`}
                lines={deficits.map((d) => ({
                  color: DEFICIT_COLORS[d],
                  text: `${DEFICIT_LABEL[d]}: ${mss(p[`v${d}`] as number)} ${stat} (n = ${p[`n${d}`]})`,
                }))}
              />
            );
          }}
        />
        {showBand &&
          deficits.map((d) => (
            <Area
              key={`band${d}`}
              dataKey={`b${d}`}
              stroke="none"
              fill={DEFICIT_COLORS[d]}
              fillOpacity={0.1}
              isAnimationActive={false}
              activeDot={false}
            />
          ))}
        {model &&
          deficits.map((d) =>
            model[d] != null ? (
              <ReferenceLine
                key={`m${d}`}
                y={model[d]!}
                stroke={DEFICIT_COLORS[d]}
                strokeDasharray="6 4"
                strokeWidth={1.5}
                ifOverflow="extendDomain"
                label={{ value: `Model, ${DEFICIT_LABEL[d].toLowerCase()}: ${mss(model[d]!)}`, position: "right", fill: DEFICIT_COLORS[d], fontSize: 13 }}
              />
            ) : null,
          )}
        {deficits.map((d) => (
          <Line
            key={`s${d}`}
            dataKey={`s${d}`}
            stroke={DEFICIT_COLORS[d]}
            strokeWidth={2.5}
            dot={{ r: 3, fill: DEFICIT_COLORS[d] }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
            connectNulls={false}
          />
        ))}
        {deficits.map((d) => (
          <Line
            key={`t${d}`}
            dataKey={`t${d}`}
            stroke={DEFICIT_COLORS[d]}
            strokeWidth={1.5}
            strokeDasharray="3 3"
            isAnimationActive={false}
            activeDot={false}
            dot={(props: { cx?: number; cy?: number; payload?: { partial?: boolean }; index?: number }) =>
              props.payload?.partial && props.cx != null && props.cy != null ? (
                <circle key={`pd${d}-${props.index}`} cx={props.cx} cy={props.cy} r={4} fill="white" stroke={DEFICIT_COLORS[d]} strokeWidth={2} />
              ) : (
                <g key={`nd${d}-${props.index}`} />
              )
            }
          />
        ))}
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function DeficitLegend({ deficits, dashedNote = true }: { deficits: Deficit[]; dashedNote?: boolean }) {
  return (
    <div className="mt-1 flex flex-wrap items-center gap-x-5 gap-y-1 text-[13px] text-muted">
      {deficits.map((d) => (
        <span key={d} className="inline-flex items-center gap-2">
          <span className="inline-block h-0.5 w-6" style={{ background: DEFICIT_COLORS[d] }} />
          {DEFICIT_LABEL[d]}
        </span>
      ))}
      {dashedNote && (
        <span className="inline-flex items-center gap-2">
          <svg width="14" height="14" aria-hidden>
            <circle cx="7" cy="7" r="4" fill="white" stroke="#475569" strokeWidth="2" />
          </svg>
          2026–27, games through Nov 7 (partial)
        </span>
      )}
    </div>
  );
}

/** Model vs actual: one row per deficit, a dot for each, joined by a line. */
export function Dumbbell({
  actual,
  model,
  actualLabel,
  modelLabel,
}: {
  actual: Record<Deficit, number>;
  model: Partial<Record<Deficit, number | null>>;
  actualLabel: string;
  modelLabel: string;
}) {
  const W = 1000;
  const left = 92;
  const right = 40;
  const rowH = 58;
  const top = 44;
  const H = top + rowH * 3 + 56;
  const maxV = Math.max(...([1, 2, 3] as Deficit[]).map((d) => Math.max(actual[d], model[d] ?? 0)));
  const ticks = secondTicks(Math.max(maxV * 1.08, 300), maxV > 600 ? 120 : 60);
  const xMax = ticks[ticks.length - 1];
  const X = (s: number) => left + (s / xMax) * (W - left - right);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label="Model versus actual pull times by deficit">
      <g fontSize="13" fill="#475569">
        <circle cx={left} cy={16} r={6} fill="#94a3b8" />
        <text x={left + 12} y={20}>{actualLabel}</text>
        <circle cx={left + 260} cy={16} r={6} fill="#dc2626" />
        <text x={left + 272} y={20}>{modelLabel}</text>
      </g>
      {ticks.map((t) => (
        <g key={t}>
          <line x1={X(t)} x2={X(t)} y1={top - 6} y2={top + rowH * 3} stroke={GRID} />
          <text x={X(t)} y={top + rowH * 3 + 20} textAnchor="middle" fontSize="13" fill="#475569">
            {mss(t)}
          </text>
        </g>
      ))}
      <text x={(left + W - right) / 2} y={H - 8} textAnchor="middle" fontSize="13" fill="#475569">
        Time left when the goalie comes off (m:ss)
      </text>
      {([1, 2, 3] as Deficit[]).map((d, i) => {
        const y = top + rowH * i + rowH / 2;
        const a = actual[d];
        const m = model[d];
        return (
          <g key={d}>
            <text x={left - 14} y={y + 5} textAnchor="end" fontSize="14" fontWeight="600" fill="#0f172a">
              {DEFICIT_LABEL[d]}
            </text>
            {m != null && <line x1={X(a)} x2={X(m)} y1={y} y2={y} stroke="#cbd5e1" strokeWidth={6} strokeLinecap="round" />}
            <circle cx={X(a)} cy={y} r={8} fill="#94a3b8">
              <title>{`${DEFICIT_LABEL[d]}: teams pull at ${mss(a)}`}</title>
            </circle>
            <text x={X(a)} y={y - 14} textAnchor="middle" fontSize="13" fill="#475569" className="tabular-nums">
              {mss(a)}
            </text>
            {m != null && (
              <>
                <circle cx={X(m)} cy={y} r={8} fill="#dc2626">
                  <title>{`${DEFICIT_LABEL[d]}: model says pull at ${mss(m)}`}</title>
                </circle>
                <text x={X(m)} y={y - 14} textAnchor="middle" fontSize="13" fontWeight="600" fill="#b91c1c" className="tabular-nums">
                  {mss(m)}
                </text>
              </>
            )}
          </g>
        );
      })}
    </svg>
  );
}
