import { AppLink as Link } from "@/lib/nav";
import { TrendChart, DeficitLegend } from "@/components/charts";
import { Card, Callout, Stat, Term } from "@/components/ui";
import { ACTUAL_2025, DEFICITS, hook, outcomes, rates, stakes, trend, value } from "@/lib/data";
import { fmt, lateness, mss, pct } from "@/lib/format";
import { useModel, useSolution } from "@/lib/model";

export default function Home() {
  const regular = useSolution("regular");
  const playoff = useSolution("playoff");
  const { isDefault } = useModel();
  const lp = regular.latestPull;
  const t1 = trend.tests.find((t) => t.deficit === 1)!;
  const first1 = trend.rows.find((r) => r.deficit === 1)!;
  const playoffTest = stakes.tests.find((t) => t.deficit === 1 && t.group === "playoffs")!;
  const bubbleTest = stakes.tests.find((t) => t.deficit === 1 && t.group === "bubbleLast10")!;

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">
            NHL goalie pulls, 2010–11 to 2026–27 · data + a dynamic-programming model
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-ink md:text-4xl">
            Edmonton pulled its goalie with {mss(hook.pullSec)} left in Game 7. Our model says {mss(playoff.latestPull[1])}.
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink">
            Down a goal with the 2024 Stanley Cup on the line, the Oilers waited until the final {hook.pullSec} seconds
            to send out a sixth skater, and never tied it. Too late? This site answers three questions:{" "}
            <strong>when do NHL teams actually pull the goalie, when does a model say they should, and do the two agree?</strong>
          </p>
          <p className="mt-3 text-[15px] text-muted">
            Written for hockey fans and the writers who cover them. The model's inner workings, on{" "}
            <Link className="text-brand underline" to="/model/hood">
              The model → Under the hood
            </Link>
            , are written for analysts.
          </p>
        </div>
        <Callout tone="finding">
          <p className="text-[17px] font-semibold">Short answer: they don't agree.</p>
          <p className="mt-2">
            NHL teams <Term id="pull">pull the goalie</Term> later than the model says at every deficit. The gap has
            narrowed every few seasons since 2010–11, but in 2025–26 teams down one goal still pulled{" "}
            <strong>{lateness(lp[1], ACTUAL_2025[1])}</strong> on average.
          </p>
        </Callout>
      </section>

      <section>
        <div className="grid gap-4 md:grid-cols-3">
          {DEFICITS.map((d) => (
            <Stat
              key={d}
              accent={d === 1}
              label={`Down ${d} goal${d > 1 ? "s" : ""}`}
              value={
                <span>
                  {mss(ACTUAL_2025[d])} <span className="text-lg font-medium text-muted">vs</span>{" "}
                  <span className="text-pull">{mss(lp[d])}</span>
                </span>
              }
              sub={
                <>
                  Teams' average pull in 2025–26 vs the model's latest optimal time ({lateness(lp[d], ACTUAL_2025[d])}).
                </>
              }
            />
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">
          Counting only each team's first pull of the game (dropping re-pulls after an empty-net goal), the 2025–26
          averages are {mss(rates.actual2025FirstOnly["1"])}, {mss(rates.actual2025FirstOnly["2"])} and{" "}
          {mss(rates.actual2025FirstOnly["3"])}: still far later than the model.
        </p>
        {!isDefault && (
          <p className="mt-2 text-[13px] text-pull">
            You have changed the scoring rates on The model tab; model numbers on this page use your rates.
          </p>
        )}
      </section>

      <section>
        <Card>
          <h2 className="text-xl font-semibold text-ink">Teams pull earlier every season, but nowhere near the model's time</h2>
          <p className="mt-1 text-[15px] text-muted">
            Average time left at the <Term id="first">first genuine pull</Term>, regular season, by{" "}
            <Term id="deficit">deficit</Term>. Dashed lines: the model's latest optimal pull time at the current
            scoring rates.
          </p>
          <div className="mt-3">
            <TrendChart stat="mean" deficits={DEFICITS} model={lp} height={430} />
          </div>
          <DeficitLegend deficits={DEFICITS} />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-ink">Five things to take away</h2>
        <ol className="grid gap-3 md:grid-cols-2">
          <Finding n={1} to="/model">
            <strong>Late at every deficit.</strong> In 2025–26 teams pulled at {mss(ACTUAL_2025[1])}, {mss(ACTUAL_2025[2])}{" "}
            and {mss(ACTUAL_2025[3])} when down 1, 2 and 3. The model says {mss(lp[1])}, {mss(lp[2])} and {mss(lp[3])}.
          </Finding>
          <Finding n={2} to="/actual">
            <strong>But getting earlier.</strong> Down one, the average pull moved from {mss(first1.mean)} in 2010–11 to{" "}
            {mss(ACTUAL_2025[1])} in 2025–26, about {fmt(t1.slope, 1)} seconds earlier each season (p &lt; 0.001).
          </Finding>
          <Finding n={3} to="/deeper/value">
            <strong>The cost is real but small.</strong> Pulling at the model's times instead of today's averages is worth
            about {fmt(value.perSeasonGain.optimalVsActual, 2)} standings points per team per 82-game season. Never pulling
            would cost {fmt(value.perSeasonGain.actualVsNever, 1)} more.
          </Finding>
          <Finding n={4} to="/deeper/stakes">
            <strong>Stakes don't change the timing.</strong> Playoff pulls come {fmt(Math.abs(playoffTest.coef), 0)} seconds{" "}
            {playoffTest.coef > 0 ? "earlier" : "later"} than regular-season ones down 1, and bubble teams' late-season pulls{" "}
            {fmt(Math.abs(bubbleTest.coef), 0)} seconds {bubbleTest.coef > 0 ? "earlier" : "later"}: neither is a significant
            difference. Yet the playoff objective says to pull even earlier ({mss(playoff.latestPull[1])} vs {mss(lp[1])}).
          </Finding>
          <Finding n={5} to="/deeper/outcomes">
            <strong>Pulling works more than it used to.</strong> {pct(outcomes.pooled["1"].cameBack, 1)} of down-1 pulls
            since 2010–11 got the game to overtime or better, and the odds have risen over time (p &lt; 0.001). About{" "}
            {pct(outcomes.pooled["1"].conceded, 0)} ended with another goal against.
          </Finding>
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Explore to="/actual" title="When teams pull">
          The trend by season and deficit, full distributions, home vs road, and the records.
        </Explore>
        <Explore to="/model" title="The model">
          Move the scoring rates and watch the optimal pull time change. Includes a playoff mode and a "should they pull
          now?" calculator.
        </Explore>
        <Explore to="/deeper" title="Deeper dives">
          Points left on the table, team rankings, line changes, what happens after a pull, and whether stakes matter.
        </Explore>
      </section>
    </div>
  );
}

function Finding({ n, to, children }: { n: number; to: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3 rounded-xl border border-line bg-white p-4">
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{n}</span>
      <div className="text-[15px] leading-relaxed">
        {children}{" "}
        <Link to={to} className="whitespace-nowrap text-brand underline">
          See more
        </Link>
      </div>
    </li>
  );
}

function Explore({ to, title, children }: { to: string; title: string; children: React.ReactNode }) {
  return (
    <Link to={to} className="group rounded-xl border border-line bg-white p-5 transition hover:border-brand hover:shadow-md">
      <div className="font-semibold text-ink group-hover:text-brand">{title} →</div>
      <p className="mt-1 text-[14px] text-muted">{children}</p>
    </Link>
  );
}
