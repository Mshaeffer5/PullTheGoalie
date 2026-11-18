"""Pull-the-goalie dynamic program (reference implementation).

State: goal difference d (ours minus theirs), clamped to [-cap, cap].
Time:  seconds left t = 0, dt, ..., horizon; solved backward from the horn.
Each step at most one goal: rate (goals per 60) x dt / 3600.
Terminal payoff at 0:00: win / tie / loss (regular season 2 / 1.5 / 0;
playoffs 1 / 0.5 / 0, i.e. win probability).
At every (t, d) the team picks the better of keeping the goalie in or pulling it.

The TypeScript port in src/lib/dp.ts must match this file exactly
(see analysis/test_dp.py and src/lib/dp.test.ts).
"""
from __future__ import annotations

import numpy as np

PULL, STAY, EITHER = 1, 0, 2
TIE_EPS = 1e-12
REGULAR = (2.0, 1.5, 0.0)
PLAYOFF = (1.0, 0.5, 0.0)


def _terminal(diffs, payoffs):
    win, tie, loss = payoffs
    return np.where(diffs > 0, win, np.where(diffs == 0, tie, loss)).astype(float)


def _shift(v):
    """Values one goal up / one goal down, clamped at the cap."""
    up = np.append(v[1:], v[-1])
    down = np.insert(v[:-1], 0, v[0])
    return up, down


def solve(r55, r65, r56, horizon=900, cap=8, dt=1, payoffs=REGULAR, r65_at=None):
    """Optimal policy.

    r65_at: optional function seconds_left -> 6v5 rate (lines extension); it is
    evaluated at the time of the step being decided (t seconds left).
    Returns dict with diffs, value[t_index, d_index], decision[t_index, d_index],
    latest_pull {1, 2, 3: seconds or None}.
    """
    diffs = np.arange(-cap, cap + 1)
    steps = horizon // dt
    value = np.zeros((steps + 1, diffs.size))
    decision = np.full((steps + 1, diffs.size), STAY, dtype=np.int8)
    v = _terminal(diffs, payoffs)
    value[0] = v
    p55 = r55 * dt / 3600.0
    p56 = r56 * dt / 3600.0
    for k in range(1, steps + 1):
        t = k * dt
        rate65 = r65_at(t) if r65_at is not None else r65
        p65 = rate65 * dt / 3600.0
        up, down = _shift(v)
        v_stay = p55 * up + p55 * down + (1 - 2 * p55) * v
        v_pull = p65 * up + p56 * down + (1 - p65 - p56) * v
        diff = v_pull - v_stay
        decision[k] = np.where(diff > TIE_EPS, PULL, np.where(diff < -TIE_EPS, STAY, EITHER))
        v = np.maximum(v_pull, v_stay)
        value[k] = v
    latest_all = {}
    for deficit in range(1, cap + 1):
        col = decision[:, np.where(diffs == -deficit)[0][0]]
        ks = np.where(col == PULL)[0]
        latest_all[deficit] = int(ks.max() * dt) if ks.size else None
    latest = {d: latest_all[d] for d in (1, 2, 3)}
    return {"diffs": diffs, "value": value, "decision": decision, "latest_pull": latest,
            "latest_all": latest_all, "dt": dt}


def evaluate_policy(r55, r65, r56, pull_from, horizon=900, cap=8, dt=1, payoffs=REGULAR):
    """Value of a fixed threshold policy: when trailing by k, pull once t <= pull_from(k).

    pull_from: function deficit (>=1) -> seconds left at which the goalie is pulled
    (None = never). Leading or tied: never pull. Returns value[t_index, d_index].
    """
    diffs = np.arange(-cap, cap + 1)
    steps = horizon // dt
    thresholds = np.array([pull_from(-d) if d < 0 else None for d in diffs], dtype=object)
    v = _terminal(diffs, payoffs)
    value = np.zeros((steps + 1, diffs.size))
    value[0] = v
    p55, p65, p56 = (r * dt / 3600.0 for r in (r55, r65, r56))
    for k in range(1, steps + 1):
        t = k * dt
        up, down = _shift(v)
        v_stay = p55 * up + p55 * down + (1 - 2 * p55) * v
        v_pull = p65 * up + p56 * down + (1 - p65 - p56) * v
        pulled = np.array([th is not None and t <= th for th in thresholds])
        v = np.where(pulled, v_pull, v_stay)
        value[k] = v
    return value


def mss(seconds):
    if seconds is None:
        return "never"
    return f"{int(seconds) // 60}:{int(seconds) % 60:02d}"


def line_schedule(blocks=((1, 44), (2, 40), (3, 38), (4, 36))):
    """Function seconds_left -> forward line on the ice, counting back from the horn."""
    cycle = sum(b for _, b in blocks)

    def line_at(t):
        x = (t - 1) % cycle  # second t covers the interval (t-1, t]
        for line, length in blocks:
            if x < length:
                return line
            x -= length
        return blocks[-1][0]

    return line_at


def line_rate_fn(line_rates, base_rate, blocks=((1, 44), (2, 40), (3, 38), (4, 36))):
    """6v5 rate as a function of seconds left: the best line covers the last block before the horn,
    the next-best line the block before that, and so on (handout hint). Before that final rotation
    (2:38 with the default blocks) the line on the ice is unknown, so the overall 6v5 rate applies."""
    total = sum(b for _, b in blocks)
    line_at = line_schedule(blocks)

    def rate(t):
        return line_rates[line_at(t)] if t <= total else base_rate

    return rate
