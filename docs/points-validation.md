# Points challenger: retrospective research

Historical research data: MoneyPuck.com — https://moneypuck.com/data.htm. The listed noncommercial data-download terms were checked October 28, 2026; raw rows remain outside the repository. Commercial/shared use requires a new rights review. No live source authorization or recommendation deployment is implied.

The 2025-season skater game archive SHA-256 is 358d4fe42277ddbd7489152cb0f0d1033abf2a9df305b77ac65a9cffeedb62d1, matching the prior shots research archive. It contains 47,212 all-situation appearances for 940 players, with 30,810 zero-point appearances retained. Points must equal goals plus primary and secondary assists; goals cannot exceed shots. Blank counts are not converted to zero. Duplicate/conflicting appearances are audited. The existing bounded ZIP reader now has an explicit points mode requiring those columns; default shots imports retain their behavior.

The fixed 0.5-point threshold produced 31,406 paired forecasts for 711 players on 127 dates, November 17, 2025 through April 16, 2026. Each target uses strictly earlier dates and the existing count-challenger-v2 Poisson/NB implementation, with a minimum of 20 and a maximum of 82 prior games. The empirical comparator uses the same eligible targets and prior window. Same-date outcomes cannot enter the fit. No parameters were retuned using these results.

| Forecast | Brier | Log loss |
| --- | ---: | ---: |
| Poisson challenger | 0.210334 | 0.611478 |
| Negative-binomial challenger | 0.210353 | 0.611630 |
| Smoothed empirical baseline | 0.210960 | 0.611797 |

Lower is better. Whole game-date bootstrap resampling (2,000 deterministic replicates) gives a baseline-minus-model Brier interval of approximately +0.000146 to +0.001113 for Poisson, and +0.000130 to +0.001088 for NB. Both log-loss improvement intervals include zero. These describe this retrospective archive; they do not establish prospective calibration, sportsbook outperformance or profitability. Calibration bins and monthly slices are in the aggregate JSON report. No challenger is promoted.

This is conditional on recorded positive-ice-time appearances, not verified pregame roster selection. Historical publication/revision times are absent; final outcomes are assumed available by the next game date. Repeated players/teams and model selection introduce dependencies not fully represented by date resampling. There are no historical sportsbook quotes, EV/ROI results, reconstructed injury/lineup inputs or live trial results.

Reproduce from the listed local ZIP without fetching new data:

```
node scripts/points-backtest.mjs 2025 2026-10-28 /path/to/2025.zip
npm run report:scorecard
```

Save only the aggregate report to docs/research/moneypuck-points-2025.json before rebuilding the scorecard. Do not commit the ZIP, raw CSV, player-level predictions or private records. Tests cover point components, zero retention, target and same-day isolation, matching baseline coverage, deterministic ordering/bootstrap, duplicate/conflict exclusion, cutoff boundaries and insufficient evidence. Main tests and production build passed; production model formulas and source gates are unchanged.
