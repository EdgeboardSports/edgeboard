# Deployment refresh notes

## November 4, 2026 — production odds configuration

The owner saved production ALLOW_ODDS_FEED=true in Cloudflare. This documentation-only commit requests a fresh main-branch deployment through the existing GitHub integration so the runtime receives that setting. Confirm the Cloudflare check on this exact commit, then query authenticated production diagnostics. Saving the setting or deploying does not establish live data success or activate the official paper trial. Authentication, provider quotas and other feed holds remain unchanged.

## October 25, 2026 — historical preview refresh

An earlier documentation-only commit requested a preview deployment after the provider API key was saved. No secret value is stored in this file.

## November 4 — PuckAPI connection

The owner saved PUCKAPI_API_KEY as an encrypted production secret. This deployment adds a private, quota-bounded recent-game probe and applies the setting. A successful response is cached for the UTC date; at most two explicit five-credit attempts per date and 200 credits in a fixed activation window are permitted. Failures remain reserved. No subscriptions, purchases, source hold changes or automatic retries. Missing source timezones and period metadata remain unknown. Connectivity is not model/trial activation.
