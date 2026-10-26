# Private research security hold

The current code denies website and API access when private authentication is unconfigured. This is a temporary hold, not a finished Cloudflare Access setup or legal clearance.

## Completed in code

- Root Pages middleware covers all paths via _routes.json. Browser assets, pages and intended API paths require a signed Cloudflare Access application JWT matching the configured issuer, audience and exact owner email allowlist. Unsigned email headers do not authenticate anyone. Raw data, source, tests, docs and legacy Netlify function paths return 404.
- Each paid-provider handler also checks authentication. No configured shared D1 quota store means no provider call. Event requests must match an upcoming event recorded from authenticated provider discovery. Duplicate and unexpected parameters are rejected.
- Atomic SQL counters limit requests per verified account, reserve provider credits before outbound calls, enforce a per-period budget and daily cap, and preserve at least 100 credits from a verified seeded balance. Budgets are conservative: cache hits and failures can consume reservations; reservations are not refunded. Caps do not automatically reset against an assumed provider billing date. Other applications using the same provider key must be accounted for separately.
- Security response headers restrict framing, external connections and images, MIME sniffing, referrers and browser capabilities. CSP retains unsafe-inline for existing inline page scripts/styles; removing it requires a separate frontend refactor. This is not a strict nonce/hash-based CSP.
- Scheduled capture is paused. Both collector entry points also return before network access unless EDGEBOARD_COLLECTION_APPROVED=true. NHL/ESPN routes are held until explicit permission-review flags are enabled. Image/logo permissions remain unresolved; external images are blocked by the application CSP.
- The build:private packager prepares an explicit asset allowlist. It is not activated in Cloudflare until the project output directory is changed and verified.

## Required Cloudflare account setup (not completed)

1. Establish a successful authorized Cloudflare dashboard session. Google sign-in returned an error after device approval.
2. Protect production and ALL retained deployment/preview hostnames with Access, exact owner-email policy, no public bypass. Verify anonymous browser, API and old deployment URLs are denied. Configure Pages Runtime to Fail closed: Fail open can serve static assets when function allowance is exhausted.
3. Set ACCESS_TEAM_DOMAIN to the exact HTTPS team.cloudflareaccess.com issuer, ACCESS_AUD to the app audience, and ACCESS_ALLOWED_EMAILS to the owner account. Do not place account credentials or API key values in source.
4. Create/bind SECURITY_DB, apply docs/security-schema.sql, and seed provider_state only with a balance verified in the provider dashboard. Set ODDS_BUDGET_PERIOD to a manually reviewed accounting-period identifier in YYYY-MM-DD form. Default period cap is 50 credits (maximum 300); default daily cap is 12 (maximum 48). Choose lower caps if necessary. Configure provider/account billing protections separately.
5. Record data-feed and image rights before enabling ALLOW_NHL_FEED, ALLOW_ESPN_FEED or ALLOW_ODDS_FEED. Public endpoints are not permission. No provider permission has been granted by this change.
6. Run build:private, set the Pages build command and dist output directory, and verify that no development files are uploaded. The two intended data JSON files require working Access and Fail closed BEFORE this output is used.
7. Recheck anonymous access, owner sign-in, provider limits and data permissions before re-enabling collection. Service-account automation access has not been provisioned; do not bypass authentication for the old public workflow.

## Outstanding repository and legal items

The repository was still public when checked. Automatic approval review blocked opening its visibility-change workflow, stating that specific authorization for public-to-private had not been recognized. No visibility change was performed. Making it private does not recall existing downloads or copies. Older Cloudflare deployment URLs have not been secured or removed through the account dashboard.

Provider permissions and image/logo licenses require confirmation from the rights holders or an appropriate licensed replacement. No messages were sent to providers and no subscriptions were purchased. North Carolina legal scope was not cleared; this technical change is not a legal opinion.

## Validation

npm test includes real RSA signing/signature verification tests, wrong owner/audience/issuer/algorithm/expiry rejection, middleware/raw-file denial, no unauthenticated outbound paid-provider calls, and actual SQLite execution of shared quota SQL. Local mocked tests do not verify account settings, deployment routing, older hostnames or Cloudflare runtime Fail closed. Those must be verified separately.
