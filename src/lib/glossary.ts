export const GLOSSARY: Record<string, { term: string; def: string }> = {
  pull: {
    term: "Goalie pull",
    def: "A trailing team replaces its goalie with a sixth skater to raise its chance of scoring, leaving its own net empty.",
  },
  delayed: {
    term: "Delayed penalty",
    def: "When a penalty is about to be called, the other team pulls its goalie for a few seconds at no risk: play stops as soon as the offending team touches the puck. Not a strategic pull.",
  },
  genuine: {
    term: "Genuine pull",
    def: "A goalie-out spell that lasted at least 20 seconds, contained a goal, or ran to the final horn. This filters out most delayed-penalty blips.",
  },
  first: {
    term: "First genuine pull",
    def: "The first qualifying goalie pull by a team at each deficit in a game. If a team concedes an empty-net goal and pulls its goalie again while trailing by a different number of goals, that second pull is counted separately. Qualifying means the goalie stayed off at least 20 seconds, a goal was scored, or the spell ran to the final horn.",
  },
  deficit: {
    term: "Deficit",
    def: "Opponent goals minus own goals when the goalie left the ice. 1 means down one goal.",
  },
  gp60: {
    term: "Goals per 60",
    def: "Goals scored per 60 minutes of play in a given on-ice situation: goals × 3600 ÷ seconds.",
  },
  sixfive: {
    term: "6-on-5 and 5-on-6",
    def: "6-on-5: your team's six skaters against five, with your goalie pulled for an extra attacker. 5-on-6: the opponent's five skaters against your six, shooting at your empty net.",
  },
  points: {
    term: "Expected standings points",
    def: "The model's regular-season objective: a regulation win is worth 2, a tie at the horn 1.5 on average (1 guaranteed plus an even chance at the overtime point), and a regulation loss 0.",
  },
  winprob: {
    term: "Win probability",
    def: "The model's playoff objective. Playoff overtime has no loser point, so a tie at the horn is worth a 50% chance to win: payoffs 1 / 0.5 / 0.",
  },
  context: {
    term: "Pull context",
    def: "Third-period play in which the side with more skaters is trailing. Restricting to it removes delayed-penalty time from the goalie-out scoring rates.",
  },
  bubble: {
    term: "Bubble team",
    def: "With 10 games left, a team that would reach last season's playoff line (8th place in its conference, by points percentage) with a 7–3 finish but miss it with a 3–7 finish.",
  },
  srs: {
    term: "SRS",
    def: "Simple Rating System: goals per game better than an average team, after adjusting for opponents and home ice, fitted from each season's game results.",
  },
  shrink: {
    term: "Adjusted pull time",
    def: "A team's average pull time moved toward the league average in proportion to how noisy it is: teams with fewer pulls are adjusted more. Technically, a normal–normal Bayes update using the spread of true team averages and the noise of a single pull.",
  },
  repull: {
    term: "Repeat pull",
    def: "A second or later goalie pull by the same team in the same game, usually after conceding an empty-net goal (pulled down one, fell behind by two, pulled again). It counts as a first pull at its new deficit unless repeat pulls are excluded.",
  },
};
