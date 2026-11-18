# Moving Pull the Goalie into Lovable

## What to know first (checked November 2026)

- **New Lovable projects use TanStack Start**, not the older React + Vite stack. It became the default for new projects on May 13, 2026. Older React + Vite projects keep working, but a new project starts on TanStack Start.
- **Git sync can't attach to an existing repository.** Connecting GitHub always creates a new repository. Lovable's documented way to bring in existing code is to upload it as a ZIP (**Upload code**) and connect Git sync afterwards.
- **The ZIP import rebuilds the app on TanStack Start**, keeping the same pages, routes and behavior. The first import per account is free; messages after that use build credits.
- **Pushing never publishes.** The live site changes only when you click Publish.

Sources: docs.lovable.dev pages "Sync your Lovable project with GitHub", "Git sync overview", "Import a project", "Upgrade a project to TanStack Start" and "Publish your Lovable project".

This repo is prepared for that rebuild:

- All routing goes through one file, `src/lib/nav.tsx`, plus the route table in `src/App.tsx`.
- The model (`src/lib/dp.ts`) and the data (`src/data/*.json`) are plain TypeScript and JSON with no framework code. A test (`npm test`) checks the model against the course test case and a Python reference.
- Charts render only in the browser, and saved slider values load after the page mounts, so server rendering won't break them.
- There is no backend, database, login or environment variable.

## Recommended route: ZIP import

1. **Get the ZIP.** Use `pull-the-goalie-lovable.zip`, which contains the web app only, without the Python analysis or `node_modules`. Alternatively, on GitHub use Code → Download ZIP, then delete the `analysis/` folder.
2. **Import.** In the Lovable dashboard: **+** → **Import project to Lovable** → **Upload code** → drop the ZIP → **Start import**. If that menu item isn't there, the feature hasn't reached your account yet; use the fallback below.
3. **Steer the rebuild.** As the first chat message, paste the prompt below.
4. **Check the numbers** against the checklist below, in the Lovable preview.
5. **Optional:** connect GitHub in Lovable. It creates a new private repository for the site; this repo stays the home of the analysis.
6. **Publish shortly before the deadline:** Publish → set **Website URL** to `pull-goalie-sa-2026-N` (your group number) → audience **Public** → Publish. You can also change the URL later under Project settings → URL subdomain.

### Prompt to paste into Lovable

```text
This is a finished, tested static website for a class assignment. Rebuild it on your stack without changing what it shows or how it behaves.

Must stay exactly as they are:
- src/lib/dp.ts (the dynamic-programming model; src/lib/dp.test.ts verifies it) and every file in src/data/*.json.
- All text, numbers, tables, charts, colors and layout.

Structure:
- Routes: / ; /actual, /actual/distribution, /actual/home-road, /actual/records ; /model, /model/pull-now, /model/hood, /model/test ; /deeper, /deeper/teams, /deeper/lines, /deeper/outcomes, /deeper/stakes ; /about. Unknown URLs show the overview page.
- Every link and route lookup goes through src/lib/nav.tsx (AppLink, AppNavLink, useSubTab, usePathname). Port that file and the route table in src/App.tsx to TanStack Router; pages should not need edits.
- The scoring-rate sliders and the Regular season / Playoffs toggle share one state across all pages (src/lib/model.tsx) and are saved in localStorage after mount.
- Recharts charts must render on the client only (they already wait for mount via ResponsiveChart in src/components/charts.tsx).

Do not add a backend, database, authentication, analytics or environment variables. After rebuilding, open /model/test and confirm the table shows 4:00, 8:15 and 12:33 with every difference 0:00.
```

### Checklist after import (default rates)

| Where | What you should see |
| --- | --- |
| Overview, headline | "Edmonton pulled its goalie with 0:31 left in Game 7. Our model says 4:11." |
| Overview, three cards | 1:54 vs 3:51 · 2:46 vs 7:55 · 4:39 vs 12:02 |
| The model → Test case | 4:00 / 8:15 / 12:33, every difference "0:00 ✓" |
| The model, Playoffs toggle | Down 1 changes from 3:51 to 4:11 |
| The model → Under the hood | Value and decision grids, with a red Pull region |
| Deeper dives → Value of pulling | +0.58 points per season |
| Deeper dives → Line changes | Down 1: pull at 4:05 |
| Deeper dives → Teams, 2025–26 | Florida Panthers ranked 1 |
| Any page | Click two header tabs in a row: the page must not go blank |
| Any page | Move a slider, go to Overview: a "you have changed the scoring rates" note appears; Reset restores 3:51 |

## Fallback route: blank project, then port the code

If the import is unavailable or the rebuild drifts:

1. Create a new Lovable project with a one-line prompt such as "Blank site titled Pull the Goalie". Then connect GitHub; Lovable creates a repository.
2. Share that repository with the person doing the port (or make it public for a moment).
3. The port: copy `src/lib`, `src/data`, `src/components`, `src/pages` and `src/index.css` into Lovable's repo. Rewrite `src/lib/nav.tsx` for TanStack Router, and create one route file per URL above that renders the matching page. Run `npm test`, then push to the repository's `main` as normal commits (no force-push).

## Local check before any handoff

```bash
npm install
npm test         # 14 tests: test case + Python parity
npm run build
npm run preview  # click through
```
