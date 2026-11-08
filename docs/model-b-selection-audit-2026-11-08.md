# Model B selection audit — 2026-11-08

Tracking: #10. This is a diagnostic branch, not a production model change.

## Confirmed from repository review
- `docs/game-model.md` describes the older goals-v1 game market lab, with qualification heuristics: 100 historical tests, Brier no worse than baseline, modeled positive value under goal-rate/OT-share perturbations, quote age <=15 min, upcoming verified game and archive freshness <=48h.
- These documented rules are **not evidence** that the live Model B implementation applies them. Do not attribute the zero-pick behavior to these gates without tracing the active selection path.
- `scripts/model-scorecard.mjs` is a retrospective validation renderer, not a Model B nightly pick engine. Its goalie challenger card explicitly says there is no verified paired pregame goalie-quality sample.
- The repository README and parts of `docs/paper-testing.md` describe historical collection/security holds. These notes may be stale relative to November live activation; verify runtime state separately. Do not change authentication, collection flags, quotas or records as part of this audit.

## Required tracing before any fix
1. Identify live Model B entrypoint and deployment commit, and compare it to repository main.
2. For each November 4–8 slate, record all games evaluated, every candidate's market, offered price, modeled probability/edge, context inputs, rank, and rejection reasons. Do not invent historical ranks where no frozen data exists.
3. Classify each condition as mandatory safety/validity check, optional contextual adjustment, or value threshold. Unknown goalie, injury or referee information must not automatically become a no-bet gate unless explicitly part of the approved protocol.
4. If optional factors were inadvertently mandatory, fix on this branch with offline tests; compare before/after decisions on identical frozen inputs. Keep no-bet outcomes when edge is genuinely inadequate.
5. Publish research-only top candidates separately from official picks, preserving the two-per-day official cap and the immutable 30-day test ledger. Version any subsequent production change.

## Status
Initial documentation review completed; live Model B entrypoint and no-pick root cause remain unverified. No model behavior, production deployment, or historical selection has been modified.
