import { AppLink as Link } from "@/lib/nav";
import { SortableTable, type Column } from "@/components/SortableTable";
import { Card, SectionTitle } from "@/components/ui";
import { ACTUAL_2025, meta, outcomes, rates, stakes, trend, value } from "@/lib/data";
import { solveDP } from "@/lib/dp";
import { GLOSSARY } from "@/lib/glossary";
import { fmt, int, mss, pct } from "@/lib/format";

export default function About() {
  const lp = solveDP({ r55: rates.chosen.r55, r65: rates.chosen.r65, r56: rates.chosen.r56 }).latestPull;
  type Comp = (typeof rates.components)[number];
  const cols: Column<Comp>[] = [
    { key: "label", label: "DP input", render: (r) => r.label },
    { key: "rate", label: "Goals per 60", align: "right", render: (r) => <strong>{fmt(r.rate)}</strong> },
    { key: "situation", label: "Situation (skill output label)", render: (r) => r.situation, className: "whitespace-normal min-w-[12rem]" },
    { key: "filter", label: "Filter", render: (r) => r.filter, className: "whitespace-normal min-w-[12rem]" },
    { key: "goals", label: "Goals", align: "right", render: (r) => int(r.goals) },
    { key: "hours", label: "Hours", align: "right", render: (r) => fmt(r.seconds / 3600, 1) },
  ];
  const t1 = trend.tests.find((t) => t.deficit === 1)!;
  const optD = rates.options.find((o) => o.id === "D")!;
  const optC = rates.options.find((o) => o.chosen)!;
  const shifts = (["1", "2", "3"] as const).map((k) => (optD.latest[k] ?? 0) - (optC.latest[k] ?? 0));
  const dShift = [Math.min(...shifts), Math.max(...shifts)];
  const ref = rates.reference;
  return (
    <div className="space-y-6">
      <SectionTitle>About this site and how it was built</SectionTitle>

      <Card>
        <div className="prose-site">
          <h3 className="!mt-0">What it is and who it's for</h3>
          <p>
            <strong>The question:</strong> when do NHL teams actually pull the goalie, when does a dynamic-programming model
            say they should, and do the two agree? The site answers it for 2010–11 through games of November 7, 2026, and
            then asks what late pulls cost, which teams pull earliest, whether line changes or stakes change the answer, and
            what happens after a pull.
          </p>
          <p>
            <strong>Audience:</strong> hockey fans and the writers who cover them. The "Under the hood" view of the model is
            written for a data-science audience who want to check or extend the model. Built for Columbia Business School
            B8131 Sports Analytics.
          </p>

          <h3>Key findings</h3>
          <ol>
            <li>
              Teams pull later than the model says at every deficit. In 2025–26 the average first pull came at{" "}
              {mss(ACTUAL_2025[1])} down 1, {mss(ACTUAL_2025[2])} down 2 and {mss(ACTUAL_2025[3])} down 3; the model says{" "}
              {mss(lp[1])}, {mss(lp[2])} and {mss(lp[3])}.
            </li>
            <li>
              The gap is closing slowly: down 1, teams pull about {fmt(t1.slope, 1)} seconds earlier each season (p &lt; 0.001).
            </li>
            <li>
              The cost of pulling late is about {fmt(value.perSeasonGain.optimalVsActual, 2)} standings points per team per
              season, while pulling at all is worth about {fmt(value.perSeasonGain.actualVsNever, 1)}. Neither the playoffs
              nor a bubble team's stretch run makes coaches pull earlier.
            </li>
          </ol>
        </div>
      </Card>

      <Card>
        <div className="prose-site">
          <h3 className="!mt-0">Glossary</h3>
        </div>
        <dl className="grid gap-x-6 gap-y-3 md:grid-cols-2">
          {Object.values(GLOSSARY).map((g) => (
            <div key={g.term}>
              <dt className="font-semibold text-ink">{g.term}</dt>
              <dd className="text-[14px] leading-relaxed text-muted">{g.def}</dd>
            </div>
          ))}
        </dl>
      </Card>

      <Card>
        <div className="prose-site">
          <h3 className="!mt-0">The model's three scoring rates, and why</h3>
          <p>
            The course's scoring-rate skill sums every second of 2025–26 play by on-ice situation, from both teams'
            perspectives, and divides goals by time (goals × 3600 ÷ seconds). We re-ran it and matched the pipeline check
            (5v4 = {fmt(ref.ppPipelineCheck)} goals per 60). We then combined its situations into the three numbers the
            model needs:
          </p>
        </div>
        <SortableTable columns={cols} rows={rates.components} rowKey={(r) => r.key} />
        <div className="prose-site mt-4">
          <ul>
            <li>
              <strong>5v5 = {fmt(rates.chosen.r55)}:</strong> even-strength play with both goalies in, from the 3rd period only.
              Pull decisions happen late, when players are tired and teams play more conservatively; 3rd-period 5v5 scoring is
              lower than the all-game rate ({fmt(ref.r55All.rate)}). The sample is still large ({int(rates.components[0].goals)}{" "}
              goals). One rate is used for both teams because the model has one 5v5 rate. MoneyPuck's league 5v5 rate for the
              same season ({fmt(ref.moneypuck5v5)}, all periods) is a close cross-check.
            </li>
            <li>
              <strong>Pulled offense = {fmt(rates.chosen.r65)}:</strong> six attackers against five with our goalie pulled,
              restricted to <em>pull context</em> (3rd period, six-skater side trailing).
            </li>
            <li>
              <strong>Empty-net defense = {fmt(rates.chosen.r56)}:</strong> the opponent's rate into our empty net, same filter.
              Without the filter the rate is {fmt(ref.uncorrected5v6.rate)}: the same {ref.uncorrected5v6.goals} goals spread over{" "}
              {int(ref.delayedPenaltySeconds)} more seconds. Those extra seconds are mostly delayed penalties, when the empty
              net cannot be scored on, so leaving them in would make the empty net look about 3 goals per 60 safer than it is
              and push the model's pull {mss(dShift[0])} to {mss(dShift[1])} earlier, depending on the deficit.
            </li>
            <li>
              <strong>Not pooled with power-play pulls:</strong> the model has no penalty states, so 6-on-4 time would mix a
              different situation into the even-strength rate. The model page shows the alternatives side by side; none
              changes the conclusion.
            </li>
          </ul>
        </div>
      </Card>

      <Card>
        <div className="prose-site">
          <h3 className="!mt-0">Filters, edge cases and why</h3>
          <ul>
            <li>
              <strong>Delayed penalties:</strong> the pull-time views use genuine spells only (at least 20 seconds, a goal, or to
              the horn). The scoring rates use pull context only (above).
            </li>
            <li>
              <strong>Re-pulls:</strong> the required view follows the course definition: the first genuine spell per game, team
              and deficit. A team that pulls down 1, concedes an empty-net goal and pulls again down 2 therefore contributes a
              down-1 pull and a down-2 pull. Those re-pulls are {pct(meta.repulls["2"].share, 0)} of down-2 rows and come late
              ({mss(meta.repulls["2"].meanRepull)} on average), so they pull the down-2 average toward the horn. The trend view has an
              "Exclude re-pulls" switch, and the model comparison reports both versions; the conclusion is the same either way.
              Re-pulls are identified from the order of each team's genuine spells, not from <code>n_prior_spells</code> (see
              below).
            </li>
            <li>
              <strong>Playoffs:</strong> the trend and team views are regular season only. Playoff games ({int(meta.spellsPlayoff)}{" "}
              spells) appear only where we compare them deliberately (Do stakes matter?) and in the Game 7 opening story.
            </li>
            <li>
              <strong>Zero or negative deficits:</strong> we checked both files; {meta.nonPositiveDeficits} such rows remain after
              the course cleaning, so none needed removing.
            </li>
            <li>
              <strong>Partial season:</strong> 2026–27 covers games through {meta.dataThrough} ({meta.partialSeason.down1} down-1
              pulls against about 500 in a full season). It is drawn hollow or faded on every chart and left out of every
              trend test and pooled average.
            </li>
            <li>
              <strong>Short seasons:</strong> 2012–13 ({meta.shortSeasons["2012–13"]} games), 2019–20 ({meta.shortSeasons["2019–20"]})
              and 2020–21 ({meta.shortSeasons["2020–21"]}) have fewer pulls and noisier averages. 2019–20 is excluded from the
              stakes comparison because it had no normal stretch run.
            </li>
            <li>
              <strong>Course data cleaning (already applied):</strong> {int(meta.cleaning.removed)} of {int(meta.cleaning.rawSpells)} raw
              spells were removed: five-plus-minute spells with no goals (tracking errors), spells while tied or leading, and
              spells outside each deficit's plausibility window (5:00 down 1, 8:00 down 2, 12:00 down 3, 15:00 deeper). So no
              pull earlier than those windows can appear in the data.
            </li>
            <li>
              <strong>Franchises:</strong> Atlanta → Winnipeg and Phoenix/Arizona → Utah are one franchise each, so no team is
              split under two names in the franchise table. Team-season tables show the name the team used that season.
            </li>
            <li>
              <strong>Bubble teams:</strong> with 10 games left, a team that reaches last season's playoff line with a 7–3
              finish but not with a 3–7 finish. The line is the points % of the 8th-place team in its conference the season
              before (4th per division in 2020–21), with conference membership taken from the NHL's published alignments.
              2010–11 is excluded because the previous season is not in the data.
            </li>
          </ul>

          <h3>Data problems we found beyond the cleaning, and what we did</h3>
          <ul>
            <li>
              <strong>Goals during pulls are missing before 2024–25.</strong> The pull file's goal columns are zero for every
              spell from the <code>pbp</code> source ({int(meta.sourceColumn.pbpSpells)} spells, all seasons before 2024–25) and
              filled only for the <code>shifts</code> source ({int(meta.sourceColumn.shiftsSpells)} spells, 2024–25 on). We did not
              use those columns for any trend. Instead, "what happened after the pull" comes from each game's final score, which
              agrees with the spell goals in {pct(outcomes.validation.agree / outcomes.validation.n, 1)} of down-1 pulls where both
              exist. A side effect we left alone: for older seasons the genuine flag's "contained a goal" test can't fire, so a
              very short pre-2024 spell that produced a goal may be missing. Such spells are rare and would barely move the
              averages.
            </li>
            <li>
              <strong>Cross-check of the first-pull file:</strong> rebuilding first pulls from the spell file (regular season,
              genuine, earliest spell per game, team and deficit) gives {int(meta.rebuiltFirstPulls)} rows, exactly matching the{" "}
              {int(meta.firstPulls)} in <code>first_pulls.txt</code>.
            </li>
            <li>
              <strong><code>n_prior_spells</code> can't identify re-pulls on its own.</strong> It counts every earlier goalie-out
              spell, including delayed-penalty blips and spells the course cleaning removed. {int(meta.nPriorCountsRemoved)} teams'
              first genuine pull of a game has <code>n_prior_spells</code> above zero, so filtering on it would wrongly drop real first
              pulls. We used spell order instead.
            </li>
            <li>
              <strong>Odd on-ice states in the 2025–26 intervals:</strong> 344 seconds with fewer than 3 or more than 6 skaters,
              624 seconds with six skaters and the goalie still in, and 1,033 seconds with both goalies out. These are tracking
              glitches or line-change moments. None of them enters our three rates, which need exactly 5v5 with both goalies in, or
              6v5 and 5v6 with exactly one net empty, so we left them alone.
            </li>
            <li>
              <strong>2019–20 schedule:</strong> teams played 68 to 71 games before the season stopped. Points % handles the
              uneven counts in the team and stakes analyses.
            </li>
            <li>
              <strong>Two names for Utah</strong> in the results file (Utah Hockey Club, Utah Mammoth) are mapped to one team.
            </li>
            <li>
              <strong>Small samples:</strong> down-3 seasons have 11–105 pulls each, and teams about 15 down-1 pulls a season.
              Team ranks use Bayes shrinkage and require at least 8 pulls; we flag the noise rather than drop the data.
            </li>
          </ul>

          <h3>Methods for the deeper dives</h3>
          <ul>
            <li>
              <strong>Value of pulling:</strong> the model values three policies from 15:00 left (never pull, pull at 2025–26
              average times, pull at the model's times), weighted by how often teams face each score with 15:00 left in
              2025–26 ({int(value.teamGames)} team-games).
            </li>
            <li>
              <strong>Teams:</strong> normal–normal Bayes shrinkage (course Bayes skill) toward each season's league mean;
              standings points (2 per win, 1 per OT/SO loss) and SRS (course SRS skill) from the results file; regression via the
              course regression skill.
            </li>
            <li>
              <strong>Line changes:</strong> 6v5 rates by forward line from the skill's by-line run, scheduled back from the horn
              (44 / 40 / 38 / 36 seconds), with the overall rate before that final rotation.
            </li>
            <li>
              <strong>Stakes:</strong> {stakes.seasons.length} seasons; differences from a regression with season fixed effects,
              so the league-wide trend toward earlier pulls doesn't masquerade as a stakes effect.
            </li>
            <li>
              <strong>Significance tests:</strong> linear regression for trends, logistic regression for comeback rates, Welch
              t-tests for two-group comparisons. Reported p-values are two-sided.
            </li>
          </ul>

          <h3>The model, briefly</h3>
          <p>
            Backward recursion over goal difference (−8 to +8) and time left (one-second steps over the last 15 minutes). Each
            second, at most one goal; probabilities are rate ÷ 3600. Payoffs at the horn: 2 / 1.5 / 0 standings points in the
            regular season, 1 / 0.5 / 0 (win probability) in the playoffs. Full details and the value and decision grids are on{" "}
            <Link className="text-brand underline" to="/model/hood">
              The model → Under the hood
            </Link>
            ; the course test case (4:00 / 8:15 / 12:33) is verified live on{" "}
            <Link className="text-brand underline" to="/model/test">
              The model → Test case
            </Link>
            .
          </p>

          <h3>Sources</h3>
          <ul>
            <li>Course data files (B8131 Sports Analytics): pull spells, first pulls, game results, state intervals, scoring-rate skill output.</li>
            <li>
              Team summaries from{" "}
              <a className="text-brand underline" href="https://moneypuck.com" target="_blank" rel="noreferrer">
                MoneyPuck.com
              </a>{" "}
              (5v5 cross-check).
            </li>
            <li>
              Background: Meghan Hall,{" "}
              <a className="text-brand underline" href="https://hockey-graphs.com/2020/05/18/the-state-of-goalie-pulling-in-the-nhl/" target="_blank" rel="noreferrer">
                "The state of goalie pulling in the NHL"
              </a>{" "}
              (Hockey Graphs, 2020).
            </li>
            <li>Conference alignments: NHL announcements of the 2013 realignment, the 2017 Vegas and 2021 Seattle expansions, the 2020–21 temporary divisions, and Utah's 2024 entry.</li>
          </ul>
        </div>
      </Card>
    </div>
  );
}
