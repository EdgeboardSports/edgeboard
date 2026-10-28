# Unattended collection readiness

Collection remains paused. This procedure tests access; it does not start a schedule or approve data sources.

## Storage service access

1. Use Sites get_site with project_id `appgprj_6ae0acd669388191b7b30615f3e57a7c`. Confirm the current user is the owner and the Site remains owner-only. Stop on an audience mismatch. Reuse this project; do not create a replacement or change sharing.
2. Acquire the supported `siwc_bypass_bearer_token` from that response in memory. Never copy it into a task prompt, repository, browser, shell argument, file, or logs. If unavailable, stop rather than minting another credential.
3. Run `npm run preflight:unattended` with a JSON object containing `token` through protected stdin. The command posts synthetic evidence through the real adapter, verifies readback and duplicate detection, and then checks the separate Edgeboard API without transmitting the Sites token to it.
4. A storage success proves only this invocation's service access. A separate fresh cloud task has not been exercised. This workflow is not a running collector.

## Remaining operational dependencies

- Edgeboard's API still requires its own supported unattended authentication. Do not reuse a browser session, store the owner's password, turn off authentication, or send the Sites token to Edgeboard.
- Verify source permission flags and actual data access separately. Storage access grants no rights to upstream feeds.
- Provision durable private storage for frozen predictions and grades as well as context evidence; the public Git ledger must not receive private records.
- Verify bounded real capture and readback before enabling a schedule. No 30-day program starts merely because synthetic transport passes.

The preflight is hard-coded to the established origins, does not fetch odds or sports data, does not follow redirects, and prints no credential values. A failed storage write stops before even the read-only Edgeboard readiness request.

## Optional scoped Edgeboard service identity (disabled until configured)

Server configuration uses `EDGEBOARD_COLLECTOR_TOKEN_SHA256` (SHA-256 of a unique random 64-character lowercase hexadecimal token), `EDGEBOARD_COLLECTOR_NOT_BEFORE`, and `EDGEBOARD_COLLECTOR_EXPIRES_AT` (ISO timestamps, validity at most 31 days). No value was generated or installed by this code change. The collector host receives only its own `EDGEBOARD_COLLECTOR_TOKEN`; never reuse the owner's password, Odds API key, or Sites service token. The raw collector token must stay out of source and browser code.

Only listed GET data/diagnostic routes accept the service identity. Page access, balance initialization, unknown routes, browser Origin headers, wrong hashes and expired/not-yet-valid windows are denied. Existing feed flags, authentication and provider quota protections continue to apply. Removing the server hash or allowing the window to expire revokes service access. The server retains only a token hash. The collector sends the raw token only to the fixed Edgeboard production origin and refuses redirects.

Preflight stdin can optionally include a separate `collectorToken` alongside the Sites `token`. Each credential is sent only to its designated origin. The API must explicitly report a collector identity before the preflight reports authenticated access. Successful authentication still never enables collection, certifies source permissions or starts a schedule.

## Production service credential provisioned

The initial environment-only configuration requirement is superseded. The server can load a verification hash and validity dates from its server-only `lib/collector-configuration.js` module through normal GitHub deployment. This is verification material for a random 256-bit token, not the token itself. The raw token is stored only as the owner-private companion's `EDGEBOARD_COLLECTOR_TOKEN` runtime secret. The packaged verification window expires November 27, 2026 UTC. No password, Odds API key, or Sites service token was reused.

The server accepts this identity only on the exact production origin `https://edgeboard-8fl.pages.dev` and the listed GET API routes. Preview origins are denied. Explicit environment verification fields override the packaged configuration as a complete group; partial configuration fails closed. `EDGEBOARD_COLLECTOR_DISABLED=true` immediately disables the service path; removing or replacing the packaged hash via GitHub also revokes it. Existing feed flags and budget checks remain enforced.

The private companion's POST `/collector/api/source-readiness` uses the runtime secret server-side to read Edgeboard feed/budget diagnostics. It verifies the reported collector identity, persists a sanitized readiness audit in its private database, and returns no credential. It fetches neither odds nor sports data and leaves live collection paused. A future cloud task can invoke this owner-private endpoint using supported Sites service access, without retrieving the raw Edgeboard collector secret or reusing a browser session. Source authorization and real capture remain separate prerequisites.

## Thirty-day trial readiness command

`npm run preflight:trial -- YYYY-MM-DD` accepts a private Sites `token` through JSON stdin only. It checks the existing server-side source identity and budget, reads the live private ledger and closing-write status, and requests a verified live performance report for the proposed 30-day UTC window. It never fetches sports/odds data, follows redirects, activates writes or creates a schedule. The only POST records the existing sanitized readiness audit.

The output separates usable authentication/budget from held feeds, closing writes, and scheduler verification. A controlled real capture is always unverified by this read-only command; it cannot certify a trial start. Counts come from live namespaces only. Capture-day counts are not uptime or completeness measures: missed runs and days without eligible games need durable run records. The proposed start date is a reporting choice, not a persisted trial protocol. A bounded live capture, grade/readback, source authorization, enabled private writes and durable scheduled execution remain necessary before a prospective trial starts.

## Activation and credential-window audit — October 28, 2026

The protected feed diagnostic now returns the authenticated collector credential's expiry timestamp, never its value or verification hash. The private source-readiness audit retains this nonsecret timestamp. Live activation now requires expiry coverage through the fixed trial end; every subsequent collector run rechecks the remaining window before source requests. Expired, missing, malformed or too-short credentials fail closed. No key was rotated or extended during this audit: waiting until source access is approved avoids consuming the replacement key's bounded lifetime while idle.

The installed credential expires November 27, 2026 at 02:41:56.688 UTC. A sample window beginning October 29 at 00:00 UTC ends November 28 at 00:00 UTC, so the installed credential cannot cover it. The 31-day maximum service-credential validity remains unchanged. Final grading and the existing 14-day correction process can extend beyond the capture window and need continued credential management; covering 30 capture days does not promise 44 days of unattended access.

The native Site get_site result was checked and contained no linked schedules. The GitHub workflow remains manual and held. A plain TRIAL_SCHEDULE_VERIFIED flag is no longer enough for live activation. TRIAL_SCHEDULE_VERIFICATION must contain a fresh operator attestation copied from native schedule metadata (id, enabled state, timezone, iCal schedule), the frozen sourceCommit, verifiedAt within one minute and writerVerifiedAt within one hour. It must describe one UTC hourly check within the first 15 minutes of the hour, with no finite repeat count or skipped-day restriction. This is trusted operator evidence, not an independent backend query to the native scheduler. Verify the actual linked task and a fresh cloud-task writer/readback before configuring it; no attestation was installed.

Run `node scripts/activation-audit-report.mjs START_AT_UTC` with JSON containing the supported Sites service token and a fresh native get_site automations array through protected stdin. It records the existing private diagnostics audit, computes the exact 30-day end, expiry shortfall and native schedule gaps, and returns activationApproved=false. It never enables a task, mints credentials, starts a trial, fetches odds/sports data or sends messages. Missing native metadata is distinct from a confirmed empty schedule list. Its accepted schedule pattern is deliberately conservative: FREQ=HOURLY, interval one, one minute between 0 and 14, seconds zero, UTC; other patterns need explicit review.

## Prepared renewal procedure — October 28, 2026

See [collector-renewal.md](collector-renewal.md) for the paused verifier/secret handoff, receipt requirements, bounded coverage, and failure recovery. The tested in-memory state machine requires explicit production adapters; it does not call deployment or secret tools itself. No current credential was rotated or extended. Collection stays paused after even a successful credential check, pending independent activation prerequisites.
