# Graikija · Kelionės vertėjas

A mobile-first Lithuanian travel interpreter for Greece, with Rhodes (Rodo sala / Ρόδος) as the default destination, not Roda village on Corfu. Three main actions, no accounts, and optional translation controls. React + TypeScript, an installable PWA, and a small backend for either Cloudflare Workers Free or Node/Express.

**Deploy to Cloudflare Free:** see the [Lithuanian deployment instructions](CLOUDFLARE.md). Run `npm run cf:prepare`, `npx wrangler login`, then `npm run cf:deploy`. Hosting and the API share one HTTPS address; OpenAI usage is billed separately.

## Run

Requires Node.js 22.13+ (the optional admin history uses Node's built-in SQLite).

```sh
npm ci
cp .env.example .env
# Set OPENAI_API_KEY in .env, on the server only.
npm run dev
```

Open **http://localhost:3000**. If `.env` already exists, keep it; do not overwrite your key. Without a key, the UI, navigation, installation instructions and saved context still work; AI actions show a friendly Lithuanian service message.

For the production PWA, including offline startup:

```sh
npm run build
npm start
```

The same Node process serves the compiled frontend and `/api` routes. Admin history uses a local SQLite file, with no separate database service required. `.env` is excluded from source control and Docker builds. Never prefix a secret with `VITE_`.

## Architecture and flows

```text
iPhone / Android browser
  React UI ─── IndexedDB: latest photo, text, captions and drafts
     │        Service worker: app, fonts and icons only
     │
     ├─ HTTPS /api/live/session ── Backend ── OpenAI Live session creation
     │    └─ WebRTC directly to GPT-Live-1: microphone, speech, captions
     │
     ├─ HTTPS /api/chat ───────── Backend ── Responses (text + vision + search)
     ├─ HTTPS /api/transcribe ─── Backend ── Lithuanian speech transcription
     └─ HTTPS /api/speech ─────── Backend ── Spoken playback / repeat
```

1. **Versti pokalbį** starts a fresh `gpt-live-1` conversation. Lithuanian is interpreted into Modern Greek; Modern Greek, English and Spanish into Lithuanian. The prompt preserves numbers, negation and corrections, and converts “ask whether…” into a direct question. Select any translation to repeat it, replay at 78% speed, or show a fixed snapshot to the other person. Showing text keeps listening enabled and displays new translations; microphone pause is explicit. TTS replay temporarily suppresses capture and Live playback. End stops capture immediately and drains the session close event. **Tęsti pokalbį** and automatic reconnection restore only that logical conversation; older and legacy captions stay in the readable archive.

   **Ką sutarėme?** creates a separate, saved note about dates, times, people, location, price and conditions. **Paaiškink man** explains a selected phrase in Lithuanian. Both pause Live audio while open. These use Responses, without web search or interpreter delegation. Recaps use a strict JSON schema and the server verifies exact quotes against input captions, never against model translations alone. Quoted evidence can still be misrecognized or misinterpreted; the card distinguishes unclear and missing details and never claims to perform a reservation. Long/truncated context is labeled.

   Optional controls choose automatic direction, translation into Greek/Lithuanian, and slower Live delivery. Trusted controls use `session.instructions.append` and match acknowledgement IDs; failed controls do not change saved preferences. After an unacknowledged timeout the connection is replaced with the last confirmed settings. Acceptance does not guarantee that the next utterance follows the entire change.
2. **Išversti nuotrauką** opens the native rear camera or the photo library. A local canvas rotates according to the decoded image, scales the longest edge to at most 2,000 px, and compresses to JPEG. The server sends the image to a vision-capable Responses model with instructions to translate and explain the practical meaning. Every follow-up includes the same image and recent messages, including after reload.
3. **Paklausti patarimo** accepts Lithuanian text or a short recording. Dictation uses MediaRecorder (WebM/Opus or MP4 depending on the browser), then server-side transcription; the user can review the text before sending. The assistant has hosted web search for current travel facts and shows clickable source links. Answers can be read aloud.

Default models are `gpt-live-1`, `gpt-5.6-sol` for text and images, `gpt-4o-mini-transcribe`, and `gpt-4o-mini-tts`. Photo and assistant requests use `reasoning.effort: "low"` and `service_tier: "fast"`. [Fast mode](https://developers.openai.com/api/docs/guides/fast-mode) has a higher per-token price than Standard processing; OpenAI may report the actual tier as `priority` for GPT-5.6. Server environment variables can change models; any replacement text model must support the configured reasoning and service tier. The Live integration uses **`POST /v1/live/sessions`**, not the different Realtime API contract. No project key or ephemeral provider credential is returned to the frontend.

## Private activity dashboard: `/stats`

Open `/stats` directly; the main app contains no link to it. Set `STATS_ADMIN_PASSWORD` on the server to enable both the dashboard and activity recording. It uses a separate password login, signed eight-hour HttpOnly cookie, origin checks and login rate limiting. Traveler invitation cookies do not grant admin access. History APIs and photo URLs require this admin cookie, use `no-store`, and `/stats` is excluded from offline navigation and search indexing.

The dashboard includes sent photos and their follow-up questions, assistant questions and answers, dictated text before submission, requested speech playback, and the original/translated live captions. Search by text or name, filter by traveler, action or date, open full replies and photos, or view every question in a conversation. The feed refreshes every 15 seconds. Browser identities are hashed anonymous visitor IDs; give them names inside the dashboard, including on mobile after selecting a traveler. This labels a browser, not a verified person: a different device/browser or cleared cookies produces another identity. A shared microphone does not identify individual speakers.

| Server setting | Purpose |
| --- | --- |
| `STATS_ADMIN_PASSWORD` | Independent admin password; without it, recording and access are disabled. |
| `STATS_RETENTION_DAYS` | Retain entries for 30 days since their last update by default; accepts 1–365. |
| `STATS_DB_PATH` | Node only: persistent SQLite path, default `./data/stats.sqlite`. |
| `NTFY_TOPIC_URL` | Notification topic URL, disabled until explicitly configured; new-trip example `https://ntfy.sh/dode-graikija`. Public topics expose notification excerpts to anyone who knows the topic. |
| `NTFY_TOKEN` | Optional bearer token for a topic requiring authentication. |
| `NTFY_DELIVERY` | `server` by default on Node; Cloudflare is configured with `browser` for public ntfy.sh delivery from the open app. A configured token keeps delivery on the server. |

Node stores history and photos in SQLite; Cloudflare uses a separate `ActivityLog` SQLite Durable Object with the `v2` migration in `wrangler.jsonc`. Photo data is deduplicated and split into bounded rows. A photo is removed after the last referencing event expires. Mount persistent storage on Node hosts; Docker's `/app/data` volume holds the database. Changing or removing the password revokes access, but does not erase the existing database.

Notifications contain the traveler label, action, text excerpt and an authenticated `/stats?event=…` link. Photos remain behind admin authentication. Set `APP_ORIGIN` for Node production; Cloudflare derives the origin from the request. Publishing follows the [ntfy JSON API](https://docs.ntfy.sh/publish/#publish-as-json). Pending notifications survive restarts and retry up to five times with backoff; failures remain visible and can be retried from the dashboard. Server delivery uses a 15-second Node poll or Cloudflare alarms. Live caption updates are grouped into notifications about every 15 seconds. Delivery is at least once: a crash after ntfy accepted a message can cause a duplicate notification.

Use **Bandomasis pranešimas** in `/stats` to test the configured delivery method. It sends a fixed diagnostic message without copying or retrying trip history, and reports configuration, access, rate-limit or connection errors. `NTFY_TOPIC_URL` accepts either a full topic URL or a topic name such as `dode-graikija` (on `ntfy.sh`). Server logs contain only diagnostic codes, never upstream responses or notification content.

On Cloudflare, `ntfy.sh` can return HTTP 429 because anonymous and free accounts share an IP-based quota with other publishers using the same egress IP. This deployment uses `NTFY_DELIVERY=browser`: each traveler's open app claims only its own new notifications and publishes from that device, under its normal ntfy quota. The durable queue remains on the server; a one-minute lease prevents two tabs publishing the same queued revision at once. Delivery status is acknowledged by the browser. If the app closes before delivery, pending jobs wait for that browser to reopen. No notification content or credentials are put in local storage; only an in-memory acknowledgement is retained during a temporary outage. HTTP credentials and cookies are omitted on the ntfy request, and CSP permits only the public `https://ntfy.sh` endpoint. Previously failed server deliveries are not migrated or replayed automatically. A paid-tier token or running the Node server elsewhere also permits server delivery; see [Cloudflare notification behavior](CLOUDFLARE.md#duomenys-ir-pabaiga).

Recording starts when enabled; earlier device-only history is not imported. The live media connection sends displayed captions back to the server in small batches, retries temporary failures and flushes on ending/leaving a call. These captions come from the browser and are not independently verified against provider audio; an abrupt browser shutdown or extended outage can lose the final batch. Raw audio recordings are never stored. Playback served from the device cache or local speech synthesis does not call the server and produces no additional playback event. Deleting local phone history does not delete the admin copy. The app's privacy help describes organizer access and ntfy delivery.

## Deploy for the trip

For **Cloudflare Workers Free**, follow [CLOUDFLARE.md](CLOUDFLARE.md). `wrangler.jsonc` deploys the frontend and native Fetch API together, with SQLite Durable Objects for temporary browser sessions. API secrets are uploaded from the ignored `.dev.vars` file. No separate domain or `APP_ORIGIN` configuration is needed. The React interface and shared OpenAI payloads are the same on both hosting targets.

The Node server is an alternative hosting target, but **public Node deployment is pending dependency remediation**: the parent review found inherited critical `proxy-addr` and moderate `multer` / `ip-address` issues in the lockfile. No dependencies were updated during this adaptation. See [HANDOFF.md](HANDOFF.md) for verification and remaining work. After remediation, use an HTTPS host, set `OPENAI_API_KEY` and `APP_ORIGIN=https://your-domain.example`, and set `TRUST_PROXY=1` only for one trusted reverse proxy. Bind using the host's `PORT` variable. A static-only host cannot run the API.

HTTPS is required for a phone's microphone, PWA installation and service workers. Plain HTTP on a LAN IP will not enable those features. `localhost` is the browser's local development exception.

For private trip access without a login, optionally set `TRIP_ACCESS_TOKEN` to a random value:

```sh
openssl rand -hex 24
```

Share `https://your-domain.example/join/YOUR_TOKEN` with the travelers. Opening it sets a secure, HttpOnly, 14-day access cookie and redirects to the clean home URL. They can then install the app and use it normally. `/join/` is deliberately excluded from the offline navigation cache. Anyone holding the invitation can use the service, so share it only with the travel group. Without this optional token, the API is accessible to anyone who can reach the site. Keep the OpenAI project funded, configure spend alerts, and stop the server after the trip.

The backend verifies the request origin, validates payloads, limits requests, scopes live session ownership to an anonymous browser cookie, and deduplicates chat retries for ten minutes. Opening a replacement live session requires confirmation that the previous session has closed; the server also requests hangup after 30 minutes. Failed hangups retain ownership and retry with backoff instead of being discarded after three attempts. Node uses process memory and timers, appropriate for a single small server. The Cloudflare adapter uses per-browser SQLite Durable Objects and alarms, so ownership, limits and completed retries survive process eviction. Only one Node replica should be used without shared storage; Cloudflare handles its own object routing.

In `/stats`, open a voice record and use **Baigti pokalbį** to hang up remotely. The server marks it ended only after OpenAI accepts hangup or explicitly returns `session_id_not_found`; other failures remain **Uždarymas dar nepatvirtintas** and retry automatically. The activity store also reconciles active records older than 30 minutes, repairing stale entries from earlier deployments by contacting OpenAI, not merely changing their label. Cloudflare retains successful hangups whose final history write failed until that write succeeds. The history label is not a live connection probe or a billing meter.

### Docker

```sh
docker build -t graikija-vertejas .
docker run --rm --env-file .env -v graikija-data:/app/data -p 3000:3000 graikija-vertejas
```

Put the container behind the host's HTTPS proxy. Set `APP_ORIGIN` to the public HTTPS address.

## Mobile and offline behavior

- All fonts, SVG illustration and icons are local. Phones show three full-width home actions and labeled navigation. Primary controls are at least 52 px tall; form text is 18 px and translated captions are 22 px at the default text size. Zoom and larger text are supported, dialogs trap focus, and reduced-motion preferences are respected.
- Live translation keeps repeat, show, pause and end controls together below the text. **Daugiau** opens slower replay, recap, explanations, saved conversations and language settings. Selected phrases occupy the reading area without duplicating the full conversation. Help, recaps and translation dialogs keep their close/return controls separate from scrolling text.
- Photo and assistant answers open at their first sentence with **Išklausyti** at the top. Follow-up input stays below the independently scrolling answer. A compact layout uses the visual viewport when a keyboard reduces the available height; the send button remains stable through its click. Physical keyboard/browser toolbar behavior still needs device testing.
- iPhone: use Safari → Share → Add to Home Screen. Android: use Chrome's install prompt or Add to Home screen. The footer explains both paths.
- The production app shell, previous answers, current photo and drafts open offline. **New AI translations need an internet connection.** A health probe also detects a network that appears connected but cannot reach the server.
- Voice reconnects with bounded backoff and seeds a replacement session only from captions belonging to the current logical conversation. Old connection events are ignored. The user may need to repeat an utterance that was lost during an outage.
- Failed questions remain visible. Transient network retries reuse the same request ID; the server deduplicates in-flight and completed requests. A recoverable offline question retries when connectivity returns. Do not claim exactly-once processing across a server restart or an ambiguous upstream timeout.
- Text and the last compressed photo live in IndexedDB on the device. Replacing a photo starts a new image conversation. Help includes a clear-data action. Private browsing or storage denial is reported; the app then continues in memory.
- The server requests `store: false` for Responses and Live. With `STATS_ADMIN_PASSWORD` enabled, photos, questions, replies and displayed live captions are retained in the private admin history described above. Raw recordings, credentials and raw upstream errors are not logged. Separate reply copies are cached for approximately ten minutes for network retries: in memory on Node, in temporary durable storage on Cloudflare. Caption upload ownership is retained for 40 minutes to accept late batches after a call ends. OpenAI's own data retention policies still apply. Audio input, photos and questions are sent to OpenAI for processing; organizer history and ntfy delivery are explained in the app.
- Replay audio is cached in memory for the last ten texts. If offline, a cached clip can replay; otherwise the app uses an available device voice or explains that the sound needs a connection. Voice quality and device voice availability vary.
- A screen wake lock is requested during live conversations where supported. Leaving the conversation stops capture; switching away from the page ends the call to avoid unexpected background microphone use.
- Live listening stops after two minutes without nonempty human-input captions; model output cannot renew the deadline. A 20-second countdown offers **Tęsti pokalbį** before stopping. A separate ten-minute confirmation deadline applies even if nearby voices keep producing captions; only an explicit confirmation renews it. Both deadlines survive reconnection and use wall-clock time. Automatic stops release microphone tracks, close WebRTC and request server hangup, while preserving the conversation text. Returning to the page never reopens the microphone automatically. The server's existing 30-minute cleanup remains a fallback if the browser disappears without delivering hangup.
- Question dictation is limited to 60 seconds and releases the microphone immediately on app switching or screen lock, including when microphone permission is still pending. Lock/background behavior is covered with browser lifecycle event simulations; verify it on physical iPhone/Android devices before the trip.

## Checks

```sh
npm run typecheck
npm test
npm run build
CI=1 E2E_PORT=4273 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- --project=desktop --project=android
# Cloudflare runtime and the same browser flows:
npm run cf:check
npm run test:cloudflare
CI=1 E2E_PORT=4274 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e:cloudflare -- --project=desktop --project=android
```

The automated API tests use an injected provider, and browser flow tests explicitly mock AI responses. They test origin rejection, anonymous ownership, invitation access, idempotency, image follow-ups, incomplete answers, mobile dictation formats, and late/overlapping captions. Browser projects cover desktop Chromium, Android-sized Chromium, and iPhone-sized WebKit. The production PWA is exercised offline. WebKit emulation is not a replacement for testing camera permissions, audio routing and interruption quality on physical phones.

`scripts/generate-icons.mjs` rebuilds install icons from `public/icon.svg`.

Official contracts used: [GPT-Live WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc), [Live session lifecycle and captions](https://developers.openai.com/api/docs/guides/live-conversations), [Live prompting](https://developers.openai.com/api/docs/guides/live-prompting), [images and vision](https://developers.openai.com/api/docs/guides/images-vision), [web search](https://developers.openai.com/api/docs/guides/tools-web-search), [speech transcription](https://developers.openai.com/api/docs/guides/speech-to-text), and [speech synthesis](https://developers.openai.com/api/docs/guides/text-to-speech).

Historical files in `artifacts/` belong to the upstream app, are not Greek-app validation, and must not be published or copied into the handoff. Current execution evidence and pending delivery status are listed in [HANDOFF.md](HANDOFF.md). Run `node --import tsx scripts/capture-layout.ts final` against a running production build to create fresh captures.

## Live UX checks (September 2026)

`tests/browser/live-improvements.spec.ts` covers fresh/resumed context, immutable phrase selection, listening while showing text, slower replay, acknowledgement failures/timeouts, saved recap reuse and output-only inactivity. API tests verify recap evidence, invalid payloads and bounded diagnostics. Optional `/stats` diagnostics include the logical conversation ID, prompt version, start reason, playback state, selected actions, caption timing and close reason; this adds no audio recording.

A separate, explicitly invoked smoke test makes a small number of **paid** OpenAI requests using synthetic audio only:

```sh
node --import tsx scripts/evaluate-live.mjs
```

It reads the server key from `.dev.vars` or `OPENAI_API_KEY`, saves local results under ignored `data/analysis/`, sends `store: false`, and closes each Live session. It is excluded from normal test runs. Greek scenarios replace the upstream language examples. This paid script was not run during the adaptation; real Greek translation/audio quality is not claimed.
