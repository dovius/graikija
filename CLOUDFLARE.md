# Graikija · diegimas į Cloudflare Workers

Šis projektas yra atskira Graikijos / Rodo salos programėlė. Numatytoji kryptis: **Rodo sala (Rhodes / Ρόδος)**, ne Roda kaimas Korfu saloje. Lietuviška sąsaja, šiuolaikinės graikų kalbos vertimas.

## Izoliacija ir paslaptys

- Worker: **`graikija-vertejas`**. Custom domain: **`graikija.vild.lt`**.
- `TRIP_SESSIONS` / `ACTIVITY_LOG` yra šio Worker SQLite Durable Objects. Nėra susiejimo su kito Worker klasėmis ar duomenimis. `v1` / `v2` migracijos sukuria naujas šio Worker saugyklas.
- Nekopijuokite ankstesnių kelionių DB, `.wrangler`, istorijos, kvietimų ar pranešimų eilės. Kurkite naujus `TRIP_ACCESS_TOKEN` ir `STATS_ADMIN_PASSWORD`.
- Vietinis privatus failas: **`/home/dode/graikija/.dev.vars`** (`0600`). Esamo failo neperrašykite. Jame vartotojas įrašo `OPENAI_API_KEY`; vertės neturi patekti į pokalbį, Git, archyvą, NAS kopiją ar viešą `dist`.
- `.dev.vars.example` / `.env.example` nėra paslaptys. `NTFY_TOPIC_URL` pagal nutylėjimą tuščias. Naujos temos pavyzdys: `https://ntfy.sh/dode-graikija`. Įjunkite sąmoningai: viešos temos ištraukas gali skaityti žinantys jos vardą. Asmeniniam turiniui rinkitės apsaugotą temą; `NTFY_TOKEN` lieka serveryje.
- Be `STATS_ADMIN_PASSWORD` administravimas ir serverio istorija išjungti. Be `TRIP_ACCESS_TOKEN` API pasiekiama visiems, žinantiems adresą. Prieš viešą naudojimą sukonfigūruokite kelionės prieigą ir API išlaidų ribas.

## Prieš diegimą

```sh
cd /home/dode/graikija
npm ci
npm run typecheck
npm test
npm run build
npm run test:cloudflare
npm run cf:check
```

`cf:check` tikrina paketą su `--dry-run`, nieko nepublikuoja. Testai naudoja imituojamą tiekėją; jie neįrodo realaus vertimo kokybės ar API rakto galiojimo.

Vietinis Node serveris skaito `.env`, ne `.dev.vars`. Node naudojimui atskirai nustatykite serverio aplinką pagal `.env.example`; gamyboje `APP_ORIGIN=https://graikija.vild.lt`. Nenaudokite `VITE_` prefikso paslaptims.

## Diegimas (tik po nepriklausomos peržiūros)

```sh
npm run cf:prepare
npx wrangler login
npm run cf:deploy
```

`cf:prepare` neperrašo esamo `.dev.vars`. Jei jo nėra, iš `.env` kopijuoja tik palaikomus nustatymus (API raktą, prieigos/admin ir ntfy konfigūraciją). `cf:deploy` įkelia šio Worker paslaptis per `--secrets-file .dev.vars` ir tuo pačiu pateikia React/PWA bei API. Modelių numatytosios reikšmės išlaikytos iš pradinės programos; hostingas neapmoka OpenAI užklausų.

**Nekeiskite kitos programėlės domeno ar Worker.** Jei Wrangler siūlo perimti ne šio projekto domeną, sustokite. Šio projekto konfigūracijoje vienintelis custom domain yra `graikija.vild.lt`.

### Jei custom-domain leidimų nepakanka

Paruoštas `wrangler.workers-dev.jsonc`: tas pats `graikija-vertejas`, tos pačios migracijos ir modeliai, tik nėra custom-domain maršruto.

```sh
npm run build:cloudflare
npx wrangler deploy --config wrangler.workers-dev.jsonc --secrets-file .dev.vars
```

Naudokite **tikslų Wrangler parodytą** stabilų `https://graikija-vertejas.<paskyros-subdomenas>.workers.dev` adresą. Nekurkite quick tunnel ir nekeiskite kitos programėlės maršrutų. Toliau atnaujinkite su tuo pačiu pasirinktu config failu.

## Gyvas patikrinimas

- `GET /api/health` turi grąžinti JSON, o ne HTML. `configured: true` reiškia tik netuščio serverio rakto buvimą, ne tikrą sėkmingą AI užklausą.
- Patikrinkite pagrindinį puslapį, `manifest.webmanifest`, `sw.js`, CSP ir HTTPS. Be interneto veikia tik anksčiau įkeltas apvalkalas bei įrenginyje saugoti duomenys; nauji vertimai neveikia.
- Su nauju kvietimu patikrinkite lietuvių → graikų bei graikų / anglų / ispanų → lietuvių kryptis, skaičius ir pataisymus; tikras garsas gali kainuoti.
- Patikrinkite meniu nuotrauką, tolesnį klausimą, diktavimą, pakartojimą / lėtesnį garsą ir pokalbio uždarymą. Nevadinkite imituotų atsakymų tikro AI patikra.
- `/stats` turi atskirą administratoriaus prisijungimą; keliautojo kvietimas nesuteikia admin teisių. Nauja istorija turi prasidėti tuščia. Bandomasis ntfy pranešimas siunčia tik diagnostinį tekstą, ne seną istoriją.
- Tikrą iPhone/Safari mikrofoną, kamerą, užrakto elgesį ir PWA įdiegimą reikia patikrinti fiziniame įrenginyje.

## Naršyklių testai be diegimų

Naudokite jau esamą Chromium. Keiskite portą, jei jis užimtas; nestabdykite svetimų procesų.

```sh
CI=1 E2E_PORT=4273 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e -- --project=desktop --project=android
CI=1 E2E_PORT=4274 PLAYWRIGHT_CHROMIUM_EXECUTABLE=/usr/bin/chromium npm run test:e2e:cloudflare -- --project=desktop --project=android
```

`E2E_OUTPUT_DIR` leidžia atskirti ataskaitas. Prieš lygiagrečius testus surinkite vieną kartą; nekeiskite `dist`, kol vykdomi PWA testai. WebKit projekto nepaleiskite, jei nėra jau įdiegtos suderinamos naršyklės.

## Duomenys ir pabaiga

Pokalbio kontekstas telefone laikomas atskiroje `graikija-vertejas` IndexedDB; PWA cache, kvietimo, lankytojo ir admin slapukų vardai taip pat atskiri. `/api`, `/join` ir `/stats` nėra offline navigacijos cache. Admin saugojimo terminas pagal nutylėjimą 30 dienų; `STATS_RETENTION_DAYS` priima 1–365. Telefonu ištrinta istorija nereiškia administratoriaus kopijos ištrynimo. Raw audio nesaugomas.

ntfy serverio režimas kartoja siuntimą su ribotu backoff. Cloudflare numatytas `browser` režimas: atvertas įrenginys siunčia tik savo naujus pranešimus, uždarius laukia eilėje. Apsaugotai temai su tokenu siunčia serveris. Įrašus administruoja tik šio naujo Worker admin.

Po kelionės išjunkite naujo projekto API raktą / naują Worker tik aiškiai patvirtinę tikslą. Jokie ištrynimai nėra šio paruošimo dalis.
