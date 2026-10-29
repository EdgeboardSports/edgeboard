# Historical odds evidence and research view (research-only)

The current historical odds work adds:
- `scripts/historical-evidence-ledger.mjs`: an append-only, SHA-256 chained **in-memory reference ledger** of prediction, quote, and settlement evidence. The chain detects mutation, deletion, reordering and mismatch when checked against a trusted stored head. It does **not** prove an observation happened at the stated time.
- `scripts/historical-research-view.mjs`: a responsive, offline HTML performance view grouped by market, bookmaker and estimated EV tier.
- `scripts/historical-research-fixture.mjs`: generates fabricated data and a static example view, labeled SYNTHETIC.
- `tests/historical-evidence-ledger.test.mjs`: exercises provenance, duplicate prediction IDs, settlement correction chronology, as-of reporting, mutation detection, and view generation.
- `.github/workflows/historical-evidence-audit.yml`: CI test plus short-lived artifact containing **synthetic data only**.

**Not connected to the live website, Cloudflare, any sportsbook, or a durable backend.** No real provider data is acquired, stored, committed, or shared. No production model is changed.

## Security and audit requirements before real collection

1. Receive written source authorization for historical sportsbook odds; record the license scope and retention requirements. Do not commit licensed data or API keys to this public repository.
2. Connect the reference event schema to an access-controlled, encrypted **durable** private store; enforce server-side authenticated append-only writes and readback verification. Reuse existing private prediction-ledger infrastructure only after schema compatibility and permissions are reviewed.
3. Independently record trusted **server receipt times** and source-provided quote times. A local hash chain does not prove that a claimed past quote or prediction actually existed then.
4. Anchor the hash-chain head in independently protected storage, verify continuity across process restarts, and prevent truncation/rollback. In-memory reference data disappears on process exit.
5. Define settlement corrections, player DNP and market-specific grading (including three-way and overtime rules) against authoritative sources; never rewrite prior evidence.
6. Require a pre-registered prospective evaluation with real contemporaneous quotes before interpreting paper EV/ROI as evidence. A positive synthetic ROI means nothing.

## Reading the view

The output is an **offline, downloadable synthetic HTML artifact** from the CI run, not a live authenticated website feature. Metrics include matched quotes, paper settlements, win rate, average estimated EV, hypothetical ROI, coverage exclusions, and market/book/edge breakdowns. It is designed to show missing evidence explicitly rather than inventing returns.

No user action, cost, or Cloudflare login is required for the synthetic research test.
