"""Checks for the reference DP. Run: python3 analysis/test_dp.py"""
import numpy as np

from dp import EITHER, PLAYOFF, PULL, evaluate_policy, line_rate_fn, line_schedule, solve


def test_handout_case():
    res = solve(3.0, 8.0, 20.0)
    assert res["latest_pull"] == {1: 240, 2: 495, 3: 753}, res["latest_pull"]


def test_values_bounded():
    for payoffs, hi in (((2, 1.5, 0), 2.0), (PLAYOFF, 1.0)):
        res = solve(2.35, 7.10, 21.78, payoffs=payoffs)
        assert res["value"].min() >= -1e-12 and res["value"].max() <= hi + 1e-12


def test_pull_region_is_one_block():
    res = solve(3.0, 8.0, 20.0)
    for deficit in (1, 2, 3):
        i = int(np.where(res["diffs"] == -deficit)[0][0])
        col = res["decision"][1:, i]
        latest = res["latest_pull"][deficit]
        inside = col[:latest]
        # Inside the window every second is Pull, except exact ties at the horn.
        assert np.all((inside == PULL) | (inside == EITHER))
        assert np.all(col[latest:] != PULL)


def test_monotone_in_6v5_rate():
    prev = {1: 0, 2: 0, 3: 0}
    for r65 in (4, 6, 8, 10, 12):
        lp = solve(2.35, r65, 21.78)["latest_pull"]
        for d in (1, 2, 3):
            assert lp[d] >= prev[d]
        prev = lp


def test_policy_evaluation_matches_optimal():
    res = solve(2.35, 7.10, 21.78)
    lp = res["latest_all"]
    val = evaluate_policy(2.35, 7.10, 21.78, lambda k: lp.get(k))
    # Threshold policy at the optimal times reproduces the optimum for down 1-3.
    for deficit in (1, 2, 3):
        i = int(np.where(res["diffs"] == -deficit)[0][0])
        assert abs(val[-1, i] - res["value"][-1, i]) < 1e-9


def test_line_schedule():
    line_at = line_schedule()
    assert [line_at(t) for t in (1, 44, 45, 84, 85, 122, 123, 158, 159)] == [1, 1, 2, 2, 3, 3, 4, 4, 1]


def test_line_rate_fn():
    fn = line_rate_fn({1: 8.0, 2: 7.0, 3: 6.0, 4: 5.0}, 7.1)
    assert [fn(t) for t in (1, 44, 45, 158, 159, 900)] == [8.0, 8.0, 7.0, 5.0, 7.1, 7.1]


if __name__ == "__main__":
    for name, fn in list(globals().items()):
        if name.startswith("test_"):
            fn()
            print("ok ", name)

