# Phase 2 Batch 1 — NHL-only validation audit (2026-10-30)

Baseline reviewed: main d78ff1c62e99784efbe6e8934cca7fbc41365761. Phase 2 issue #7.

## Inventory

- Shots-v1 production; simplified shots challenger research only. Existing five-variant retrospective comparison in docs/shots-five-variant-results-2025.md.

- Goals-v1: moneyline, three-way regulation, puck line and totals; fixed-goal assumptions and limited goalie adjustment.

- Points Poisson/NB challenger experimental; no production promotion. Goalie-quality challenger lacks archived as-of goalie evidence.

- All-markets Top 10, EV calculations, quote freshness and availability gates implemented; not proven to be calibrated strength.

- Paper/CLV/scorecards and private evidence storage partially implemented; prospective collection paused.

## Existing research results — document review, NOT freshly rerun

- Saved game scorecard: 1,167 games per market; latest-100 home moneyline Brier 0.237966 versus 0.25 equal-strength; three-way 0.321132 versus 0.330184; puck line 0.204760 versus 0.216703; total 0.245958 versus 0.264583.

- Moneyline calibration 200 games: raw 0.23897680 versus calibrated 0.23760507; paired improvement interval [-0.001462, +0.004192] crosses zero.

- Shots over 2.5 later 2025-26 sample: original 0.15177896, simplified 0.15075109, empirical 0.15104064. Retrospective and not an untouched holdout.

- Points over 0.5: 31,406 forecasts; Poisson Brier 0.210334 versus empirical 0.210960; retrospective, log-loss interval crosses zero.

- Historical licensed sportsbook prices absent. No defensible real odds-based EV, ROI, CLV, or profitability conclusion.

## Cross-market strength standard — SPECIFICATION ONLY, not deployed

1. Require pregame event/market/line/selection identity, quote and source timestamps, valid probabilities, fresh roster/goalie/availability evidence and source permission.

2. For unit stake compute estimated EV = p_win*(decimal_price-1) - p_loss, with explicit push probability where applicable; do not mistake implied probability for model confidence.

3. Rank eligible NHL game and player markets together; cap at 10, suppress duplicate/opposing/alternative lines, never force ten selections.

4. Show price, probability, estimated EV, sensitivity/uncertainty, source and model version; until prospective cross-market calibration, mark ratings exploratory/unvalidated rather than asserting strong confidence.

5. Promote a challenger only after pre-registered frozen settings, genuinely unseen chronological paired holdouts, leakage checks, coverage, Brier/log loss/calibration and uncertainty intervals; evaluate real betting value separately using genuine as-of quotes.

6. After every batch report exact commit, tests, regressions, sample coverage, limitations and go/no-go.

## Execution status / blockers

- Inventory and acceptance framework completed from source documentation; no model changes, feed activation, purchases, wagers or security changes.

- Fresh npm test, report regeneration and CI execution NOT completed in this session. Local clone failed due network DNS; available GitHub connector lacks workflow dispatch. Prior documented tests are not a new test pass.

- Consequently full Batch 1 execution cannot be certified complete until exact-commit tests and report reproduction are run and inspected. Do not claim a passing run.

- Public GitHub repository: never commit secrets, personal bets, or licensed raw datasets.