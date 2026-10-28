# Full-sample game-model robustness research

This extends the saved latest-100 test to every eligible game in the existing local archive, without new downloads or live source calls. No subscription, source permission, collection flag, model formula or version changes. The scorecard uses the new aggregate report; the older latest-100 report remains preserved.

From 1,496 archived games, 329 lack the minimum prior team history. Each of the four markets has the same 1,167 evaluated games, November 20, 2025 through October 25, 2026, on 151 dates. Training is strictly prior-date, preserving goals-v1's existing 20-game minimum and rolling 40-game team rates. It carries prior-season history just as the existing model does; roster changes and season shifts are not independently controlled.

| Market | Model Brier | Equal-strength baseline |
| --- | ---: | ---: |
| Home moneyline | 0.245989 | 0.250000 |
| Regulation three-way | 0.324309 | 0.329136 |
| Home -1.5 puck line | 0.208851 | 0.215966 |
| Over 6.5 total | 0.249628 | 0.255994 |

Lower is better within each row. Three-way uses half multiclass squared error and should not be compared directly with binary magnitudes. The fixed spread and total are illustrative thresholds, not reconstructed historical sportsbook lines. The baseline is equal-strength teams, not a market forecast.

Two thousand deterministic whole-date bootstrap replicates retain every game on each sampled date. Baseline-minus-model Brier improvement intervals are approximately +0.000271 to +0.007701 (moneyline), +0.001930 to +0.007706 (three-way), +0.003945 to +0.010226 (spread), and +0.002922 to +0.009820 (total). Log-loss improvement intervals are also positive in this saved sample. The four unadjusted intervals are descriptive and have no multiple-comparison correction. They do not account for all cross-date/team dependence, model tuning, or historical revision uncertainty.

The report includes monthly paired Brier/log loss, probability calibration bins, source-file SHA-256 and invalid/duplicate/conflict/cutoff/history audits. Three-way calibration contains three class entries per game (3,501 entries); binary calibration contains one win-outcome entry per game. No blank grade or absent event is invented. Conflicting/invalid game groups are excluded before training as well as evaluation. Correct official-final conventions are shared with the production grader.

These are reused retrospective development data. Actual outcome publication times are absent; availability is assumed by next game date. No verified pregame goalie/injury/lineup history, historical prices, EV, ROI or prospective results have been added. This supports further testing, not model promotion or a profitability claim.

Reproduce using the repository's existing archive:

```
node scripts/game-robustness.mjs 2026-10-28
npm run report:scorecard
```

Save only the aggregate JSON to docs/research/game-robustness-2026-10-28.json before regenerating the scorecard. Tests cover legacy score parity on matched samples, prior-date/target isolation, deterministic date resampling, monthly/calibration counts, duplicate/conflict audit, invalid final/date/identity inputs, cutoffs and empty evidence. Full suite and production build pass. Expanded monthly tables were inspected in Chrome frames at 320/390/430 pixels (305/375/415 content pixels), without page overflow. Physical iPhone/Safari and live validation remain separate.
