# Implementation audit — 2026-10-27

Verified GitHub baseline: `1fb7b2f60d297b828c7df7c5adf34f827d204060`. UI assets use v20 labels, but prediction versions are `shots-v1` and `goals-v1`. GitHub reports no commit status for that revision; authenticated Cloudflare deployment revision cannot be independently verified in this session. Do not call a GitHub push a verified deployment.

| Area | Verified implementation | Limitation |
| --- | --- | --- |
| NHL statistics | Game logs, roster, team context, historical game archive | Live NHL/ESPN feed permission gates remain in force |
| Sportsbook odds | Server proxy, quote timestamps, shared budget, fresh-price selection | Live provider requires configured permission, budget and database; no new calls enabled |
| Shots | Actual Poisson/NB count probabilities, rolling pregame tests, push-aware EV | 50/50 recent weighting, adjustment caps, dispersion shrinkage and sensitivity ranges are fixed heuristics; not learned or calibrated |
| Points | No separate production model at baseline | New separate experimental count model; not connected to live points recommendations |
| Moneyline, puck line, regulation | Actual score-distribution probabilities; consistent regulation/OT allocation | Independent Poisson goals; fixed 2.8 prior and 50% OT split; no goalie-specific or xG adjustment |
| Totals | Missing at baseline | Added probability, grading and holdout support; no extra live provider market requested |
| Goalie intelligence | Explicit confirmation, identity and freshness checks; minute refresh | Confirmation gates recommendations but does not adjust goal rates; no reliable GSAx input |
| Availability | Injury, recent absence, scratch and roster safeguards | Unknown remains uncertain; no complete confirmed lineup feed |
| Lines / PP / TOI / opponent / rest | Recent usage, shots allowed and rest context; material role-change blocks | Mostly descriptive; no claimed quantified effect; free authorized line combinations/xG/attempts not established |
| Best Picks | Quote comparison, EV and sensitivity/freshness/availability gates | Exploratory qualification is not validated strength; new complete-market margin comparison and top-10 display cap |
| Paper history | Frozen pregame snapshots, digest, code version, grading, ROI/Brier/calibration | Scheduled capture paused; existing files are Git history, not an independent trusted timestamp service |
| CLV | No verified closing capture at baseline | New strict same-line/book pregame calculation; collector not activated; absent quotes stay unknown |
| Validation | Chronological shots/game holdouts, empirical/equal-team baselines | Not sportsbook outperformance; no automatic model promotion |
| Mobile | Existing mobile navigation, player images, cards, remembered book | Watchlist, combined cross-market ranking and full confidence/team/player filters incomplete |
| 30-day program | Existing saved paper history | New explicit-window report by market/version; collection must work before evaluating a prospective program |

No invented odds, outcomes or advanced statistics were added. Predictive probability is a distribution output, not a validated confidence label. No “high strength” claims are justified by the current evidence.

## Changes in this increment

- `count-model.js`: experimental shots/points count models with pregame cutoffs, minimum samples, season-scale history, recent shrinkage, exposure normalization and separately fitted production/dispersion. Poisson/NB rolling comparisons report Brier and log loss. Missing advanced inputs are explicit. Production `shots-v1` is preserved pending unseen evaluation.
- `game-model.js`: totals probability and official-final settlement support, integer pushes, OT/SO final-score convention; unknown markets fail unresolved. Existing market formulas/version unchanged.
- `best-picks-engine.js` / mobile cards: proportional no-vig comparison only for complete fresh same-book outcome sets, market edge distinct from raw implied price; at most ten cards per selected category. Passing gates still means exploratory, not calibrated strength.
- `evaluation-core.js`: strict quote identity and pregame/freshness CLV eligibility; paper metrics, log loss, unresolved counts and explicit 30-day market/version reports. These are reusable functions, not a running collector or durable write service.
- Reproducible commands: `npm test`; `node scripts/validate-models.mjs 2026-10-27`; `node scripts/paper-report.mjs 2026-10-27`.

## Saved-archive validation

Archive generated 2026-10-26 10:49 UTC. Last 100 eligible game tests span October 11–25, each with training dates strictly earlier than its target date.

| Forecast | Model Brier | Equal-strength baseline |
| --- | ---: | ---: |
| Home moneyline | 0.237966 | 0.250000 |
| Regulation three-way | 0.321132 | 0.330184 |
| Home -1.5 puck line | 0.204760 | 0.216703 |
| Over 6.5 total | 0.245958 | 0.264583 |

Lower is better. Three-way uses half multiclass squared error and is not directly comparable with binary values. Fixed spread/total are test thresholds, not reconstructed historical sportsbook lines. Correlated games, small holdouts and unmeasured market comparisons prevent accuracy/profitability claims. Challengers have correctness tests but no claimed real player holdout advantage.

## Remaining dependencies and work

1. Verify deployment revision and private page behavior through an authorized authenticated Cloudflare session. No login changes or payment setup needed for this code work.
2. Resolve existing source permission and runtime configuration blockers before live collection. No bypasses or quota increases were introduced.
3. Obtain authorized historical pregame player exposure, attempts, xG/xA, goalie and lineup snapshots; audit publication times. Then run challenger comparisons on previously unseen games before promotion.
4. Connect private append-only capture and closing-observation storage. Existing public Git repository must not receive personal watchlists, private credentials or wagering records. Repository visibility was not changed.
5. Wire points/totals live market acquisition only with explicit quota accounting, complete market settlement rules and tests. No silent extra provider credit was added.
6. Complete cross-market leaderboard, explanation factors/counterarguments, watchlist and automated prospective evaluation. A report command alone is not a completed 30-day program.

## Follow-up: interactive research and performance

Player Lab now exposes experimental shots/points probabilities and Poisson/NB/production-shots comparisons from its already requested season game log. Target/current-day games and missing statistics are excluded. This adds no provider requests. Minimum history and missing advanced inputs are displayed. Count challenger exposure rates now also shrink recent per-minute production toward the longer record; its version is now `count-challenger-v2` and no production recommendation formula is promoted.

Performance now includes a selectable, locally remembered 30-day UTC window, qualifying pregame captures, flat-stake outcomes, selection Brier/log loss, market/version breakdown and explicit unknown closing value. This is a report over saved records, not activated collection. Empty and incomplete samples do not receive a strength rating. Both research modules are packaged and served only behind existing authentication; raw data/source route restrictions remain.

## Verified GitHub deployment and player validation — October 27, 2026

Cloudflare Pages reported a completed successful check for documentation-only commit `44be7a39657538ad67513a831fcb4a3f8291a725`. Routine source updates can use GitHub `main`; inspect the Cloudflare check for each exact commit. This confirms deployment automation, not authenticated page behavior or private repository visibility.

Player Lab comparisons now include a smoothed historical-outcome baseline fitted separately for each held-out target using strictly earlier dates. Every model reports Brier skill against its paired baseline and five Over-probability calibration bins, including sample counts and observed frequencies. Empty evidence remains unknown. Integer pushes retain their own probability mass. These descriptive diagnostics neither refit probabilities nor promote experimental models; no production forecast formula, external feed, authentication setting, or collection schedule changed.


## Combined Decision Engine and Top 10 — October 27, 2026

Best Picks now opens with All Markets, comparing shots props and game markets in a single Top 10. EV is recomputed from model outcome probabilities and the selected sportsbook price instead of trusting a stored estimate. Invalid prices and incoherent probability distributions are excluded. Existing pregame, history, roster, goalie, freshness and sensitivity gates are retained; failed estimates sort after eligible candidates even in inspection mode.

By default, only the highest-ranked selection per player/market/game survives alternative-line and opposing-side suppression. Users can reveal alternatives or filter back to props/game bets. Cards expose model fair decimal price, sensitivity return and same-game selection counts; these are research diagnostics, not validated strength or independent portfolio recommendations. Three-tab keyboard navigation wraps in both directions. This introduces no additional provider requests, saved personal data, collection activation or wagering actions.


## Paper evaluation evidence cutoff — October 27, 2026

The 30-day report now reconstructs timestamped settlement corrections as of an explicit cutoff, excludes future closing observations, leaves undated grades unresolved, deduplicates identical record copies and excludes conflicting copies. It exposes duplicate/conflict counts, daily capture cohorts and actual matched CLV coverage. The dashboard offers an optional UTC cutoff, and the offline report accepts it as its second argument. Frozen forecasts, existing grading automation, provider holds and collection schedules are unchanged. This does not provision private durable storage or start a prospective collection program.


## Goalie and availability evidence — October 27, 2026

Cards now expose structured goalie status and source/retrieval/announcement distinctions. Existing game eligibility failures identify the affected team's missing confirmation. The minute refresh reevaluates injury research as well as goalie/scratch evidence; shared team-context requests retain a five-minute cache. Scan rows retain their already fetched history for refreshed availability checks. No extra paid market acquisition or feed activation was added.

An offline identity-bound goalie-quality challenger is implemented with strict prior-data, publication-time, sample and source safeguards. It is not wired into rankings or paper forecasts, has no live quality feed, and has only synthetic correctness tests. No historical accuracy benefit is claimed.


## Paired goalie backtesting — October 27, 2026

Added offline chronological goalie-challenger validation with paired base/challenger Brier/log loss and calibration, earliest-snapshot selection, identity/publication-time safeguards, and exclusion/coverage counters. The full saved archive has 1,496 eligible games but no supplied archived pregame goalie evidence, so paired tests and performance estimates remain zero/unknown. Synthetic tests cover future/late evidence, target-outcome isolation, identity mismatch, duplicate archives and ambiguous snapshots. Production models, authentication, data collection and frozen forecasts remain unchanged.


## Prospective evidence journal — October 27, 2026

Added a private local SQLite journal with append-only triggers, chained hashes, conflict rejection, reopen verification and repository/symlink path protections. The collector CLI requires configured private evidence storage and saves allowlisted pregame context before odds requests. Storage failure prevents that capture. Tests cover persistence, tampering, duplicate/conflicting writes, late captures, permissions, credential-field exclusion and collector failure behavior.

No private collector host or durable volume was provisioned; no collection flag or schedule was enabled. The adapter records starter/scratch context but has no goalie-quality source. This closes a code-level evidence-preservation gap, not the operational prerequisites for a live 30-day trial.
