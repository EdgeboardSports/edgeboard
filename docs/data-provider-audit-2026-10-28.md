# NHL data-provider fit audit — 2026-10-28

Status: **read-only source and repository review; no production data access, purchases, feed activation, or live provider calls**. This document is a decision record, not permission to use third-party data commercially or proof of predictive accuracy.

## What Edgeboard already implements (do not duplicate)

- `scripts/moneypuck-import.mjs`: MoneyPuck season-summary skater/goalie normalization and prior-season research safeguards.
- `scripts/moneypuck-backtest.mjs` and `scripts/moneypuck-game-rows.py`: MoneyPuck game-by-game skater archive decoding and chronological shots backtests; `normalizeGameRows` also supports points.
- `scripts/points-backtest.mjs`, `scripts/shots-calibration-report.mjs`, `scripts/game-robustness.mjs`: further offline research/evaluation entry points.
- `docs/shots-model.md`, `docs/game-model.md`: existing experimental shots and match models.
- `docs/game-day-research.md`: team rest, shots against, role/ice-time checks, injury/status research; no confirmed starter/lineup feed.
- `docs/security-status.md`: production access and feed permission holds; collection is paused.

These are implementation claims, **not** proof that live sources are configured, licensed, reachable, or predictive.

## Phase 1 and Phase 2 needs versus source fit

| Need | Current capability / gap | Candidate source and limitation |
| --- | --- | --- |
| Historical skater shots, points, TOI | Game-by-game MoneyPuck import/backtests already exist; check completeness and chronology on actual permitted archive | MoneyPuck game-by-game CSVs; no duplicate importer |
| Historical goalie, expected goals, line/pairing context | Season goalie summary exists; game-level goalie and line/pairing model features not yet proven end-to-end | MoneyPuck published game-level skaters/goalies/lines and shot ZIPs; inspect data dictionary and validate schema before adding |
| Live pregame starting goalie, scratches, confirmed lineups | No confirmed starter/lineup feed connected; historical as-of evidence also missing | Compare licensed feeds or official announcements; MySportsFeeds DETAILS may offer lineups but does **not** automatically guarantee confirmed starters or historical publication timestamps |
| Injuries and availability | ESPN injury/status research implemented with freshness and matching checks; permissions remain unresolved | Confirm source rights and reliability; alternative licensed injury/lineup source may be required |
| Team/game schedules and completed results | NHL endpoints used in code; permissions review flags currently block collection | Existing NHL-derived workflow; no need to duplicate without a reliability or licensing reason |
| Historical sportsbook odds, line movement, closing-line value | Historical odds unavailable for ROI validation; model Brier scores are not profitability | PuckAPI advertises odds history and line movement; check coverage by bookmaker, timestamp precision, limits and legal terms; MySportsFeeds ODDS separate addon |
| Current multi-book quotes and player props | Existing The Odds API integration with quota controls, currently held | Preserve existing provider unless a measured coverage/cost gap is found |
| Opponent effects, rest/travel, goalie-quality and matchup challenger | Existing exploratory features and offline challenger, not validated or promoted | MoneyPuck advanced data may support historical covariates; need point-in-time, strictly pregame joins |
| Other sports later | NHL-only feeds cannot cover NFL/CFB/PGA | Modular source adapters; MySportsFeeds supports multiple leagues but is not a single answer for PGA |

## Provider assessment (as advertised; not live-tested)

1. **MoneyPuck** — first choice for free historical NHL research. Official downloads include game-by-game skaters, goalies, lines and shot files. Site permits free noncommercial use with attribution and requests contact for other uses; do not scrape unlisted pages. The data page's update stamps are inconsistent across sections and must be checked per downloaded archive before asserting live freshness. https://www.moneypuck.com/data.htm
2. **PuckAPI** — candidate for missing historical odds/line movement and documented hockey endpoints. Provider advertises free credits and paid plans, but its homepage and pricing page currently disagree on exact free-credit/endpoint conditions; confirm in account or with provider. Its own description says statistics refresh daily and odds hourly, so not suitable as a confirmed minute-by-minute starting-lineup feed. NHL-only. https://puckapi.com/pricing
3. **MySportsFeeds** — candidate for dependable packaged stats, injuries and lineups and expansion to other major leagues. CORE alone is insufficient for player game logs: STATS is separate; DETAILS includes lineups; ODDS is another add-on. Starting advertised NHL CORE commercial price CAD 25/mo (non-live), but combined STATS/DETAILS, realtime tier, historic seasons and commercial rights require a written quote. https://www.mysportsfeeds.com/feed-pricing/
4. **Existing The Odds API** — preserve for quotes unless coverage/latency/terms comparison demonstrates a better choice. Review provider rights and actual account quota before re-enabling.

## Next controlled experiment — no provider activation yet

1. Confirm permission for the intended private research, automated downloading, storage, display, and potential commercial evolution with MoneyPuck (published downloads and attribution terms are not blanket commercial rights).
2. On an approved **offline** sample of a completed historical season, run existing MoneyPuck game-row parser and shots/points backtests. Record exact source URL, SHA-256, retrieved time, schema, row counts, excluded duplicates, missing fields, chronological test coverage, and Brier versus baseline. No historical publication-time claim without archived evidence.
3. Inspect the game-level goalie/line files and shot data dictionary for required Phase 2 fields (game ID/date, goalie ID, team/opponent, situations, TOI, PP time, xG, attempts, line combinations). Add **only missing** normalization/validation.
4. Build a gap matrix for starting goalie confirmation, scratches, injuries, live latency, historical odds by bookmaker and point-in-time timestamps. Request targeted quotes only for unsatisfied requirements.
5. Keep production collection paused, no purchases, no secret exposure, no change to Cloudflare configuration, and no model promotion without out-of-sample validation.

## Decision

**Provisional:** MoneyPuck for historical NHL modeling; retain current odds architecture; evaluate PuckAPI for archived odds and MySportsFeeds/other licensed feeds for confirmed game-day context. Do **not** buy CORE + STATS until an actual feature gap, full quote and license fit are established. This is a fit assessment, not a final vendor award.
