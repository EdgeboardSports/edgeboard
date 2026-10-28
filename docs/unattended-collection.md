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
