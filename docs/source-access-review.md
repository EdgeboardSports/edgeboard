# Source-access review — October 28, 2026

The remaining production holds are runtime source settings, not missing collector authentication. The private readiness endpoint verified the collector identity, working storage and protected quota. No feed flag was enabled during this review.

## The Odds API

Reviewed https://the-odds-api.com/terms-and-conditions.html (updated August 31, 2026). Its restrictions section permits analytical dashboards, research, retention and derived statistics; it prohibits standalone raw-data redistribution. Edgeboard's owner-private analytical use appears consistent with those listed uses. This is a source-use assessment, not a comprehensive legal clearance. Existing API key secrecy, private authentication, request reservations, 100-credit reserve and daily/period caps must stay enforced. The runtime ALLOW_ODDS_FEED flag remains required; this review does not silently override an operator setting. Do not add a paid plan.

## NHL and ESPN

Reviewed NHL terms at https://www.nhl.com/info/terms-of-service and ESPN's linked Disney terms at https://disneytermsofuse.com/english/. They restrict unauthorized automated access. No applicable project-specific permission or alternative license was found in the repository. Public endpoint availability alone does not establish permission. NHL statistics/history and ESPN injury/starter automation remain unverified. This review sent no messages, purchased no access and did not enable either feed.

## Independent dependencies

The middleware previously required both NHL and ESPN flags on every non-odds NHL API route. It now requires only NHL for schedule, roster, player search/profile/leaders and game logs. Team/game research routes use both sources and retain both gates; unknown NHL routes conservatively retain both. Odds routes retain their own existing authenticated provider authorization and shared-budget checks.

Feed diagnostics now expose each source's runtime state, configuration flag name and terms URL, plus schedule, grading, player-history, research, odds and automatic-capture capabilities. These booleans describe configuration, not rights certification, successful upstream responses, a running schedule or a started trial. The legacy aggregate schedule field is retained for collector compatibility and still requires both NHL and ESPN.

A real prediction capture still cannot be verified while the NHL source is held. Clear the applicable source authorization and runtime settings, then verify a bounded pregame capture, private persistence and subsequent grade before scheduling. No synthetic observation is substituted for live evidence.
