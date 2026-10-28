# MoneyPuck offline historical import

Historical research data: **MoneyPuck.com**, https://moneypuck.com/data.htm. Its listed downloads are free for noncommercial use with clear attribution; other uses need permission. This importer is for private, noncommercial research. No raw MoneyPuck dataset is committed, served by the application, or redistributed in its public repository. No website scraping, new account, paid feed or recurring download is introduced.

## Reproduce the import

Download the regular-season goalies.csv and skaters.csv files linked by MoneyPuck's data page for the desired season. Season 2025 denotes 2025–26, not calendar-year 2025. The verified source files were:

- https://moneypuck.com/moneypuck/playerData/seasonSummary/2025/regular/goalies.csv
- https://moneypuck.com/moneypuck/playerData/seasonSummary/2025/regular/skaters.csv

Run `npm run report:moneypuck -- 2025 2026-10-28 /absolute/private/goalies.csv /absolute/private/skaters.csv`. The command reads local CSVs, performs no network requests or writes, and prints an attributed audit. `importMoneyPuck` also returns normalized per-player research rows for offline experiments. Files are bounded to 10 MiB each; required columns, season, player identity, exposure and numeric values are validated. Malformed input fails the import. Only all-situations rows are used. Exact duplicate normalized records count once; conflicting copies of a player are excluded and disclosed.

Goalie ice time is seconds and is converted to minutes. Goals saved above expected equals xGoals minus goals allowed; the per-60 value multiplies by 3,600 and divides by source seconds. Skater shots use I_F_shotsOnGoal, not unblocked attempts or expected shots. Outputs include shots per game and per 60. Missing exposure gives unknown rates, not zero.

## Actual download validation — October 28, 2026

The 2025 goalie file produced 98 all-situations player rows from 490 source rows; 71 had at least 600 minutes. SHA-256: `2fe2a2dbf25822cf1650e2ad00388c94ef303681fbfd8a8c7fdcb065212cd2fc`.

The skater file produced 940 all-situations player rows from 4,700 source rows; 715 had at least 20 games. SHA-256: `9a7e1f1a2f6bc8bc2bf10c5ba32947b47c4b26d5397287e4b30e9d662c4966e4`.

Neither file contained conflicting or repeated all-situations player records in this download. The sample thresholds describe exposure only, not model qualification or demonstrated predictive skill.

## Backtest boundaries

These are season summaries. `priorSeasonResearch` rejects target dates before July 1 following the source season's starting year. It prevents whole-season totals leaking into that season's targets. It does not prove when historical revisions were published. Every result remains researchOnly with historicalPublicationVerified=false. Team labels are historical and cannot establish a current roster.

No pregame starters, injuries, lineups, historical publication timestamps, zero-shot game logs, or target-game forecasts are reconstructed from these summaries. They do not satisfy the existing goalie backtest's archived pregame-evidence requirement and are deliberately not injected into it. The next data step for measured shots-model validation is game-level logs with explicit observation timing and complete player appearances; season-average rates alone are not a backtest. No accuracy improvement, ROI, model promotion or live trial is claimed.

## Game-by-game shots validation

The permitted game-level ZIP linked on MoneyPuck's data page is now supported:
`https://peter-tanner.com/moneypuck/downloads/seasonPlayersSummary/skaters/2025.zip`.

Run `npm run report:moneypuck-games -- 2025 2026-10-28 /absolute/private/2025.zip`. Python 3's standard library reads the ZIP without extracting files; Node runs the existing shots-v1 backtest. The reader requires one correctly named season CSV, bounds compressed/uncompressed size and row count, validates headers/row width and season, and retains only all-situations observations. The normalizer validates player/game identity, dates, regular-season IDs, teams, venue, integer shots and ice time. Positive-ice-time zero-shot games remain in the sample; zero-ice-time nonappearances are excluded. Conflicting copies of an appearance are excluded before counting. No raw download is committed or served.

The test uses the existing fixed model and the same smoothed empirical baseline at a preset 2.5-shot threshold. Each player needs 20 earlier appearances; fitting uses at most 40 strictly earlier-date games and evaluates the latest 40 eligible games per player. Target shots and target ice time never enter that target's fit. No threshold/model tuning was done against this report. Monthly groups, calibration bins and complete import audits are retained in `docs/research/moneypuck-shots-2025.json`.

The actual download had 236,060 situation rows, yielding 47,212 regular-season appearances for 940 players, including 12,837 zero-shot appearances. The paired evaluation produced 24,307 forecasts for 711 players across 127 dates. Model Brier was 0.15070938 versus baseline 0.15010326 (lower is better). The model was slightly worse on this aggregate metric; it is not evidence to promote a stronger model or claim an edge. The sample contains correlated players and dates; the number of forecasts is not the number of independent trials, and no significance claim is made.

Archive SHA-256: `358d4fe42277ddbd7489152cb0f0d1033abf2a9df305b77ac65a9cffeedb62d1`. The archive is a present-day retrospective download with unverified revision/publication timing. This is development evidence conditional on eventual recorded participation, not a prospective pregame roster-selection test. Missing/scratched games are not synthesized; historical odds, pregame injury/starter confirmation and betting returns remain unavailable. Existing production models, source gates and the paused prospective trial remain unchanged.

## Prior-date shots calibration challenger

Run `npm run report:shots-calibration -- 2025 2026-10-28 /absolute/private/2025.zip`. This research command generates **every** eligible chronological shots-v1 forecast after 20 prior appearances, rather than selecting each player's last 40 targets. This avoids selecting calibration history by later participation. The rolling model fit still uses at most 40 prior appearances. Its optional all-target mode is confined to offline tooling; existing reports retain their default latest-40 sampling, and production probabilities are unchanged.

The fixed logistic grid uses slopes 0.5, 0.75, 1, 1.25, 1.5 and biases -0.3, -0.15, 0, 0.15, 0.3. It fits once per target date by minimizing prior-date log loss over at most 5,000 earlier forecasts, with a minimum of 500 forecasts on 10 distinct dates. Identity wins numerical ties. Outcomes from the target date are added only after every forecast on that date is calibrated. The baseline is the same smoothed prior-40-game empirical over probability. All metrics compare identical post-warmup forecast rows; no parameters were selected using evaluation outcomes.

`docs/research/moneypuck-shots-calibration-2025.json` preserves the actual run. It contains 31,406 source forecasts, with 1,258 warmup exclusions, leaving 30,148 paired forecasts from November 28, 2025 through April 16, 2026. There were no invalid rows or ID conflicts. Brier (lower is better): original 0.15580814, calibrated 0.15512814, empirical baseline 0.15500675. Log loss: original 0.48097761, calibrated 0.47786826, baseline 0.47933310. Calibration improves the original model on both aggregate metrics, while the baseline still has slightly lower Brier.

The existing deterministic date-cluster bootstrap runs 2,000 replicates. The paired Brier-improvement interval against the original model is approximately +0.000215 to +0.001158. Against the empirical baseline it is -0.000858 to +0.000585, crossing zero. Monthly comparisons and five-bin calibration tables for all three models are included. These intervals describe this development archive, not all serial dependence, repeated tuning, future performance or profitability. The new population differs from the previous last-40 report; compare models only within the same report.

The challenger is research-only and unpromoted. This is a reused retrospective archive conditional on actual participation, with assumed prior-date outcome availability and unverified source publication/revision times. It does not establish pregame roster selection, real odds profitability, a prospective untouched holdout or a started trial. No paid data, source flag, schedule or live model was changed.
