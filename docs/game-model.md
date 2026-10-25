# V18 game market lab

Model version: goals-v1. Markets: NHL full-game moneyline, full-game standard puck line, and regulation three-way (home/draw/away after 60 minutes).

## Model and evaluation

Each team's last 40 completed regular-season games are normalized to regulation goals. Explicit OT/SO outcomes imply a regulation tie at the lower final score, only when the official final margin is one. Unknown end-period metadata is excluded from training; three-way grading stays pending when regulation cannot be verified.

Team attack/defense rates blend the last 10 and full-sample means equally, shrink toward a fixed 2.8-goal prior with 10 equivalent games, and use venue adjustments capped at ±10%. Expected matchup goals are geometric means of offense and opponent defense, bounded at 0.25–6. Independent Poisson regulation scores are enumerated to 30 and normalized. Ties split 50/50 in the OT/SO model. This split is an assumption, not a fitted OT model.

Up to 100 held-out league games are forecast with only earlier dates and at least 20 training games per team. Benchmark: equal-strength Poisson goals at 2.8 per team. It is not a sportsbook probability benchmark or historical-price ROI test. Brier loss uses regulation home/draw/away for three-way; binary/ternary win/loss/push for moneyline/spreads. Parameters are fixed, not selected using this displayed holdout.

Exploratory candidate checks: 100 tests; Brier no worse than baseline; positive modeled value across ±15% goal-rate and 40–60% OT share scenarios; quotes within 15 minutes; verified upcoming regular-season game; complete archive under 48 hours old. These heuristics do not establish significance, calibrated probabilities, or a profitable strategy.

## Paper testing and settlement

Existing shots snapshots and shots-v1 remain unchanged. New game forecasts are stored separately with goals-v1, original quote, model probabilities, code commit, source archive time, training end date and digest. Previously started games are never backfilled.

Moneyline/puck-line settlement uses official final scores including OT and the shootout winner goal. Three-way uses regulation metadata, so an OT/SO game is a regulation draw. Integer puck lines can push. Actual sportsbook cancellation/settlement rules may differ from these paper rules.

Game paper metrics have their own market filters, baseline and calibration. H2H/three-way comparisons deduplicate games; puck-line comparisons deduplicate complementary handicaps. Multiple markets on one game remain correlated, not independent bets.

## Data and operating budget

Official NHL team schedules supply a deduplicated league archive. The current season refreshes every 12 hours; the prior season is reused after a successful fetch. A first build queries 32 teams across two seasons. Missing feeds are logged and prevent shortlist qualification.

The odds key remains server-side. One selected game requests h2h, spreads, h2h_3_way in one US region, costing up to three provider credits on a cache miss. Results cache for 10 minutes. No paid odds retries. Paper sampling retains the two-game daily cap and observed 100-credit reserve; game-market capture needs at least 103 observed credits. With shots, a fully uncached sampled game can use up to four credits. Interactive app use is additional.

Run npm test. Tests cover OT/SO vs regulation, puck-line pushes, unknown regulation metadata, distribution mass, future leakage, immutable captures, separate grading, reserve controls, archive refresh/deduplication and secret-free cache/response data.

Sources:
- https://the-odds-api.com/sports-odds-data/betting-markets.html
- https://help.bet365.com/s/en/sportsrules/ice-hockey
- https://api-web.nhle.com/v1/club-schedule-season/CAR/20252026
