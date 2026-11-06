# Edgeboard pull-report contract (proposed; not yet wired into production)

Purpose: make each scheduled NHL paper-test pull independently auditable and easy to discuss in regular ChatGPT voice conversations, without relying on Work-session history.

## Required output for every run
Persist an immutable, timestamped JSON report in a **private authenticated store** (not a public Pages asset or public repository). Include:
- run_id, scheduled_at_utc, started_at_utc, completed_at_utc, Eastern display time, code/model versions, source timestamps, execution status.
- full NHL slate discovered for that date, including games with no selection; event IDs, puck-drop times and sources.
- for each game, Model A and Model B independently: evaluated/not evaluated, model win probability, available book/market/odds, implied probability, estimated edge, confidence/thresholds, goalie and injury evidence and freshness, referee evidence if used, and plain-language pick/no-pick rationale.
- if data is missing or contradictory, describe the attempted alternate sources, resolution, confidence and remaining limitations; never silently classify an unevaluated game as a legitimate no-bet.
- selected paper bets (0–2 per policy), timestamped price, stake and ledger reference; distinguish experimental Model B shadow opinions from official Model A picks.
- counts: scheduled, evaluated, unevaluated, selected, rejected for insufficient edge, rejected for other reasons; consistency checks and provider usage.
- explicit no-selection summary: list each game and its specific reason; never replace with a generic 'no value' explanation.

## Publication and access
- Write atomically under a private path keyed by date and run ID; expose authenticated read-only latest/date endpoints and a concise mobile-readable summary.
- Keep tokens, provider keys, personal data, and private betting records out of publicly deployed static files, public logs and unauthenticated endpoints.
- Make the report accessible to an assistant through an authorized connected source or a user-shared link/file. A Cloudflare-only authenticated UI does **not** automatically grant this chat access.
- Add a pointer to the most recent report in the private app; preserve previous runs for audits and comparison.
- Failure to publish the report is an operational error with a distinct alert; do not claim 'zero selections' as a successful evaluation in that case.

## Acceptance tests
1. Complete slate, zero picks: each game has both model verdicts and specific no-pick rationale.
2. Partial feed failure: every game remains accounted for; status distinguishes failed evaluation from no edge.
3. Late goalie/odds update: follow-up run has its own timestamp and references earlier run without overwriting it.
4. Private access: anonymous requests denied; authorized report retrieval works.
5. Regular chat can actually retrieve a report via an available authorized connector or supplied artifact, without launching Work. Verify end to end before claiming completion.

## Implementation boundary
This file is a specification only. It does not enable collection, alter model thresholds, deploy a new endpoint, or prove a 4 PM run occurred. Confirm actual live production architecture and authentication before implementation.
