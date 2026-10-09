# Graikija · galutinė patikrinta būsena

2026-10-09. Šis dokumentas pakeičia ankstesnį tarpinių pataisų `HANDOFF.md` būsenos įrašą.

## Vieša programėlė

- Pagrindinis adresas: https://graikija.vild.lt
- Worker: `graikija-vertejas`; publikuota versija `89dfc9b4-c690-41f9-8a5e-54ac1f3e7b3e`.
- Kelionės kontekstas: Graikija, Rodo sala / Rhodes / Ρόδος; lietuviška sąsaja, lietuvių ⇄ šiuolaikinės graikų kalbos vertimas. Anglų / ispanų kalba taip pat verčiama į lietuvių.
- Serverio API raktas įkeltas. Naujos AI užklausos apsaugotos atskiru keliautojo kvietimu; pats pagrindinis puslapis viešas. Administravimas `/stats` turi atskirą slaptažodį.
- Asmeninis kvietimas perduodamas atskirai per Telegram; jo ir paslapčių šiame rinkinyje nėra. Vien pagrindinio domeno nepakanka suteikti mokamos API prieigą.
- `workers.dev` domenas yra to paties Worker papildomas adresas. Naudokite pagrindinį domeną: sukonfigūruotas `APP_ORIGIN=https://graikija.vild.lt`, todėl API veikimas per kitą domeną nepatvirtintas.

## Faktiškai vykdytos patikros

- Nepriklausoma Astra pakartotinė kodo peržiūra: praėjo, `deleg_b50b5520`.
- Unit testai: **51/51**.
- Cloudflare API / Durable Objects testai: **21/21**.
- TypeScript, Vite/PWA ir Node build: sėkmingi; Worker dry-run: sėkmingas.
- Pilni Node naršyklių testai: **126/126**; pilni Cloudflare naršyklių testai: **126/126**. Desktop ir Android emuliacija, Chromium, po vieną testų worker kiekvienam serverio variantui.
- Po deployment: **18/18** viešų programos failų baitai atitiko vietinį `dist`. `_headers` / `_redirects` laikomi hostingo valdymo failais, ne viešais turinio failais.
- Gyva API: `/api/health` HTTP200, be kvietimo chat HTTP403, su kvietimu tikras AI atsakymas HTTP200 („Καλημέρα (Kaliméra) – Labas rytas.“). Admin istorija be admin prisijungimo HTTP401, su prisijungimu HTTP200.
- 2026-10-09 vakare gyvo pagrindinio domeno naršyklė: desktop1440×1080, Pixel7 emuliacija, mažas320×568 ekranas. Tikras kvietimas, pradžia → patarimo ekranas; rašymo laukas įjungtas, HTTPS, nėra horizontalaus perpildymo ar page errors. Ankstesnis gyvo naršyklės smoke bandymas nepraėjo; nekeičiant kodo galutinis pakartojimas praėjo. Ankstesnė vietinio DNS neigiama talpykla vėliau išnyko; sistemos DNS nustatymai nekeisti. Ankstesnio bendro naršyklės scenarijaus klaidos priežastis galutinai neįrodyta.
- Tikras sintetinio garso testas per OpenAI Live WebSocket: LT→graikų išlaikė šešis žmones ir15:30; graikų→LT išlaikė17:30 ir15€/asmeniui. Abu sėkmingi seansai grąžino garsą ir uždarymo patvirtinimą. Pirmasis graikų testas nepraėjo; pakartojimas su tuo pačiu garso failu praėjo. Ankstesnio nepraėjusio sintetinio seanso HTTP hangup užklausa grąžino503, todėl jo serverinio uždarymo atskiro patvirtinimo nėra; vietinis WebSocket klientas nutrauktas. Tai ne fizinio telefono mikrofono ar viešos WebRTC grandinės kokybės sertifikavimas.
- Originalaus `keliones-vertejas` Worker etag ir modifikavimo laikas po šio deployment atitiko prieš-deployment įrašą. Originalas nebuvo deployintas ar redaguotas.

## Perdavimo rinkinys

Numatytas privatus TrueNAS katalogas: `files/hermes/graikija` (`/mnt/storage/files/hermes/graikija`). Įkėlimo ir kontrolinių sumų patvirtinimas pateikiamas atskirame `DELIVERY.md` / patikros įraše.

- `graikija.git.bundle`: pilnas Git projektas su vietiniu commit, be darbo kopijos paslapčių ir priklausomybių.
- `graikija-source.tar.gz`: dabartiniai šaltiniai be `.git`, paslapčių, DB, priklausomybių ir talpyklų; originalūs senų ekrano vaizdų `artifacts/` neeksportuojami.
- `graikija-production.tar.gz`: patikrinti klientiniai build failai ir Node bundle; Node bundle skirtas tik vietiniam naudojimui, ne viešam serveriui.
- `graikija-evidence.tar.gz`: patikrų įrodymai, galutiniai viešos sąsajos ekrano vaizdai ir neprivatūs sintetinio garso bandymai. Nėra API raktų, prisijungimo slapukų, kvietimų ar kelionės vartotojų duomenų.
- `SHA256SUMS` ir `GITHUB_MAC.md`.

GitHub nuotolinis įkėlimas šiame darbe nevykdomas: vartotojas pasirinko push iš savo Mac. Naujo GitHub repo sukūrimas / autentifikacija lieka vartotojui.

## GitHub iš Mac

GitHub paskyroje `dovius` sukurkite tuščią repo `graikija` (rekomenduojama Private), be pradinio README, .gitignore ir license. Jei repo jau egzistuoja, pirmiausia patikrinkite jo turinį, neperrašykite ir nenaudokite force push.

Nukopijuokite `graikija.git.bundle` iš TrueNAS į Mac `~/Downloads`, tada naujam, dar neegzistuojančiam `~/graikija` katalogui:

```sh
git clone ~/Downloads/graikija.git.bundle ~/graikija
git -C ~/graikija remote set-url origin https://github.com/dovius/graikija.git
git -C ~/graikija push -u origin main
```

Šios komandos iš Raspberry Pi nebuvo vykdomos Mac aplinkoje. Naudokite savo Mac GitHub autentifikaciją. Naujo viešo deployment nuo šio push nereikia; jau publikuotas Worker lieka veikti.

## Kas lieka žmogui / ribos

- Dėdės tikrame telefone patikrinti mikrofoną, garsą, nuotraukos įkėlimą, ekraną užrakinus ir PWA įsidėjimą. Fizinis iPhone/Safari / Android nepatikrintas.
- ntfy neprijungtas prie viešos temos ir nepublikuoja kelionės turinio: `ntfyConfigured:false`. Integracijos kodas ir testai išlaikyti; įjungti sąmoningai, parenkant privačią temą ir prieigą.
- Paveldėti Node `proxy-addr` (critical), `multer` / `ip-address` (moderate) audit radiniai neištaisyti, nes priklausomybių atnaujinimas nebuvo patvirtintas. Node/Express viešai nedeployintas; Worker šių Node kelių nenaudoja. Tai nėra bendras visų priklausomybių saugumo sertifikavimas.
- API užklausos apmokestinamos vartotojo OpenAI paskyroje. Keliautojo kvietimą siųskite tik numatytiems žmonėms; laikykite jį privačiu.
- Serverio privati konfigūracija liko tik Raspberry Pi failuose `.dev.vars` ir `.dev.vars.deployment-20261009`, mode0600, Git ignored. Administratoriaus slaptažodis yra pastarajame faile; peržiūrėti privačiai, neįkelti į Git, NAS ar pokalbį. Kvietimo nuoroda neteikia administratoriaus teisių.
- Telegram gyvo skambučio integracija nekurta ir neįjungta; tai atskira užduotis.
