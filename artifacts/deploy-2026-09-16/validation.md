# Cloudflare diegimas · 2026-09-16

Atnaujinti promptai, pokalbio veiksmai, mobilus išdėstymas ir matomesnė pauzė paskelbti [italiano.vild.lt](https://italiano.vild.lt) komanda `npm run cf:deploy`.

- Worker: `keliones-vertejas`.
- Versija: `344cbf19-8432-4e55-a290-5d93f34177a0`.
- Diegimo metu TypeScript patikra ir produkcinis surinkimas pavyko.
- Domeno ir `workers.dev` sveikatos užklausos: HTTP 200, `ok: true`, `configured: true`.
- Vieši pagrindiniai JS, CSS ir `sw.js` failai baitas į baitą atitinka surinktą versiją. [Failų patikra](verification.json).
- Paskelbtos sąsajos patikros: Chromium ir WebKit, 320 × 568 bei 390 × 640. Pauzė yra virš vertimo, 64 px aukščio. Pauzė, tęsimas ir baigimas veikia; pagrindiniai mygtukai telpa, naršyklės JavaScript klaidų nėra. [Rezultatai](browser-smoke.json).

Pokalbio API ir mikrofonas šiose keturiose naršyklės patikrose imituoti. Tikri balso skambučiai ir pranešimų siuntimas po diegimo nebuvo vykdyti. `configured` patvirtina serverio rakto buvimą, ne jo galiojimą ar kreditų likutį.

[Paskelbto ekrano peržiūra · WebKit 320 × 568](webkit-live-320x568.png) · [pristabdytas pokalbis](webkit-paused-320x568.png).
