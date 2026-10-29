# MoneyPuck historical backtest — execution gate (2026-10-28)

## Status

**NOT RUN on real historical observations.** Do not report model Brier, ROI, profitability, live coverage, or actual feed freshness until a real source archive has been processed. No production feed, subscription, collector or permission flag was changed.

### Verified in repository

- `scripts/moneypuck-game-rows.py` validates one bounded `YYYY.csv` inside a skater season ZIP; requires game ID, game date, player/team/opponent, home/away, ice time, shots; in points mode also goals and assists.
- `scripts/moneypuck-backtest.mjs` normalizes per-game observations, preserves zero-shot games, rejects conflicts and future leakage, and compares the existing shots-v1 model with an empirical baseline.
- `scripts/points-backtest.mjs` reuses the same game-row parser and compares count-model alternatives for 0.5 points with date-cluster robustness intervals.
- `tests/moneypuck-zip.test.py` and `tests/moneypuck-backtest.test.mjs` exercise synthetic fixtures. These tests **are not** a real-data evaluation.
- Official MoneyPuck data page explicitly allows noncommercial use with credit; other uses require inquiry, and unapproved scraping of data not listed there is prohibited: https://www.moneypuck.com/data.htm . Commercial reuse remains unapproved.

### Blockers in this execution

- The execution environment could read the connected GitHub repository but could not fetch a historical MoneyPuck ZIP for a real-data run. The exact archive format and model results on actual historical rows therefore remain unverified.
- The repository's current `docs/security-status.md` also holds all live feed activation pending permissions and private-access verification. A one-off permitted offline historical evaluation must not remove these holds.

## Next authorized offline run

Use a *completed season* MoneyPuck skater ZIP from its listed downloads, after verifying its actual license fit. Do **not** commit the archive or personal credentials to the public repository. Run from the repository root in a local or permitted isolated environment:

```sh
# The ZIP must contain exactly one CSV named 2024.csv, and its rows must be season 2024.
python3 scripts/moneypuck-game-rows.py /path/to/2024.zip 2024 > /tmp/edgeboard-2024-schema.json
node scripts/moneypuck-backtest.mjs 2024 2025-07-01 /path/to/2024.zip > /tmp/edgeboard-2024-shots.json
node scripts/points-backtest.mjs 2024 2025-07-01 /path/to/2024.zip > /tmp/edgeboard-2024-points.json
```

If the provider's published ZIP structure differs, **inspect and adapt the parser only after confirming the schema**, rather than silently treating a parser failure as missing model data.

Record: archive URL and SHA-256; retrieval timestamp; rows by situation; unique players and games; duplicate/conflict exclusions; missing required columns; sample size; monthly Brier/log-loss vs the appropriate baselines; calibration and bootstrap intervals; last observed game date; and missing pregame lineup/starter/odds evidence. Historical publication times are not established by downloading today.

**Success criteria:** source schema passes, enough historical games survive validation, training dates strictly precede targets, results are reproducible, and model versus baseline results are reported with caveats. Do not promote a model or claim a betting edge from retrospective Brier alone.

## Phase 2 implications

MoneyPuck is the leading historical research candidate, **not** a replacement for verified pregame goalie confirmations, injury/scratch feeds or historical book quotes. Those are separate provider-selection decisions.
