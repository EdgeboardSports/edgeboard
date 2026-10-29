# Edgeboard historical odds evaluation — research-only contract

## Current status
A standalone odds evaluator and deterministic synthetic audit are implemented.
No historical sportsbook quotes have been obtained or licensed. **No real EV, ROI, CLV or betting performance is established.**
No live odds collection, sportsbook access, authentication changes, wagers, or production model changes.

Files:
- `scripts/historical-odds-evaluator.mjs` — pure evaluation functions.
- `tests/historical-odds-evaluator.test.mjs` — timestamp, price, math, provenance and settlement audit.
- `scripts/historical-odds-demo.mjs` — fabricated example report, always labeled synthetic.
- `.github/workflows/historical-odds-audit.yml` — on-demand and push-triggered synthetic CI.

## Authorized historical source contract
Before using real data, obtain explicit written permission covering retention, storage, derived research, and any sharing. In `licensed-historical` mode, each quote must have:
- Exact event ID, market, selection side, optional player/subject ID, and **line**.
- Bookmaker ID, decimal odds > 1, quote **observedAt** timestamp, and source/license reference.
- Timestamp genuinely captured before the prediction timestamp and game start. No backfilled closing odds or reconstructed prices.
- Predictions must include ID, exact market identity, probability 0..1, `predictedAt`, `startTime`, and audited result: win, loss, push, void, or pending.
- Prediction timestamp must precede start time. Quotes older than 60 minutes at prediction time are excluded.
- All quote and outcome data are input-only; this module does not fetch or persist provider data.

## Math and reporting
- American odds to decimal: positive +A => 1+A/100; negative -A => 1+100/A.
- Implied probability = 1 / decimal.
- Two-sided no-vig probabilities = normalized implied probabilities of both sides, **same book and exact line**. Informational only, not applicable to 3-way markets.
- Estimated EV per one-unit stake = p*(decimal-1) - (1-p).
- Descriptive paper profit: win decimal-1, loss -1, push 0, void/pending excluded.
- Paper ROI = sum paper profit / number of settled one-unit predictions; null when none settled.
- Report breakdowns by market, bookmaker, and estimated-EV tier. Unmatched/invalid/stale quote coverage is explicit.
- Highest available decimal at the prediction timestamp is used across books unless a fixed-book policy is selected; no hindsight line shopping.
- Results are **hypothetical paper results**, not realized returns. Even licensed-historical backtests can suffer selection, liquidity, limit, line availability, lineup, grading and data-survivorship bias.

## Next engineering gates
1. Review/approve a legitimate licensed historical quote source and source-use restrictions.
2. Create a private, immutable, timestamped quote/prediction ledger; ensure quote and model forecast existed at the claimed time.
3. Validate market identity, push/void rules, settlement corrections, and independent data provenance end to end.
4. Run prospective, pre-registered evaluation on new games; report sample size, calibration, uncertainty, CLV and simulated ROI without making profitability claims prematurely.
5. Keep real licensed source files and sensitive records **out of the public GitHub repository**.
