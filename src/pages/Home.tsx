import { AppLink as Link } from "@/lib/nav";
import { TrendChart, DeficitLegend } from "@/components/charts";
import { Card, Callout, Stat, Term } from "@/components/ui";
import { ACTUAL_2025, DEFICITS, hook, outcomes, rates, stakes, trend, value } from "@/lib/data";
import { approxDuration, fmt, lateness, mss, pct } from "@/lib/format";
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
  const nSeasons = new Set(trend.rows.filter((r) => !r.partial).map((r) => r.season)).size;
  const hookGap = (playoff.latestPull[1] ?? 0) - hook.pullSec;
  const gap1 = (lp[1] ?? 0) - ACTUAL_2025[1];
  const outRow = (season: string) => {
    const r = outcomes.rows.find((x) => x.deficit === 1 && x.season === season)!;
    return { back: (r.won + r.tiedLostOT) / r.n, conceded: r.conceded / r.n };
  };
  const o0 = outRow("2010–11");
  const o1 = outRow("2025–26");

  return (
    <div className="space-y-10">
      <section className="grid gap-8 lg:grid-cols-[1.25fr_1fr] lg:items-center">
        <div>
          <p className="text-[13px] font-semibold uppercase tracking-wider text-brand">
            NHL goalie pulls, 2010–11 to today
          </p>
          <h1 className="mt-2 text-3xl font-bold leading-tight text-ink md:text-4xl">
            The Oilers waited until the final {hook.pullSec} seconds to pull their goalie.{" "}
            {hookGap > 0
              ? `Our model says they waited ${approxDuration(hookGap)} too long.`
              : playoff.latestPull[1] == null
                ? `At your scoring rates, our model would not pull at all.`
                : `At your scoring rates, our model agrees with waiting that long.`}
          </h1>
          <p className="mt-4 text-[17px] leading-relaxed text-ink">
            Trailing by one goal in Game 7 of the 2024 Stanley Cup Final, the Edmonton Oilers waited until just{" "}
            {hook.pullSec} seconds remained to pull their goalie. They never scored the tying goal. But what if they had
            pulled earlier?
          </p>
          <p className="mt-3 text-[17px] leading-relaxed text-ink">
            Using {nSeasons} seasons of NHL data and a mathematical model, we explore when teams actually pull their
            goalies, when they should, and how much waiting might be costing them.
          </p>
          <p className="mt-3 text-[15px] text-muted">
            Written for hockey fans and the writers who cover them. The model's "Under the hood" tab is for analysts who want
            to check or extend the math.
          </p>
        </div>
        <Callout tone="finding">
          <p className="text-[17px] font-semibold">The bottom line: NHL teams are still pulling their goalies too late.</p>
          <p className="mt-2">
            NHL teams consistently wait longer to <Term id="pull">pull their goalies</Term> than our model recommends.
            Coaches have gradually started pulling earlier, but the gap remains substantial. In the 2025–26 season,
            teams trailing by one goal{" "}
            {gap1 > 0 ? (
              <>
                waited <strong>{approxDuration(gap1)} longer</strong> than the model suggests.
              </>
            ) : (
              <>pulled {lateness(lp[1], ACTUAL_2025[1])} at the scoring rates you have set.</>
            )}
          </p>
        </Callout>
      </section>

      <section>
        <div className="grid gap-4 md:grid-cols-3">
          {DEFICITS.map((d) => (
            <Stat
              key={d}
              accent={d === 1}
              label={`Down ${d} goal${d > 1 ? "s" : ""}: teams vs the model`}
              value={
                <span>
                  {mss(ACTUAL_2025[d])} <span className="text-lg font-medium text-muted">vs</span>{" "}
                  <span className="text-pull">{mss(lp[d])}</span>
                </span>
              }
              sub={
                <>
                  Teams' average pull time in 2025–26 vs the time our model recommends ({lateness(lp[d], ACTUAL_2025[d])}).
                </>
              }
            />
          ))}
        </div>
        <p className="mt-2 text-[13px] text-muted">
          Counting only each team's first pull of the game (leaving out second pulls after an empty-net goal), the
          2025–26 averages are {mss(rates.actual2025FirstOnly["1"])}, {mss(rates.actual2025FirstOnly["2"])} and{" "}
          {mss(rates.actual2025FirstOnly["3"])}: still far later than the model.
        </p>
        {!isDefault && (
          <p className="mt-2 text-[13px] text-pull">
            You have changed the scoring rates on the model page, so the model numbers here use your rates.
          </p>
        )}
      </section>

      <section>
        <Card>
          <h2 className="text-xl font-semibold text-ink">
            NHL teams are pulling their goalies earlier, but there's still a significant gap
          </h2>
          <p className="mt-1 text-[15px] text-muted">
            Average time left when teams <Term id="first">first pulled their goalie</Term> in regular-season games, by how
            many goals they trailed. Dashed lines show the time our model recommends.
          </p>
          <div className="mt-3">
            <TrendChart stat="mean" deficits={DEFICITS} model={lp} height={430} />
          </div>
          <DeficitLegend deficits={DEFICITS} model={lp} />
        </Card>
      </section>

      <section>
        <h2 className="mb-3 text-xl font-semibold text-ink">Five things to take away</h2>
        <ol className="grid gap-3 md:grid-cols-2">
          <Finding n={1} to="/model" title="Teams are waiting too long, regardless of the score.">
            In 2025–26, teams pulled with {mss(ACTUAL_2025[1])}, {mss(ACTUAL_2025[2])} and {mss(ACTUAL_2025[3])} left when
            trailing by one, two and three goals. Our model recommends {mss(lp[1])}, {mss(lp[2])} and {mss(lp[3])}.
          </Finding>
          <Finding n={2} to="/actual" title="Coaches are slowly changing their approach.">
            When trailing by one, the average pull moved from {mss(first1.mean)} left in 2010–11 to{" "}
            {mss(ACTUAL_2025[1])} in 2025–26, about {fmt(t1.slope, 1)} seconds earlier per season. Some seasons moved later,
            but the overall trend is clear (p &lt; 0.001).
          </Finding>
          <Finding n={3} to="/deeper/value" title="Waiting too long costs teams points in the standings.">
            Our model estimates that pulling earlier could earn the average NHL team an additional{" "}
            {fmt(value.perSeasonGain.optimalVsActual, 2)} standings points per season. That might sound small, but in a
            tight playoff race, every point matters.
          </Finding>
          <Finding n={4} to="/deeper/stakes" title="Even the playoffs don't convince coaches to pull earlier.">
            When trailing by one, playoff pulls come only {fmt(Math.abs(playoffTest.coef), 0)} seconds{" "}
            {playoffTest.coef > 0 ? "earlier" : "later"} than regular-season pulls, and bubble teams' pulls in their last 10
            games {fmt(Math.abs(bubbleTest.coef), 0)} seconds {bubbleTest.coef > 0 ? "earlier" : "later"}. Neither
            difference is statistically significant, even though our model says playoff games call for pulling even
            earlier ({mss(playoff.latestPull[1])} vs {mss(lp[1])}).
          </Finding>
          <Finding n={5} to="/deeper/outcomes" title="Pulling the goalie is becoming a bigger gamble." wide>
            Teams trailing by one goal are increasingly likely to force overtime after pulling their goalie{" "}
            <span className="whitespace-nowrap">({pct(o0.back, 0)} of pulls in 2010–11,</span> {pct(o1.back, 0)} in 2025–26), but they're also more likely to concede
            another goal ({pct(o0.conceded, 0)} to {pct(o1.conceded, 0)}). That is consistent with earlier pulls: more time
            with an extra attacker means more chances to score, and more time with an empty net.
          </Finding>
        </ol>
      </section>

      <section className="grid gap-4 md:grid-cols-3">
        <Explore to="/actual" title="When teams pull">
          How pull timing has changed by season and score, home vs road, and the record books.
        </Explore>
        <Explore to="/model" title="The model">
          Move the scoring rates and watch the recommended pull time change. Includes a playoff mode and a "should they
          pull now?" calculator.
        </Explore>
        <Explore to="/deeper" title="Deeper dives">
          Points left on the table, which teams pull earliest, line changes, whether pulling works, and whether the stakes
          matter.
        </Explore>
      </section>
    </div>
  );
}

function Finding({
  n,
  to,
  title,
  wide = false,
  children,
}: {
  n: number;
  to: string;
  title: string;
  wide?: boolean;
  children: React.ReactNode;
}) {
  return (
    <li className={`flex gap-3 rounded-xl border border-line bg-white p-4 ${wide ? "md:col-span-2" : ""}`}>
      <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-brand text-sm font-semibold text-white">{n}</span>
      <div className="text-[15px] leading-relaxed">
        <div className="mb-1 font-semibold text-ink">{title}</div>
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
