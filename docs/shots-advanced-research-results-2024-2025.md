# Advanced shots feature trial — verified historical results

Run: https://github.com/EdgeboardSports/edgeboard/actions/runs/40801257140
Research only. No production model, paid provider, authentication, or collection changes.

## Predeclared variants
- Simplified shots count model: rolling last-40, mean half full and half last-10, original fixed dispersion, no venue/opponent-history/TOI multipliers.
- Opponent defense: team's *prior-date* skater shots allowed, 10-game recent average vs league prior mean, n/(n+20) shrink, +/-10% cap. Skater shot totals are a proxy for opponent shots allowed.
- Power play: player's *prior-date* 5on4 TOI last-10 vs last-40, fixed coefficient 0.2, +/-10% cap.
- Combined: opponent defense x power play.
- Historical empirical baseline.
- Over 2.5 shots, all comparisons on recorded player appearances, not pregame roster selection.

## 2024–25 (first season developed for these features)
- 23,956 predictions total; 3,706 before 2025-01-15; 20,250 on/after.
- Development selected opponent-defense variant (Brier 0.13917087 vs simplified 0.13946697).
- Later-period Brier:
  - empirical baseline: 0.15565479
  - simplified: 0.15521102
  - opponent defense: **0.15495624**
  - power play: 0.15532188
  - combined: 0.15506465
- Simplified minus opponent-defense Brier: **0.00025478**.
- Descriptive game-date bootstrap 95% interval: **[0.00007669, 0.00042003]**.
- These are same-season chronological periods, not independent season-level validation.

## 2025–26 (retrospective replication, previously inspected)
- 24,307 predictions total; 5,063 before 2026-01-15; 19,244 on/after.
- Development again selected opponent defense.
- Later-period Brier:
  - empirical baseline: 0.15104064
  - simplified: 0.15075109
  - opponent defense: **0.15046744**
  - power play: 0.15090313
  - combined: 0.15061881
- Simplified minus opponent-defense Brier: **0.00028365**.
- Descriptive game-date bootstrap 95% interval: **[0.00011118, 0.00045793]**.
- **2025–26 was inspected during earlier experiments, so this is not an untouched holdout**. Do not call this prospective or independent validation.

## Interpretation and limits
- Opponent-wide defense is a more promising candidate than prior player-vs-opponent adjustments, with small retrospective Brier improvements in both seasons.
- The fixed power-play feature made results worse in both later periods; do not promote it.
- Team shots allowed are reconstructed from MoneyPuck player all-situation shot totals. This requires team/game completeness checks before operational use.
- No historical point-in-time data publication verification, lineup availability, historical sportsbook odds, ROI, CLV, EV, or betting profitability validation.
- Next gate: freeze candidate specification, validate against 2026–27 archived *pregame* data and quoted lines, assess missing lineup/PP info, calibrate, and compare against empirical baseline with uncertainty. Do not promote based solely on these retrospective results.
