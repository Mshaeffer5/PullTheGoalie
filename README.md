# Pull the Goalie

When do NHL teams actually pull the goalie, when does a dynamic-programming model say they should, and do the two agree?

A static React site for Columbia Business School **B8131 Sports Analytics** (Pull-the-Goalie website assignment). It is meant to be published on Lovable at `pull-goalie-sa-2026-N.lovable.app`.

## What's in it

| Tab | What it shows |
| --- | --- |
| Overview | The Game 7 hook, model vs actual at a glance, five findings |
| When teams pull | **Required view 1:** first-pull trend by season and deficit (2010–11 to 2026–27, partial season marked), season table, trend tests, distributions, home vs road, records |
| The model | **Required view 2:** our DP with adjustable 5v5 / 6v5 / 5v6 rates, regular-season and playoff objectives, model vs actual, sensitivity, "should they pull now?" calculator, value and decision grids, the algorithm write-up, and the live test case (4:00 / 8:15 / 12:33) |
| Deeper dives | Value of pulling (points per season), team rankings with Bayes shrinkage vs points % and SRS, line-dependent 6v5 rates, what happens after a pull, and regular season vs bubble teams' last 10 games vs playoffs |
| About & method | Purpose, audience, glossary, the three rates and why, filters and edge cases, data problems found, methods, sources |

## Decisions baked in

- **DP rates (option B):** 5v5 = **2.35** (3rd-period 5v5, both goalies in), 6v5 = **7.10** and 5v6 = **21.78** (pull context: 3rd period, six-skater side trailing, which removes delayed-penalty time). All from the 2025–26 state intervals.
- **View 1 filter:** `first_pulls.txt` as provided: regular season, first genuine spell per game, team and deficit; deficits 1–3.
- **Bubble team:** with 10 games left, a 7–3 finish reaches last season's playoff line (8th place in the conference by points %, 4th per division in 2020–21) and a 3–7 finish misses it.
- **Lines:** best line for the last 44 s, then 40 / 38 / 36 s for lines 2–4; the overall 6v5 rate before that final rotation.
- **Franchises:** ATL→WPG and PHX/ARI→UTA are one franchise each.

## Run it

```bash
npm install
npm run dev        # http://localhost:8080
npm test           # DP test case + parity with the Python reference
npm run build
```

The site reads only the small JSON files in `src/data/`. They are committed, so the site builds without the raw data.

## Rebuild the data (optional)

The raw course files and course skills are **not** committed. To regenerate `src/data/*.json`:

1. Put the course `.txt` files in `analysis/data_raw/` (see that folder's README).
2. Unzip the course skills into `analysis/skills/` (`scoring_rates/`, `srs/`, `bayes/`, `regression/`).
3. Run:

```bash
pip install pandas numpy scipy
python3 analysis/test_dp.py      # Python DP checks
python3 analysis/build_data.py   # writes src/data/*.json and src/lib/dp.fixtures.json
npm test                         # confirms the TypeScript DP still matches
```

## Layout

```
analysis/            Python: reference DP (dp.py), tests, data build, team/conference reference
src/lib/dp.ts        TypeScript DP used by the site (port of analysis/dp.py)
src/lib/dp.test.ts   Test case + parity fixtures from Python
src/data/            Precomputed JSON the site reads
src/pages/           Overview, When teams pull, The model, Deeper dives, About
src/components/      Charts, sortable table, rate sliders, glossary tooltips
```

## Moving it to Lovable

The stack matches Lovable's usual template (Vite, React 18, TypeScript, Tailwind, Recharts, React Router; dev server on port 8080). There is no backend, no Supabase and no environment variables. Lovable's GitHub sync creates its own repository, so the usual route is to create a blank Lovable project, connect GitHub, and push this code to the repository Lovable creates (fast-forward, no force-push). Publish only shortly before the deadline.

## Data credits

Course-provided NHL data (2010–11 through games of November 7, 2026). Team summaries from [MoneyPuck.com](https://moneypuck.com), used as a 5v5 cross-check.
