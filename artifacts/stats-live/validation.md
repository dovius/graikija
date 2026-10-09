# Live session lifecycle fix · 2026-09-12

## Production finding

Authenticated inspection of italiano.vild.lt found 13 voice records: 12 ended and one active record older than 30 minutes. The active record had never received a final history update. A hangup request for that specific session returned HTTP 404 with OpenAI code `session_id_not_found`. No current session was found for that identifier; the history label was stale. This does not establish its earlier billed duration. No new paid voice session was created for this investigation.

The code fix has not been deployed. Run `npm run cf:deploy`, then refresh /stats; old active rows are reconciled through the provider, and individual calls can be ended from their details.

## Behavior verified

- Only the explicit missing-session code makes hangup idempotent; other 404s, authentication failures and server failures stay errors.
- Failed hangups retain ownership beyond three attempts, survive Cloudflare object eviction, and block overlapping replacement calls.
- A successful hangup whose history write fails retains a durable finalization task; retrying that task does not repeat the provider call.
- Old active history entries are checked with OpenAI; an unknown outcome is marked closing, never guessed to be ended.
- Remote hangup requires the separate admin cookie, same origin, and an existing voice record.
- The phone stops its microphone after a remote close and does not automatically start another session.
- Late captions remain available, and an old poll cannot revert a confirmed ended status.

## Visual iteration

Ran the application locally and captured viewport-only screenshots (`fullPage: false`). Initial inspection found a generic headphones icon inappropriate for ending a call and overly technical explanatory copy. Replaced the icon with a crossed-out phone and shortened the copy. Repeated captures in `final/` and inspected the rendered phone, tablet and desktop layouts.

27 viewport screenshots per iteration: active, closing and ended states at Chromium 360×800, 375×812, 390×844, 430×932, 390×640, 768×1024, 1024×900 and 1440×1080, plus WebKit 390×844. The end/retry buttons are entirely inside the first visible viewport in every capture. No horizontal overflow; minimum button height 49.19 px. Portrait-phone main headings and action labels are readable without clipped or split words; the longer pending heading wraps naturally at 360 px.

| Viewport | End button bottom | Visible height |
| --- | ---: | ---: |
| 360×800 | 409 px | 800 px |
| 375×812 | 414 px | 812 px |
| 390×844 | 430 px | 844 px |
| 430×932 | 474 px | 932 px |
| 390×640 | 338 px | 640 px |

Exact window, client and visual viewport sizes and control rectangles are in [geometry.json](final/geometry.json). [360 px phone](final/active-chromium-360x800.png), [390 px phone](final/active-chromium-390x844.png), [unconfirmed close](final/closing-chromium-360x800.png), [WebKit ended state](final/ended-webkit-390x844.png). Tests use browser emulation and mocked media/provider failures, not a physical phone or a real paid conversation.

## Checks

- `npm test`: 36 passed.
- `npm run test:cloudflare`: 20 passed in workerd.
- Cloudflare browser regression (stats, live, listening safety): 81 passed across Chromium desktop/Android and WebKit iPhone.
- Final stats follow-up: 38 cases passed together, including all 12 remote-hangup and late-poll cases. The remaining debounced-search test passed separately after combining its count/content assertion. Test runs now use separate Cloudflare storage, so repeated runs do not inherit previous login attempts; production rate limits are unchanged.
- `npm run cf:check`: build, both TypeScript targets and Wrangler dry-run passed; no remote deployment.
- `git diff --check`: clean.

Official API references: [GPT-Live-1 pricing](https://developers.openai.com/api/docs/models/gpt-live-1), [session finalization](https://developers.openai.com/api/docs/guides/live-conversations).
