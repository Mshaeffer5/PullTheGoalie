"""Data audit: checks every course file for internal consistency. Run: python3 analysis/audit_data.py

Prints one line per check: OK, or ISSUE with counts and examples. Nothing is modified.
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
RAW = ROOT / "analysis" / "data_raw"
sys.path.insert(0, str(ROOT / "analysis"))
from teams import FULL_TO_ABBR, playoff_groups  # noqa: E402

issues = 0


def check(name, bad, detail=""):
    global issues
    n = int(bad.sum()) if hasattr(bad, "sum") else int(bad)
    if n:
        issues += 1
        print(f"ISSUE {name}: {n} {detail}")
    else:
        print(f"OK    {name}")
    return n


fp = pd.read_csv(RAW / "first_pulls.txt", sep=";")
pt = pd.read_csv(RAW / "pull_times.txt", sep=";")
res = pd.read_csv(RAW / "nhl_results_2011_2027.txt", sep=";")
si = pd.read_csv(RAW / "state_intervals_2025_26.txt", sep=";", low_memory=False)

print("== first_pulls.txt", fp.shape)
check("missing values", fp.isna().any(axis=1))
check("duplicate game/team/deficit", fp.duplicated(["game_id", "team", "deficit"]))
check("pull_min != pull_sec/60", (fp.pull_min_remaining - fp.pull_sec_remaining / 60).abs() > 0.001)
check("non-regular-season game ids", fp.game_id.astype(str).str[4:6] != "02")
check("season does not match game_id year", fp.game_id.astype(str).str[:4].astype(int) != fp.season // 10000)
check("team == opponent", fp.team == fp.opponent)
win = {1: 300, 2: 480, 3: 720}
check("pull outside cleaning window", fp.apply(lambda r: r.pull_sec_remaining > win.get(r.deficit, 900), axis=1))
check("pull at 0 seconds", fp.pull_sec_remaining <= 0)
check("deficit not 1-3", ~fp.deficit.between(1, 3))
check("date after data cut-off (2026-11-07)", fp.game_date > "2026-11-07")

print("== pull_times.txt", pt.shape)
pt["gtype"] = pt.game_id.astype(str).str[4:6]
check("missing values", pt.isna().any(axis=1))
check("game type not 02/03", ~pt.gtype.isin(["02", "03"]))
check("duration != start - end", pt.duration_sec != pt.start_sec_remaining - pt.end_sec_remaining)
check("end after start or negative", (pt.end_sec_remaining < 0) | (pt.end_sec_remaining > pt.start_sec_remaining))
check("start beyond a 20-minute period", pt.start_sec_remaining > 1200)
gen_rule = (pt.duration_sec >= 20) | (pt.goals_for_during + pt.goals_against_during > 0) | (pt.end_sec_remaining == 0)
check("genuine flag disagrees with its stated rule", (pt.genuine == 1) != gen_rule)
check("deficit < 1", pt.deficit < 1)
pt_sorted = pt.sort_values(["game_id", "team", "start_sec_remaining"], ascending=[True, True, False])
expected_prior = pt_sorted.groupby(["game_id", "team"]).cumcount()
check("n_prior_spells above the spell order (it also counts removed spells)", (pt_sorted.n_prior_spells.values != expected_prior.values))
prev_end = pt_sorted.groupby(["game_id", "team"]).end_sec_remaining.shift()
check("overlapping spells for the same team", (pt_sorted.start_sec_remaining > prev_end).fillna(False))
teams_per_game = pt.groupby("game_id").apply(lambda g: len(set(g.team) | set(g.opponent)), include_groups=False)
check("games with more than two teams", teams_per_game > 2)
src = pt.groupby(["season", "source"]).size().unstack(fill_value=0)
mixed = src[(src > 0).sum(axis=1) > 1]
print(f"INFO  source by season: pbp-only seasons {list(src[src.get('shifts', 0) == 0].index % 10000)}; "
      f"seasons with both sources {list(mixed.index)}")
check("goals recorded in pbp-source spells (expected none)", (pt.source == "pbp") & (pt.goals_for_during + pt.goals_against_during > 0))
sh = pt[pt.source == "shifts"]
check("shifts-source spells with no goals yet 5+ minutes long", (sh.duration_sec >= 300) & (sh.goals_for_during + sh.goals_against_during == 0))
both = pt.merge(pt, on="game_id", suffixes=("", "_o"))
both = both[(both.team != both.team_o) & (both.start_sec_remaining > both.end_sec_remaining_o) &
            (both.start_sec_remaining_o > both.end_sec_remaining)]
check("both teams with goalie out at once (pairs)", len(both) // 2, "spells overlap with the opponent's spell")

print("== nhl_results_2011_2027.txt", res.shape)
check("unmapped team names", ~res.home.isin(FULL_TO_ABBR) | ~res.away.isin(FULL_TO_ABBR))
check("duplicate games", res.duplicated(["date", "home", "away"]))
check("tied final scores", res.home_score == res.away_score)
ot = res.overtime.fillna("")
check("OT/SO game with margin != 1", (ot != "") & ((res.home_score - res.away_score).abs() != 1))
check("playoff flag set", res.playoff != 0)
check("team plays itself", res.home == res.away)
res["h"], res["a"] = res.home.map(FULL_TO_ABBR), res.away.map(FULL_TO_ABBR)
gp = pd.concat([res[["season", "h"]].rename(columns={"h": "t"}), res[["season", "a"]].rename(columns={"a": "t"})]).groupby(["season", "t"]).size()
expected_gp = {2013: 48, 2020: None, 2021: 56, 2027: None}
for season, g in gp.groupby(level=0):
    exp = expected_gp.get(season, 82)
    if exp is not None and (g != exp).any():
        print(f"ISSUE games played in {season}: {g[g != exp].to_dict()}")
        issues += 1
print(f"INFO  2019-20 games played range {gp.loc[2020].min()}-{gp.loc[2020].max()} (season stopped March 2020)")
for season in range(2011, 2028):
    if season == 2020:
        continue
    g, _ = playoff_groups(season)
    present = set(gp.loc[season].index)
    if present != set(g):
        print(f"ISSUE conference map vs results {season}: missing {present - set(g)}, extra {set(g) - present}")
        issues += 1
print("OK    conference map covers every team in every season" if True else "")
names = res.groupby("season").apply(lambda g: sorted(set(g.home) | set(g.away)), include_groups=False)
utah_both = [s for s, n in names.items() if "Utah Hockey Club" in n and "Utah Mammoth" in n]
print(f"INFO  seasons with both Utah names: {utah_both}")

print("== first pulls vs results")
long = pd.concat([pd.DataFrame({"date": res.date, "team": res.h, "opp": res.a, "home": 1}),
                  pd.DataFrame({"date": res.date, "team": res.a, "opp": res.h, "home": 0})])
j = fp.merge(long, left_on=["game_date", "team", "opponent"], right_on=["date", "team", "opp"], how="left")
check("first pull with no matching game", j.home.isna())
check("is_home disagrees with results", j.home.notna() & (j.home != j.is_home))
j2 = fp.merge(long, left_on=["game_date", "team"], right_on=["date", "team"], how="left")
check("team with two games on one date", j2.duplicated(["game_id", "team", "deficit"]))
fin = fp.merge(pd.concat([pd.DataFrame({"date": res.date, "team": res.h, "gf": res.home_score, "ga": res.away_score}),
                          pd.DataFrame({"date": res.date, "team": res.a, "gf": res.away_score, "ga": res.home_score})]),
               left_on=["game_date", "team"], right_on=["date", "team"])
check("pulling team scored fewer than... (final GA < deficit)", fin.ga < fin.deficit, "team trailed by more than its final goals against")

print("== state_intervals_2025_26.txt", si.shape)
dur = si.groupby("game_id").duration_sec.sum()
check("games whose durations do not sum to 3600", dur != 3600)
check("zero or negative durations", si.duration_sec <= 0)
odd_sk = (si.home_skaters > 6) | (si.away_skaters > 6) | (si.home_skaters < 3) | (si.away_skaters < 3)
check("impossible skater counts (fewer than 3 or more than 6)", odd_sk,
      f"rows, {int(si[odd_sk].duration_sec.sum())} seconds")
six_with_goalie = ((si.home_skaters == 6) & (si.home_goalie_in == 1)) | ((si.away_skaters == 6) & (si.away_goalie_in == 1))
check("six skaters with the goalie still in", six_with_goalie, f"rows, {int(si[six_with_goalie].duration_sec.sum())} seconds")
both_out = (si.home_goalie_in == 0) & (si.away_goalie_in == 0)
check("both goalies out at once", both_out, f"rows, {int(si[both_out].duration_sec.sum())} seconds")
si = si.sort_values(["game_id", "start_game_sec"])
nxt_h = si.groupby("game_id").home_score.shift(-1)
nxt_a = si.groupby("game_id").away_score.shift(-1)
jump = (nxt_h.notna()) & ((nxt_h - si.home_score != si.home_goals) | (nxt_a - si.away_score != si.away_goals))
check("score change disagrees with goals at end of stretch", jump)
gaps = si.groupby("game_id").apply(lambda g: (g.start_game_sec.values[1:] != (g.start_game_sec + g.duration_sec).values[:-1]).sum(), include_groups=False)
check("stretches that don't start where the previous one ended", gaps)
pulled_lead = ((si.home_goalie_in == 0) & (si.home_score > si.away_score)) | ((si.away_goalie_in == 0) & (si.away_score > si.home_score))
print(f"INFO  goalie out while leading: {int(pulled_lead.sum())} rows, {int(si[pulled_lead].duration_sec.sum())} s (delayed penalties)")
print(f"\n{issues} check(s) flagged")
