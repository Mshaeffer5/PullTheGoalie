import trend from "@/data/trend.json";
import distribution from "@/data/distribution.json";
import rates from "@/data/rates.json";
import lines from "@/data/lines.json";
import value from "@/data/value.json";
import teams from "@/data/teams.json";
import outcomes from "@/data/outcomes.json";
import stakes from "@/data/stakes.json";
import homeRoad from "@/data/home_road.json";
import records from "@/data/records.json";
import hook from "@/data/hook.json";
import meta from "@/data/meta.json";

export { trend, distribution, rates, lines, value, teams, outcomes, stakes, homeRoad, records, hook, meta };

export type Deficit = 1 | 2 | 3;
export const DEFICITS: Deficit[] = [1, 2, 3];

/** 2025–26 regular-season mean time left at the first genuine pull, by deficit (seconds). */
export const ACTUAL_2025: Record<Deficit, number> = {
  1: rates.actual2025["1"],
  2: rates.actual2025["2"],
  3: rates.actual2025["3"],
};

/** Pooled playoff means (stakes seasons), by deficit (seconds). */
export const ACTUAL_PLAYOFF: Record<Deficit, number> = Object.fromEntries(
  stakes.rows.filter((r) => r.group === "playoffs").map((r) => [r.deficit, r.mean]),
) as Record<Deficit, number>;

export const DEFAULT_RATES = { r55: rates.chosen.r55, r65: rates.chosen.r65, r56: rates.chosen.r56 };

export const LAST_FULL_SEASON = "2025–26";
export const PARTIAL_SEASON = meta.partialSeason.label;
