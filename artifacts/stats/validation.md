# `/stats` verification

Checked on 2026-09-12.

## Initial dashboard implementation

| Check | Result |
| --- | --- |
| TypeScript: browser, Node and Cloudflare | Passed |
| Node API, persistence, notification and transcript tests | 23 passed |
| Cloudflare API tests in workerd | 14 passed |
| Full browser suite: desktop Chromium, Android Chromium, iPhone WebKit | 117 passed |
| Dashboard browser suite against the Cloudflare adapter | 18 passed |
| Production Node/frontend build | Passed |
| Cloudflare deployment dry run | Passed |

The browser suites ran from an isolated copy with port 4317 because concurrent work was updating the shared frontend build. Backend persistence and notification edge cases were checked after the final server changes. AI and notification delivery were mocked; the actual `dode-italiano` topic was not used for test messages.

Coverage includes separate admin authentication, login rate limits, origin rejection, protected photo URLs, idempotent questions, full answers, chunked photo storage, browser names, search and pagination, owned live captions, late and duplicate fragments, disk/object restarts, retention cleanup, persisted ntfy retries and links after a cold start, and readable excerpts containing both sides of long exchanges. Browser checks also cover logout with an in-flight refresh, expired authentication, deep links, mobile name editing, no horizontal overflow, and automated WCAG AA checks on the dashboard, login and conversation dialog.

The local preview is served at `http://localhost:3001/stats`. A smoke check confirmed HTML 200, unauthenticated API 401, successful admin login, authenticated API 200, 30-day retention and enabled ntfy configuration. The generated password is in the ignored `.env` and `.dev.vars` files under `STATS_ADMIN_PASSWORD`.

Screenshots use synthetic traveler data:

- [Desktop](desktop.png)
- [Android](android.png)
- [iPhone](iphone.png)

Earlier history that exists only on travelers' devices is not imported. Live caption delivery on abrupt browser termination remains best effort; raw audio is not recorded. Deployment was not performed as part of this change.

## Notification delivery investigation, 2026-09-12

The live app had 12 activity records, including 6 failed notifications. Both its admin password and notification topic were configured. The Cloudflare topic secret was reapplied as `https://ntfy.sh/dode-italiano`.

A single fixed diagnostic message published directly from the development machine was accepted by ntfy (HTTP 200). A fixed diagnostic sent through the deployed Cloudflare app returned HTTP 429, now exposed as `ntfy_rate_limit`. This reproduces the delivery problem outside the mocked test environment. No stored trip messages were replayed: automatic approval review rejected the request to retry the six historical notifications, so that action was not executed.

The protected `/api/stats/notifications/test` endpoint and **Bandomasis pranešimas** button use the same publisher as queued notifications, with a fixed message and no activity creation or retry reset. Configuration, auth, quota, HTTP and connection errors are reported without echoing upstream response bodies. Bare topic names and surrounding whitespace are accepted as well as full URLs.

| Follow-up check | Result |
| --- | --- |
| Node/unit/API tests | 30 passed |
| Cloudflare tests in workerd | 16 passed |
| Full browser suite, desktop/Android/iPhone | 126 passed |
| TypeScript and production build | Passed |
| Production deployment | Deployed, version `6aa915df-86d6-4084-b26e-d4675a7c2859` |
| Previous server delivery from Cloudflare | Reproduced ntfy HTTP 429 |
| Actual browser delivery from the deployed app | HTTP 200; confirmed in ntfy history |
| Real recent activity delivery | Two live-session notifications marked sent and matched to ntfy event links |

Screenshots were refreshed using synthetic data. The user has no paid ntfy plan. A free browser delivery mode is implemented and tested: the open app claims only its own newly queued activities, publishes to ntfy with credentials omitted, and acknowledges the outcome. The queue survives server/object restarts. One-minute leases prevent concurrent tabs from claiming the same revision; stale leases can be recovered, acknowledgements are idempotent, and newer live revisions are preserved. Previous server failures are not migrated or replayed. CSP allows only the public ntfy.sh endpoint for this transport.

Automatic approval review initially rejected deploying the browser delivery architecture because explicit approval for exporting excerpts from travelers' browsers to the public topic was required. The user then explicitly approved the described deployment, including leaving older messages untouched. Deployment succeeded with `NTFY_DELIVERY=browser`.

A real Chromium session logged into the deployed `/stats`, sent the fixed diagnostic and logged out. The browser's direct ntfy request returned HTTP 200 with neither authorization nor cookie headers. A subsequent poll confirmed message `p97jy1mTbkO5` at `2026-09-12T06:59:49Z` in `dode-italiano`, linked to the deployed `/stats`. The first immediate poll did not yet contain the record; the later read verified it. A read-only check also matched two newly sent live-session activity IDs to ntfy links, without printing their conversation content. `/api/notifications` reports `enabled: true`.

No paid service was purchased and no VPN or additional server was needed. The app must be open to deliver browser jobs; if closed, unsent jobs wait for that browser to reopen. The six historical messages from the rejected replay request were not replayed.
