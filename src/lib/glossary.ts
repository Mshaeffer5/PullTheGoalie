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
    def: "The earliest genuine spell for a team in a game at a given deficit. Re-pulls after an empty-net goal are not counted again.",
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
    term: "6v5 and 5v6",
    def: "6v5: six attackers against five, with our goalie pulled. 5v6: the opponent's five skaters facing our six, shooting at our empty net.",
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
    def: "With 10 games left, a team that would reach last season's playoff line (8th place in its conference, by points %) with a 7–3 finish but miss it with a 3–7 finish.",
  },
  srs: {
    term: "SRS",
    def: "Simple Rating System: goals per game better than an average team, after adjusting for opponents and home ice, fitted from each season's game results.",
  },
  shrink: {
    term: "Shrunk pull time",
    def: "A team's average pull time pulled toward the league average in proportion to how noisy it is (about 15 games a season). Uses a normal–normal Bayes update.",
  },
  repull: {
    term: "Re-pull",
    def: "A second or later goalie-out spell by the same team in the same game, often after conceding an empty-net goal.",
  },
};
