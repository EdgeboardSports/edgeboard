# Fixed five-variant shots-model comparison — historical research

Automated run: https://github.com/EdgeboardSports/edgeboard/actions/runs/40800362168
Commit: `2aee39bf8ca24796e150ca5c9a680e247b48b8f5`
Date: 2026-10-28 US Eastern / 2026-10-29 UTC.
Source: MoneyPuck 2025–26 skater game-by-game ZIP, SHA in workflow artifact. No production changes.

## Protocol
- Shots over 2.5, existing original model and four predeclared variants.
- Development games before 2026-01-15: 5,063 predictions (55 dates).
- Later evaluation games from 2026-01-15: 19,244 predictions (72 dates).
- 711 players, 24,307 total forecasts, strictly prior-date player history.
- Winner chosen solely by lowest development-period Brier.
- IMPORTANT: This 2025–26 season was already examined in previous diagnostics. The later-period evaluation is chronological but **not an untouched holdout**. Do not claim independent validation or profitability.

## Results (Brier, lower is better)

| Variant | Development | Later evaluation |
| --- | ---: | ---: |
| Empirical baseline | 0.14654038 | 0.15104064 |
| Original shots-v1 | 0.14664397 | 0.15177896 |
| Half ice-time factor | 0.14616742 | 0.15133047 |
| Half venue factor | 0.14634704 | 0.15143741 |
| Half opponent factor | 0.14664624 | 0.15174827 |
| Simplified (no venue/opponent/ice-time multipliers) | **0.14568997** | **0.15075109** |

The development-selected **simplified** variant beat original shots-v1 by **0.00102787** Brier points in the later period; game-date cluster bootstrap 95% interval for original minus simplified: **[0.00056258, 0.00146798]**.

It beat the empirical baseline by **0.00028955** Brier points, but the corresponding game-date cluster bootstrap 95% interval **[-0.00039125, 0.00092396]** includes zero. The improvement over baseline is **not conclusive**.

## Interpretation / next gates

- Evidence suggests shots-v1's contextual multipliers are not helping this retrospective sample; simplification is promising relative to shots-v1.
- Do **not** promote simplified model yet. Confirm on genuinely independent later-season data, ideally 2026–27 as it accumulates, using archived pregame inputs and fixed settings; or another genuinely untouched historical season if available.
- Test richer opponent-wide shot suppression and power-play usage as separately specified, time-safe features, not arbitrary parameter search on the already inspected 2025–26 period.
- Historical sportsbook lines and prices are absent; **no EV, ROI, CLV, or betting edge has been demonstrated**.
- Research-only workflow generated JSON reports as short-retention GitHub Actions artifacts; repository is public, so do not upload raw licensed datasets or sensitive private research.
