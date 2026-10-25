# Shots v1: experimental probability model

This is a research feature, not a validated profitable strategy. Parameters were fixed before inspecting the displayed per-player held-out results.

## Inputs and distribution

- Up to 40 prior completed regular-season games, across the selected and previous seasons.
- Mean: 50% last-10 shot average plus 50% full-sample shot average.
- Venue multiplier: player venue/sample mean ratio, shrunk by n/(n+20), capped at ±10%.
- Opponent multiplier: player's own prior results against this opponent, shrunk by n/(n+40), capped at ±10%. This is not an opponent team defense model.
- Ice-time multiplier: last-5/full-sample mean minutes, capped at 0.85–1.15. Requires 20 timed sample games and 3 recent timed games.
- NB2 dispersion: half of positive (sample variance − sample mean)/sample mean², capped at 1. Poisson when dispersion is zero.
- No injury, confirmed lineup, power-play deployment, or opponent-wide shot suppression input.

## Evaluation

Rolling-origin tests use only dates before the target game. Minimum training sample: 20 games. Up to 40 later games are tested at today's threshold; these were not necessarily historical offered sportsbook lines. Brier loss is half the sum of squared errors over over/under/push outcomes; for half lines this equals binary Brier loss. Baseline: last-40 empirical counts with 0.5 smoothing on each possible outcome. Five bins show over-probability calibration descriptively; they are not a fitted calibration model.

Checks require 30 test games, model Brier no worse than baseline, positive estimated EV under both ±15% expected-shot sensitivity scenarios, quote age ≤15 minutes, an upcoming game, and verified team/venue. Passing is exploratory evidence only, not statistical significance. Per-player samples and repeated tests across players/lines can exaggerate apparent advantages.

Expected return per unit = P(win)×(decimal odds−1)−P(loss). Pushes return the stake. Break-even comparison uses win probability conditional on settlement. The sensitivity range is not a confidence interval.

Historical sportsbook prices are unavailable here, so no betting ROI backtest or profitability claim is made. Previous-season role/team changes can reduce relevance.

## Validation

Run `node tests/shots-model.test.mjs`. Tests cover reference probability values, distribution mass, push-aware EV, missing data, time ordering, and target/future leakage. During implementation, 64 count distributions were also compared against SciPy Poisson/NB references. Live checks verify sample sizes and shortlist rejection reasons; they do not validate a profitable model.

References:
- https://docs.scipy.org/doc/scipy/reference/generated/scipy.stats.nbinom.html
- https://otexts.com/fpp3/toolbox.html
- https://scikit-learn.org/stable/modules/calibration.html
