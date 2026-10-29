# Odds research evidence ledger and synthetic dashboard

Verified GitHub Actions run: https://github.com/EdgeboardSports/edgeboard/actions/runs/40802115678

## Implemented
- `scripts/historical-odds-ledger.mjs`: pure append-only SHA-256 chained research events (prediction, quote, settlement), full-chain verification, and as-of reconstruction.
- Quote event must be recorded before the prediction timestamp; quote observation must also be before the prediction, with maximum one-hour quote age enforced by the evaluator.
- Explicit synthetic or licensed-historical provenance; existing odds evaluator supplies EV, implied probability, no-vig comparison, market/bookmaker/estimated-edge-tier grouping and flat-stake paper results.
- `scripts/historical-odds-dashboard.mjs`: standalone mobile-friendly HTML report from synthetic fixture data. **Intentionally refuses real-data reports**. Not copied into Cloudflare Pages `dist` or production.
- `tests/historical-odds-ledger-dashboard.test.mjs`: tests tampering, time cutoffs, late quote receipt rejection, settlement as-of, and synthetic-only HTML output.
- CI generates an HTML dashboard and JSON synthetic report as short-retention GitHub Actions artifacts.

## Not implemented / security gate
- This is an **in-memory research event model**, not a deployed private persistent store. A cryptographic chain alone does not authenticate capture timestamps or make storage secure or immutable. Real ledger storage needs private authenticated append-only persistence, server-side receipt timestamps, backup, trusted externally anchored chain heads, and explicit approved source rights.
- Existing private hosted prediction ledger must not be bypassed or replaced without verifying its access and integrity controls. No new live endpoint, provider connection, credentials, production changes, or automatic wagers were enabled.
- GitHub repo and Actions artifacts are public. **Only fabricated data belongs in these artifacts**. Never upload licensed raw odds, real private picks, secrets, or personal records.
- No real historical sportsbook quotes or independent betting-performance evidence exist in this new workflow. Synthetic ROI is demonstration math, not earnings or proof of edge.

## Next
1. Review private hosted ledger authorization and storage guarantees, then design an authenticated, server-timestamped odds evidence extension with explicit user approval for access/storage changes.
2. Obtain legally authorized historical odds and evaluate them using immutable as-of pregame captures.
3. Build a private authenticated UI on top of the existing Access-protected website, after security checks. Do not deploy the synthetic report publicly as real performance.
