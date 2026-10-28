# Saved model validation scorecard

Performance now displays nine research cards, compiled into the authenticated paper page. The cards separate production shots, shots calibration, moneyline calibration, four game markets, goalie quality, and experimental points. No provider requests are made by this section and no model is promoted.

Each available comparison retains its own paired sample, date range, named comparator, Brier scores, publication/coverage limitations, and calibration bins when supplied. A missing interval is not proof of a significant improvement. A positive interval would still be retrospective development evidence only. Player forecast counts are not independent game counts. Three-way and binary Brier values are not directly comparable. No real prospective trial has completed.

Inputs are aggregate research reports in docs/research: moneypuck-shots-2025.json, moneypuck-shots-calibration-2025.json, moneyline-calibration-2026-10-28.json, game-robustness-2026-10-28.json, and moneypuck-points-2025.json. The latter two were regenerated locally from the existing saved game archive:

```
node scripts/calibration-report.mjs 2026-10-28
node scripts/game-robustness.mjs 2026-10-28
npm run report:scorecard
```

The generator uses only explicitly selected aggregate fields; raw provider data, private ledgers and credentials are not copied into it. Refresh reports and regenerate the section together; the parity test detects a stale saved section. Research cutoff is displayed and does not claim freshness beyond the archive. The goalie card marks missing saved validation rather than assigning a synthetic accuracy score.

Tests verify paired sample and bin counts, exact saved source scores, conservative classifications, missing evidence, escaping, immutable inputs, and generated-page parity. The existing production build preserves authentication and packages the page without new public routes.

The points card now uses the paired 2025-season research report (31,406 forecasts), replacing its former missing-evidence label. The Brier advantage is retrospective only; the log-loss interval includes zero. No production promotion follows.

The four goals-v1 market cards now use the full eligible saved sample rather than the prior latest-100 report: 1,167 games per market, paired date-bootstrap intervals, calibration and expandable monthly comparisons. Three-way calibration counts three outcome-class entries per game and is labelled accordingly. The older latest-100 report remains an archived comparison, not the current card input.
