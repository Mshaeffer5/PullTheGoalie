"""Build every data file the site reads (src/data/*.json) from the course files.

Run from the repo root:  python3 analysis/build_data.py
Inputs (not committed, see analysis/data_raw/README.md): analysis/data_raw/*.txt
Skills (course-provided, not committed): analysis/skills/{scoring_rates,srs,bayes,regression}
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy import stats

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "analysis" / "data_raw"
OUT = ROOT / "src" / "data"
sys.path.insert(0, str(ROOT / "analysis"))
for skill in ("scoring_rates", "srs", "bayes", "regression"):
    sys.path.insert(0, str(ROOT / "analysis" / "skills" / skill))

from bayes import bayes_normal  # noqa: E402
from dp import PLAYOFF, REGULAR, evaluate_policy, line_rate_fn, line_schedule, solve  # noqa: E402
from regression import LinearRegTrain, LogisticRegTrain  # noqa: E402
from scoring_rates import rate_table  # noqa: E402
from srs import fit_srs  # noqa: E402
from teams import FRANCHISE_NAME, FULL_TO_ABBR, franchise, playoff_groups  # noqa: E402

RNG = np.random.default_rng(20261117)
PARTIAL_KEY = 20262027
DATA_THROUGH = "2026-11-07"
BUBBLE_RULE = "A 7-3 finish (14 points) reaches the line, a 3-7 finish (6 points) misses it"
MIN_TEAM_PULLS = 8

# The site's default DP rates (option B, agreed 2026-11-17): 5v5 from the 3rd period only;
# 6v5 and empty-net rates from pull context (3rd period, six-skater side trailing).
CHOSEN = "B"


def label_from_key(key: int) -> str:
    return f"{key // 10000}–{str(key % 10000)[2:]}"


def label_from_end(year: int) -> str:
    return f"{year - 1}–{str(year)[2:]}"


def r(x, nd=2):
    if x is None or (isinstance(x, float) and not np.isfinite(x)):
        return None
    return round(float(x), nd)


def write(name, obj):
    OUT.mkdir(parents=True, exist_ok=True)

    def conv(o):
        if isinstance(o, (np.integer,)):
            return int(o)
        if isinstance(o, (np.floating,)):
            return float(o)
        if isinstance(o, (np.bool_,)):
            return bool(o)
        raise TypeError(type(o))

    path = OUT / name
    path.write_text(json.dumps(obj, default=conv, ensure_ascii=False, separators=(",", ":")))
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.1f} KB)")


def ols(y, X: pd.DataFrame):
    """Linear regression via the course regression skill; returns {name: (coef, se, p)} and n."""
    res = LinearRegTrain(np.asarray(y, float), X.astype(float))
    out = {name: (float(c), float(s), float(p)) for name, c, s, p in zip(res.names, res.coef, res.se, res.pvalue)}
    return out, int(res.n_valid)


def season_dummies(seasons: pd.Series, prefix="s"):
    d = pd.get_dummies(seasons, prefix=prefix, drop_first=True).astype(float)
    return d.reset_index(drop=True)


# ----------------------------------------------------------------------------
# Load
# ----------------------------------------------------------------------------
fp = pd.read_csv(RAW / "first_pulls.txt", sep=";")
pt = pd.read_csv(RAW / "pull_times.txt", sep=";")
res = pd.read_csv(RAW / "nhl_results_2011_2027.txt", sep=";")
si = pd.read_csv(RAW / "state_intervals_2025_26.txt", sep=";", low_memory=False)

pt["playoff"] = pt.game_id.astype(str).str[4:6] == "03"
fp["label"] = fp.season.map(label_from_key)
fp["end_year"] = fp.season % 10000
fp["partial"] = fp.season == PARTIAL_KEY

res["home_abbr"] = res.home.map(FULL_TO_ABBR)
res["away_abbr"] = res.away.map(FULL_TO_ABBR)
assert res.home_abbr.notna().all() and res.away_abbr.notna().all(), "unmapped team name"
res["overtime"] = res.overtime.fillna("")

# One row per team per game, in date order, with standings points.
long = pd.concat([
    pd.DataFrame({"season": res.season, "date": res.date, "team": res.home_abbr, "opp": res.away_abbr,
                  "gf": res.home_score, "ga": res.away_score, "ot": res.overtime, "home": 1}),
    pd.DataFrame({"season": res.season, "date": res.date, "team": res.away_abbr, "opp": res.home_abbr,
                  "gf": res.away_score, "ga": res.home_score, "ot": res.overtime, "home": 0}),
]).sort_values(["season", "team", "date"]).reset_index(drop=True)
long["pts"] = np.where(long.gf > long.ga, 2, np.where(long.ot != "", 1, 0))
long["gnum"] = long.groupby(["season", "team"]).cumcount() + 1
long["gp"] = long.groupby(["season", "team"]).gnum.transform("max")
long["cum_pts"] = long.groupby(["season", "team"]).pts.cumsum()

# Re-pulls: a first pull at this deficit that was not the team's first genuine spell of the game
# (e.g. pulled down 1, conceded an empty-net goal, pulled again down 2). n_prior_spells can't be used
# for this: it also counts spells the course cleaning removed.
_g = (pt[(~pt.playoff) & (pt.genuine == 1)]
      .sort_values(["game_id", "team", "start_sec_remaining"], ascending=[True, True, False]).copy())
_g["gorder"] = _g.groupby(["game_id", "team"]).cumcount()
fp = fp.merge(_g[["game_id", "team", "deficit", "start_sec_remaining", "gorder"]],
              left_on=["game_id", "team", "deficit", "pull_sec_remaining"],
              right_on=["game_id", "team", "deficit", "start_sec_remaining"], how="left")
assert fp.gorder.notna().all(), "first pull without its spell"
fp["repull"] = fp.gorder > 0
fp = fp.drop(columns=["start_sec_remaining", "gorder"])

# Attach the game result to every regular-season first pull.
fpj = fp.merge(long[["date", "team", "opp", "gf", "ga", "ot", "gnum", "gp", "season"]]
               .rename(columns={"season": "res_season"}),
               left_on=["game_date", "team", "opponent"], right_on=["date", "team", "opp"], how="left")
assert fpj.gf.notna().all(), "first pull without a matching result"
fpj["final_margin"] = fpj.gf - fpj.ga
fpj["came_back"] = (fpj.ot != "") | (fpj.gf > fpj.ga)

# ----------------------------------------------------------------------------
# Meta and data checks
# ----------------------------------------------------------------------------
first_from_spells = (pt[(~pt.playoff) & (pt.genuine == 1) & (pt.deficit.between(1, 3))]
                     .sort_values("start_sec_remaining", ascending=False)
                     .drop_duplicates(["game_id", "team", "deficit"]))
goals_by_source = pt.groupby("source")[["goals_for_during", "goals_against_during", "duration_sec"]].sum()
goal_seasons = sorted(pt[pt.goals_for_during + pt.goals_against_during > 0].season.unique())
meta = {
    "dataThrough": DATA_THROUGH,
    "firstPulls": int(len(fp)),
    "firstPullsByDeficit": fp.deficit.value_counts().sort_index().to_dict(),
    "spells": int(len(pt)),
    "spellsRegular": int((~pt.playoff).sum()),
    "spellsPlayoff": int(pt.playoff.sum()),
    "spellsGenuine": int((pt.genuine == 1).sum()),
    "spellsNotGenuine": int((pt.genuine == 0).sum()),
    "rePulls": int((pt.n_prior_spells >= 1).sum()),
    "nonPositiveDeficits": int((fp.deficit <= 0).sum() + (pt.deficit <= 0).sum()),
    "rebuiltFirstPulls": int(len(first_from_spells)),
    "cleaning": {"rawSpells": 21494, "removed": 3854,
                 "windows": {"1": "5:00", "2": "8:00", "3": "12:00", "4+": "15:00"}},
    "partialSeason": {"label": label_from_key(PARTIAL_KEY),
                      "down1": int(((fp.season == PARTIAL_KEY) & (fp.deficit == 1)).sum())},
    "sourceColumn": {
        "pbpSpells": int((pt.source == "pbp").sum()),
        "shiftsSpells": int((pt.source == "shifts").sum()),
        "goalsInPbp": int(goals_by_source.loc["pbp", ["goals_for_during", "goals_against_during"]].sum()),
        "goalsInShifts": int(goals_by_source.loc["shifts", ["goals_for_during", "goals_against_during"]].sum()),
        "seasonsWithGoals": [label_from_key(s) for s in goal_seasons],
    },
    "shortSeasons": {label_from_end(y): int(n) for y, n in res.groupby("season").size().items()
                     if y in (2013, 2020, 2021)},
    "repulls": {str(d): {"n": int(g.repull.sum()), "share": r(g.repull.mean(), 4),
                         "meanRepull": r(g[g.repull].pull_sec_remaining.mean(), 1)}
                for d, g in fp[fp.deficit.between(1, 3)].groupby("deficit")},
    "nPriorCountsRemoved": int(((_g.gorder == 0) & (_g.n_prior_spells > 0)).sum()),
}

# ----------------------------------------------------------------------------
# View 1: trend by season and deficit
# ----------------------------------------------------------------------------
def trend_table(frame):
    out = []
    for (key, d), g in frame[frame.deficit.between(1, 3)].groupby(["season", "deficit"]):
        s = g.pull_sec_remaining
        out.append({"season": label_from_key(key), "key": int(key), "deficit": int(d), "n": int(len(s)),
                    "mean": r(s.mean(), 1), "median": r(s.median(), 1),
                    "p25": r(s.quantile(.25), 1), "p75": r(s.quantile(.75), 1),
                    "partial": bool(key == PARTIAL_KEY)})
    return out


trend_rows = trend_table(fp)
trend_rows_first = trend_table(fp[~fp.repull])
def pooled_table(frame):
    out = []
    for d, g in frame[(frame.deficit.between(1, 3)) & (~frame.partial)].groupby("deficit"):
        s = g.pull_sec_remaining
        out.append({"deficit": int(d), "n": int(len(s)), "mean": r(s.mean(), 1), "median": r(s.median(), 1)})
    return out


pooled = pooled_table(fp)
pooled_first = pooled_table(fp[~fp.repull])
trend_tests = []
full = fp[(~fp.partial) & (fp.deficit.between(1, 3))].copy()
full["t"] = (full.season // 10000) - 2010
for d, g in full.groupby("deficit"):
    est, n = ols(g.pull_sec_remaining.values, pd.DataFrame({"season_index": g.t.values}))
    c, se, p = est["season_index"]
    trend_tests.append({"deficit": int(d), "slope": r(c, 2), "se": r(se, 2), "p": float(p), "n": n})
write("trend.json", {"rows": trend_rows, "pooled": pooled, "tests": trend_tests,
                     "rowsFirstOnly": trend_rows_first, "pooledFirstOnly": pooled_first})

dist = {}
for (key, d), g in fp[fp.deficit.between(1, 3)].groupby(["season", "deficit"]):
    dist.setdefault(label_from_key(key), {})[str(int(d))] = sorted(int(x) for x in g.pull_sec_remaining)
write("distribution.json", {"seasons": [label_from_key(k) for k in sorted(fp.season.unique())], "data": dist})

# ----------------------------------------------------------------------------
# Scoring rates (2025-26 state intervals)
# ----------------------------------------------------------------------------
def perspectives(df):
    parts = []
    for side, opp in (("home", "away"), ("away", "home")):
        parts.append(pd.DataFrame({
            "period": df.period, "dur": df.duration_sec, "skf": df[f"{side}_skaters"], "ska": df[f"{opp}_skaters"],
            "gin_f": df[f"{side}_goalie_in"], "gin_a": df[f"{opp}_goalie_in"], "gf": df[f"{side}_goals"],
            "lead": df[f"{side}_score"] - df[f"{opp}_score"], "line": df[f"{side}_line"]}))
    return pd.concat(parts, ignore_index=True)


P = perspectives(si)
ev = P[(P.skf == 5) & (P.ska == 5) & (P.gin_f == 1) & (P.gin_a == 1)]
pc = P[P.period == 3]
off = pc[(pc.skf == 6) & (pc.ska == 5) & (pc.gin_f == 0) & (pc.gin_a == 1) & (pc.lead < 0)]
dfn = pc[(pc.skf == 5) & (pc.ska == 6) & (pc.gin_f == 1) & (pc.gin_a == 0) & (pc.lead > 0)]


def rate_of(x):
    goals, secs = int(x.gf.sum()), int(x.dur.sum())
    return {"goals": goals, "seconds": secs, "rate": r(goals * 3600 / secs, 2)}


rate_5v5_all = rate_of(ev)
rate_5v5_p3 = rate_of(ev[ev.period == 3])
rate_6v5 = rate_of(off)
rate_5v6 = rate_of(dfn)
raw_skill = rate_table(str(RAW / "state_intervals_2025_26.txt")).set_index("situation")
pp_check = float(raw_skill.loc["5v4", "gf60"])
assert abs(pp_check - 7.26) < 0.005, pp_check
off_all = pc[(pc.gin_f == 0) & (pc.gin_a == 1) & (pc.lead < 0) & (pc.skf > pc.ska)]
dfn_all = pc[(pc.gin_a == 0) & (pc.gin_f == 1) & (pc.lead > 0) & (pc.skf < pc.ska)]
unc_6v5 = {"goals": int(raw_skill.loc["6v5p", "goals"]), "seconds": int(raw_skill.loc["6v5p", "seconds"]),
           "rate": r(raw_skill.loc["6v5p", "gf60"], 2)}
unc_5v6 = {"goals": int(raw_skill.loc["5v6P", "goals"]), "seconds": int(raw_skill.loc["5v6P", "seconds"]),
           "rate": r(raw_skill.loc["5v6P", "gf60"], 2)}
mp = pd.read_csv(RAW / "moneypuck_teams_2025_26.txt", sep=";")
mp = mp.loc[:, ~mp.columns.duplicated()]
mp55 = mp[mp.situation == "5on5"]
moneypuck_5v5 = r(mp55.goalsFor.sum() * 3600 / mp55.iceTime.sum(), 2)

options = {
    "A": ("All 5v5 play; pull-context 6v5 and empty net", rate_5v5_all["rate"], rate_6v5["rate"], rate_5v6["rate"]),
    "B": ("3rd-period 5v5; pull-context 6v5 and empty net", rate_5v5_p3["rate"], rate_6v5["rate"], rate_5v6["rate"]),
    "C": ("Power-play pulls pooled in", rate_5v5_all["rate"], rate_of(off_all)["rate"], rate_of(dfn_all)["rate"]),
    "D": ("No delayed-penalty fix (raw skill output)", rate_5v5_all["rate"], unc_6v5["rate"], unc_5v6["rate"]),
    "E": ("Down-1 situations only", rate_5v5_all["rate"], rate_of(off[off.lead == -1])["rate"],
          rate_of(dfn[dfn.lead == 1])["rate"]),
}
option_rows = []
for oid, (desc, a, b, c) in options.items():
    reg = solve(a, b, c)["latest_pull"]
    po = solve(a, b, c, payoffs=PLAYOFF)["latest_pull"]
    option_rows.append({"id": oid, "label": desc, "r55": a, "r65": b, "r56": c,
                        "latest": {str(k): v for k, v in reg.items()},
                        "latestPlayoff": {str(k): v for k, v in po.items()}, "chosen": oid == CHOSEN})
_, R55, R65, R56 = options[CHOSEN]

actual_2025 = {str(d): r(fp[(fp.season == 20252026) & (fp.deficit == d)].pull_sec_remaining.mean(), 1)
               for d in (1, 2, 3)}
actual_2025_first = {str(d): r(fp[(fp.season == 20252026) & (fp.deficit == d) & (~fp.repull)].pull_sec_remaining.mean(), 1)
                     for d in (1, 2, 3)}
write("rates.json", {
    "chosen": {"id": CHOSEN, "r55": R55, "r65": R65, "r56": R56},
    "components": [
        {"key": "r55", "label": "5v5 scoring rate, each team", "situation": "5v5, both goalies in",
         "filter": "3rd period only, all scores", **rate_5v5_p3},
        {"key": "r65", "label": "Pulled offense (6v5)", "situation": "6v5p: own goalie pulled, extra attacker",
         "filter": "Pull context: 3rd period, six-skater side trailing", **rate_6v5},
        {"key": "r56", "label": "Empty-net defense (5v6)", "situation": "5v6P: facing the six-skater side's empty net",
         "filter": "Pull context: 3rd period, six-skater side trailing", **rate_5v6},
    ],
    "reference": {"r55All": rate_5v5_all, "uncorrected6v5": unc_6v5, "uncorrected5v6": unc_5v6,
                  "delayedPenaltySeconds": unc_5v6["seconds"] - rate_5v6["seconds"],
                  "ppPipelineCheck": pp_check, "moneypuck5v5": moneypuck_5v5,
                  "scoreEffects3rd": {k: rate_of(ev[(ev.period == 3) & cond])["rate"] for k, cond in
                                      (("trailing", ev.lead.between(-3, -1)), ("leading", ev.lead.between(1, 3)),
                                       ("tied", ev.lead == 0))},
                  "pulled6v5ByDeficit": {str(k): rate_of(off[off.lead == -k]) for k in (1, 2, 3)}},
    "options": option_rows,
    "actual2025": actual_2025,
    "actual2025FirstOnly": actual_2025_first,
    "testCase": {"r55": 3.0, "r65": 8.0, "r56": 20.0, "expected": {"1": 240, "2": 495, "3": 753}},
})
print("rates", R55, R65, R56, "->", solve(R55, R65, R56)["latest_pull"])

# ----------------------------------------------------------------------------
# Lines extension
# ----------------------------------------------------------------------------
bl = pd.read_csv(RAW / "rates_2025_26_pull_context_by_line.txt", sep=";")
line_rates = []
for ln in (1, 2, 3, 4):
    row = bl[(bl.situation == "6v5p") & (bl.line == ln)].iloc[0]
    line_rates.append({"line": ln, "seconds": int(row.seconds), "goals": int(row.goals), "rate": r(row.gf60, 2)})
unranked = bl[(bl.situation == "6v5p") & (bl.line == 0)].iloc[0]
line_at = line_schedule()
lr = {x["line"]: x["rate"] for x in line_rates}
rate_fn = line_rate_fn(lr, R65)
by_line = solve(R55, R65, R56, r65_at=rate_fn)["latest_pull"]
cycling = solve(R55, R65, R56, r65_at=lambda t: lr[line_at(t)])
write("lines.json", {
    "blocks": [{"line": 1, "seconds": 44}, {"line": 2, "seconds": 40}, {"line": 3, "seconds": 38},
               {"line": 4, "seconds": 36}],
    "rates": line_rates,
    "unranked": {"seconds": int(unranked.seconds), "goals": int(unranked.goals), "rate": r(unranked.gf60, 2)},
    "constant": R65,
    "latestConstant": {str(k): v for k, v in solve(R55, R65, R56)["latest_pull"].items()},
    "latestByLine": {str(k): v for k, v in by_line.items()},
    "latestByLinePlayoff": {str(k): v for k, v in solve(R55, R65, R56, r65_at=rate_fn, payoffs=PLAYOFF)["latest_pull"].items()},
    "cyclingVariant": {"latest": {str(k): v for k, v in cycling["latest_pull"].items()},
                       "note": "If the four lines kept rotating in the same order all the way back, pulling would pay only "
                               "during the top line's shifts, so the pull window breaks into pieces."},
})

# ----------------------------------------------------------------------------
# Value of pulling: goal-difference distribution at 15:00 left (2025-26)
# ----------------------------------------------------------------------------
moment = 3600 - 900
at = si[(si.start_game_sec <= moment) & (si.start_game_sec + si.duration_sec > moment)]
assert at.game_id.is_unique
diffs = np.concatenate([(at.home_score - at.away_score).values, (at.away_score - at.home_score).values])
diffs = np.clip(diffs, -8, 8)
freq = pd.Series(diffs).value_counts().sort_index()
thr_actual = {1: actual_2025["1"], 2: actual_2025["2"], 3: actual_2025["3"]}


def policy_values(payoffs=REGULAR):
    opt = solve(R55, R65, R56, payoffs=payoffs)
    v_opt = opt["value"][-1]
    v_act = evaluate_policy(R55, R65, R56, lambda k: thr_actual[min(k, 3)], payoffs=payoffs)[-1]
    v_never = evaluate_policy(R55, R65, R56, lambda k: None, payoffs=payoffs)[-1]
    return opt["diffs"], v_opt, v_act, v_never


dgrid, v_opt, v_act, v_never = policy_values()
idx = {int(d): i for i, d in enumerate(dgrid)}
w = np.array([freq.get(d, 0) for d in dgrid], float)
w /= w.sum()
per_game = {"optimal": float(w @ v_opt), "actual": float(w @ v_act), "never": float(w @ v_never)}
boot = []
n_tg = len(diffs)
for _ in range(2000):
    sample = RNG.choice(diffs, n_tg, replace=True)
    ws = np.bincount(sample + 8, minlength=17) / n_tg
    boot.append(82 * float(ws @ (v_opt - v_act)))
write("value.json", {
    "moment": 900, "teamGames": int(n_tg), "season": "2025–26",
    "freq": [{"d": int(d), "n": int(freq.get(d, 0)), "share": r(freq.get(d, 0) / n_tg, 5)} for d in dgrid],
    "actualThresholds": {str(k): v for k, v in thr_actual.items()},
    "perGame": {k: r(v, 5) for k, v in per_game.items()},
    "perSeasonGain": {"optimalVsActual": r(82 * (per_game["optimal"] - per_game["actual"]), 3),
                      "optimalVsNever": r(82 * (per_game["optimal"] - per_game["never"]), 3),
                      "actualVsNever": r(82 * (per_game["actual"] - per_game["never"]), 3),
                      "ci95OptimalVsActual": [r(np.percentile(boot, 2.5), 3), r(np.percentile(boot, 97.5), 3)]},
    "byStart": [{"d": int(d), "share": r(w[i], 5), "optimal": r(v_opt[i], 4), "actual": r(v_act[i], 4),
                 "never": r(v_never[i], 4)} for i, d in enumerate(dgrid) if -3 <= d <= 2],
})
print("value per season optimal vs actual", 82 * (per_game["optimal"] - per_game["actual"]))

# ----------------------------------------------------------------------------
# Teams: early pullers, Bayes shrinkage, standings points and SRS
# ----------------------------------------------------------------------------
d1 = fp[fp.deficit == 1].copy()
d1["fr"] = d1.team.map(franchise)
standings = long.groupby(["season", "team"]).agg(pts=("pts", "sum"), gp=("gp", "max")).reset_index()
standings["pct"] = standings.pts / (2 * standings.gp)
srs_rows = []
for season, g in res.groupby("season"):
    games = pd.DataFrame({"home": g.home_abbr, "away": g.away_abbr, "home_score": g.home_score.astype(float),
                          "away_score": g.away_score.astype(float)})
    ratings, h = fit_srs(games)
    srs_rows += [{"season": int(season), "team": t, "srs": float(v)} for t, v in ratings.items()]
standings = standings.merge(pd.DataFrame(srs_rows), on=["season", "team"])

team_rows, prior_rows = [], []
for key, g in d1.groupby("season"):
    end = key % 10000
    mu0 = g.pull_sec_remaining.mean()
    grp = g.groupby("team").pull_sec_remaining
    means, ns = grp.mean(), grp.size()
    resid = g.pull_sec_remaining - g.team.map(means)
    sigma_d = float(np.sqrt((resid ** 2).sum() / max(len(g) - len(means), 1)))
    var_between = float(means.var(ddof=1) - np.mean(sigma_d ** 2 / ns)) if len(means) > 2 else 0.0
    sigma0 = float(np.sqrt(max(var_between, 1.0)))
    for team, m in means.items():
        n = int(ns[team])
        post = bayes_normal(mu0, sigma0, n, float(m), sigma_d)
        st = standings[(standings.season == end) & (standings.team == team)]
        team_rows.append({
            "season": label_from_key(key), "key": int(key), "team": team, "franchise": franchise(team),
            "name": FRANCHISE_NAME[franchise(team)], "n": n, "mean": r(m, 1), "shrunk": r(post.mean, 1),
            "leagueMean": r(mu0, 1), "pts": int(st.pts.iloc[0]), "gp": int(st.gp.iloc[0]),
            "pct": r(st.pct.iloc[0], 3), "srs": r(st.srs.iloc[0], 2), "partial": bool(key == PARTIAL_KEY)})
    prior_rows.append({"season": label_from_key(key), "mu0": r(mu0, 1), "sigma0": r(sigma0, 1),
                       "sigmaD": r(sigma_d, 1)})
tr = pd.DataFrame(team_rows)
tr["rank"] = None
for key, g in tr[tr.n >= MIN_TEAM_PULLS].groupby("key"):
    order = g.sort_values("shrunk", ascending=False).index
    tr.loc[order, "rank"] = range(1, len(order) + 1)
tq = tr[(~tr.partial) & (tr.n >= MIN_TEAM_PULLS)].copy()
tq["early"] = tq.shrunk - tq.leagueMean  # seconds earlier than the league that season
quality = {}
for xname in ("pct", "srs"):
    est, n = ols(tq.early.values, pd.DataFrame({xname: tq[xname].values}))
    c, se, p = est[xname]
    quality[xname] = {"slope": r(c, 3), "se": r(se, 3), "p": float(p), "n": n,
                      "r": r(np.corrcoef(tq[xname], tq.early)[0, 1], 3)}
latest_full = tr[(tr.key == 20252026) & (tr.n >= MIN_TEAM_PULLS)].sort_values("shrunk", ascending=False)
early_team, late_team = latest_full.iloc[0].team, latest_full.iloc[-1].team
xa = d1[(d1.season == 20252026) & (d1.team == early_team)].pull_sec_remaining
xb = d1[(d1.season == 20252026) & (d1.team == late_team)].pull_sec_remaining
tt = stats.ttest_ind(xa, xb, equal_var=False)
fr_rows = []
dev = d1[~(d1.season == PARTIAL_KEY)].copy()
dev["dev"] = dev.pull_sec_remaining - dev.groupby("season").pull_sec_remaining.transform("mean")
for fr, g in dev.groupby("fr"):
    fr_rows.append({"franchise": fr, "name": FRANCHISE_NAME[fr], "n": int(len(g)), "seasons": int(g.season.nunique()),
                    "dev": r(g.dev.mean(), 1), "se": r(g.dev.std(ddof=1) / np.sqrt(len(g)), 1)})
write("teams.json", {
    "minPulls": MIN_TEAM_PULLS,
    "teamSeasons": [{**row, "rank": (int(rk) if rk is not None else None)}
                    for row, rk in zip(team_rows, tr["rank"].tolist())],
    "priors": prior_rows,
    "franchises": sorted(fr_rows, key=lambda x: -x["dev"]),
    "quality": quality,
    "compare2025": {"early": {"team": early_team, "name": FRANCHISE_NAME[franchise(early_team)], "n": int(len(xa)),
                              "mean": r(xa.mean(), 1)},
                    "late": {"team": late_team, "name": FRANCHISE_NAME[franchise(late_team)], "n": int(len(xb)),
                             "mean": r(xb.mean(), 1)},
                    "t": r(tt.statistic, 2), "p": float(tt.pvalue)},
})

# ----------------------------------------------------------------------------
# What happens after a pull (all regular-season first pulls)
# ----------------------------------------------------------------------------
fpj["outcome"] = np.select(
    [fpj.gf > fpj.ga, (fpj.ot != "") & (fpj.gf < fpj.ga), -fpj.final_margin > fpj.deficit,
     -fpj.final_margin == fpj.deficit],
    ["won", "tiedLostOT", "conceded", "noChange"], default="partial")
out_rows = []
for (key, d), g in fpj[fpj.deficit.between(1, 3)].groupby(["season", "deficit"]):
    c = g.outcome.value_counts()
    out_rows.append({"season": label_from_key(key), "key": int(key), "deficit": int(d), "n": int(len(g)),
                     **{k: int(c.get(k, 0)) for k in ("won", "tiedLostOT", "noChange", "conceded", "partial")},
                     "partialSeason": bool(key == PARTIAL_KEY)})
g1 = fpj[(fpj.deficit == 1) & (~fpj.partial)].copy()
lres = LogisticRegTrain(g1.came_back.astype(float).values,
                        pd.DataFrame({"season_index": (g1.season // 10000 - 2010).values}))
val = first_from_spells.merge(fpj[["game_id", "team", "deficit", "came_back"]], on=["game_id", "team", "deficit"])
val = val[(val.source == "shifts") & (val.deficit == 1)]
write("outcomes.json", {
    "rows": out_rows,
    "trendTest": {"coef": r(lres.coef[1], 4), "se": r(lres.se[1], 4), "p": float(lres.pvalue[1]), "n": int(lres.n_valid)},
    "pooled": {str(d): {"n": int(len(g)), "cameBack": r(g.came_back.mean(), 4), "won": r((g.outcome == "won").mean(), 4),
                        "conceded": r((g.outcome == "conceded").mean(), 4)}
               for d, g in fpj[(fpj.deficit.between(1, 3)) & (~fpj.partial)].groupby("deficit")},
    "validation": {"n": int(len(val)), "agree": int(((val.goals_for_during > 0) == val.came_back).sum())},
})

# ----------------------------------------------------------------------------
# Stakes: regular season vs bubble teams' last 10 games vs playoffs
# ----------------------------------------------------------------------------
pre = long[long.gnum == long.gp - 10][["season", "team", "cum_pts", "gp"]].copy()
cut_rows = []
for season in range(2012, 2027):
    if season == 2020:
        continue
    groups, k = playoff_groups(season)
    prev = standings[standings.season == season - 1].assign(fr=lambda x: x.team.map(franchise)).set_index("fr").pct
    for grp in sorted(set(groups.values())):
        members = [franchise(t) for t, v in groups.items() if v == grp]
        p = prev.reindex(members).dropna().sort_values(ascending=False)
        cut_rows.append({"season": season, "grp": grp, "cut": float(p.iloc[k - 1])})
cuts = pd.DataFrame(cut_rows)
pre = pre[pre.season.isin(cuts.season.unique())].copy()
pre["grp"] = [playoff_groups(s)[0][t] for s, t in zip(pre.season, pre.team)]
pre = pre.merge(cuts, on=["season", "grp"])
pre["need"] = np.ceil(pre.cut * 2 * pre.gp)
pre["gap"] = pre.need - pre.cum_pts
pre["bubble"] = (pre.gap > 6) & (pre.gap <= 14)
stake_seasons = sorted(pre.season.unique())
reg = fpj[fpj.end_year.isin(stake_seasons)].merge(pre[["season", "team", "bubble"]],
                                                   left_on=["end_year", "team"], right_on=["season", "team"],
                                                   how="left", suffixes=("", "_b"))
reg["last10"] = reg.gnum > reg.gp - 10
reg["group"] = np.where(~reg.last10, "regular", np.where(reg.bubble, "bubbleLast10", "otherLast10"))
po = (pt[(pt.playoff) & (pt.genuine == 1) & (pt.deficit.between(1, 3))]
      .sort_values("start_sec_remaining", ascending=False).drop_duplicates(["game_id", "team", "deficit"]))
po = po[po.season.mod(10000).isin(stake_seasons)]
st = pd.concat([reg[["season", "deficit", "pull_sec_remaining", "group"]].assign(season=reg.end_year),
                pd.DataFrame({"season": po.season % 10000, "deficit": po.deficit,
                              "pull_sec_remaining": po.start_sec_remaining, "group": "playoffs"})],
               ignore_index=True)
stake_rows, stake_tests = [], []
for (grp, d), g in st.groupby(["group", "deficit"]):
    stake_rows.append({"group": grp, "deficit": int(d), "n": int(len(g)), "mean": r(g.pull_sec_remaining.mean(), 1),
                       "median": r(g.pull_sec_remaining.median(), 1)})
for d, g in st.groupby("deficit"):
    g = g.reset_index(drop=True)
    X = pd.concat([pd.DataFrame({k: (g.group == k).astype(float) for k in ("bubbleLast10", "otherLast10", "playoffs")}),
                   season_dummies(g.season)], axis=1)
    est, n = ols(g.pull_sec_remaining.values, X)
    for k in ("bubbleLast10", "otherLast10", "playoffs"):
        c, se, p = est[k]
        stake_tests.append({"deficit": int(d), "group": k, "coef": r(c, 1), "se": r(se, 1), "p": float(p), "n": n})
write("stakes.json", {
    "seasons": [label_from_end(s) for s in stake_seasons], "bubbleRule": BUBBLE_RULE,
    "bubbleTeamsPerSeason": {label_from_end(s): int(n) for s, n in pre[pre.bubble].groupby("season").size().items()},
    "cutoffs": [{"season": label_from_end(x.season), "group": x.grp, "cut": r(x.cut, 3)} for x in cuts.itertuples()],
    "rows": stake_rows, "tests": stake_tests,
})

# ----------------------------------------------------------------------------
# Home vs road
# ----------------------------------------------------------------------------
hr_rows, hr_tests = [], []
hr = fp[(fp.deficit.between(1, 3)) & (~fp.partial)].reset_index(drop=True)
for (d, h), g in hr.groupby(["deficit", "is_home"]):
    hr_rows.append({"deficit": int(d), "side": "home" if h == 1 else "road", "n": int(len(g)),
                    "mean": r(g.pull_sec_remaining.mean(), 1), "median": r(g.pull_sec_remaining.median(), 1)})
for d, g in hr.groupby("deficit"):
    g = g.reset_index(drop=True)
    a, b = g[g.is_home == 1].pull_sec_remaining, g[g.is_home == 0].pull_sec_remaining
    t = stats.ttest_ind(a, b, equal_var=False)
    est, n = ols(g.pull_sec_remaining.values,
                 pd.concat([pd.DataFrame({"home": g.is_home.astype(float)}), season_dummies(g.season)], axis=1))
    c, se, p = est["home"]
    hr_tests.append({"deficit": int(d), "diff": r(a.mean() - b.mean(), 1), "t": r(t.statistic, 2),
                     "p": float(t.pvalue), "coefFE": r(c, 1), "pFE": float(p), "n": n})
write("home_road.json", {"rows": hr_rows, "tests": hr_tests})

# ----------------------------------------------------------------------------
# Records
# ----------------------------------------------------------------------------
def rec(row):
    return {"season": label_from_key(row.season), "date": row.game_date, "team": row.team, "opp": row.opponent,
            "home": int(row.is_home), "deficit": int(row.deficit), "sec": int(row.pull_sec_remaining),
            "outcome": row.outcome, "final": f"{int(row.gf)}–{int(row.ga)}{(' ' + row.ot) if row.ot else ''}"}


earliest = {str(d): [rec(x) for x in g.sort_values(["pull_sec_remaining", "game_date"], ascending=[False, True])
                     .head(10).itertuples()] for d, g in fpj[fpj.deficit.between(1, 3)].groupby("deficit")}
latest_pulls = [rec(x) for x in fpj[fpj.deficit == 1].sort_values(["pull_sec_remaining", "game_date"])
                .head(10).itertuples()]
longest = []
for x in pt[pt.genuine == 1].sort_values("duration_sec", ascending=False).head(10).itertuples():
    longest.append({"season": label_from_key(x.season), "date": x.game_date, "team": x.team, "opp": x.opponent,
                    "deficit": int(x.deficit), "start": int(x.start_sec_remaining), "end": int(x.end_sec_remaining),
                    "duration": int(x.duration_sec), "playoff": bool(x.playoff), "source": x.source})
comebacks = [rec(x) for x in fpj[(fpj.deficit >= 2) & (fpj.outcome == "won")]
             .sort_values("game_date", ascending=False).itertuples()]
write("records.json", {"earliest": earliest, "latestDown1": latest_pulls, "longest": longest,
                       "comebacksFrom2Plus": comebacks})

# ----------------------------------------------------------------------------
# Opening story: Game 7, 2024 Stanley Cup Final
# ----------------------------------------------------------------------------
g7 = pt[(pt.game_id == 2023030417) & (pt.team == "EDM")].iloc[0]
write("hook.json", {"date": g7.game_date, "team": "EDM", "teamName": "Edmonton Oilers", "opp": "FLA",
                    "oppName": "Florida Panthers", "deficit": int(g7.deficit), "pullSec": int(g7.start_sec_remaining),
                    "endSec": int(g7.end_sec_remaining), "goalsFor": int(g7.goals_for_during),
                    "goalsAgainst": int(g7.goals_against_during),
                    "modelRegular": solve(R55, R65, R56)["latest_pull"][1],
                    "modelPlayoff": solve(R55, R65, R56, payoffs=PLAYOFF)["latest_pull"][1]})

# ----------------------------------------------------------------------------
# Fixtures for the TypeScript parity test (src/lib/dp.test.ts)
# ----------------------------------------------------------------------------
fixtures = []
cases = [("test case", 3.0, 8.0, 20.0, REGULAR, False), ("site defaults", R55, R65, R56, REGULAR, False),
         ("site defaults, playoffs", R55, R65, R56, PLAYOFF, False), ("uncorrected", *options["D"][1:], REGULAR, False),
         ("low 6v5", 2.0, 4.0, 30.0, REGULAR, False), ("high 6v5", 3.5, 14.0, 12.0, REGULAR, False),
         ("lines", R55, R65, R56, REGULAR, True)]
for name, a, b, c, pay, lines in cases:
    s = solve(a, b, c, payoffs=pay, r65_at=rate_fn if lines else None)
    samples = []
    for t in (1, 30, 60, 120, 240, 480, 900):
        for d in (-4, -3, -2, -1, 0, 1, 2):
            samples.append({"t": t, "d": d, "v": float(s["value"][t, d + 8]), "dec": int(s["decision"][t, d + 8])})
    fixtures.append({"name": name, "r55": a, "r65": b, "r56": c, "payoffs": list(pay), "lines": lines,
                     "latest": {str(k): v for k, v in s["latest_pull"].items()}, "samples": samples})
pv = evaluate_policy(R55, R65, R56, lambda k: thr_actual[min(k, 3)])
fixtures_policy = {"thresholds": {str(k): v for k, v in thr_actual.items()},
                   "v900": [float(x) for x in pv[-1]]}
(ROOT / "src" / "lib").mkdir(parents=True, exist_ok=True)
(ROOT / "src" / "lib" / "dp.fixtures.json").write_text(json.dumps(
    {"lineRates": lr, "cases": fixtures, "policy": fixtures_policy}, indent=1))
print("wrote src/lib/dp.fixtures.json")

write("meta.json", meta)
print("done")
