# Graikija · tarpinių pataisų būsenos įrašas

Šis dokumentas fiksuoja ankstesnio taisymo etapo būseną, o ne dabartinę deployment ar perdavimo būseną. Galutinės patikros ir aktualios instrukcijos: [FINAL_STATUS.md](FINAL_STATUS.md).

## Kas paruošta

Atskira lietuviška kelionės programėlė Graikijai; numatytoji kryptis – **Rodo sala (Rhodes / Ρόδος)**, ne Roda Korfu saloje. Išlaikytos balso, nuotraukų, patarimų, istorijos ir PWA funkcijos. Pradinio Italijos projekto bazė: `dfcd774c9f0c608a4f9bc9ab3cd7d90c8b26659e`; originalus projektas ir jo diegimas šio taisymo metu neliesti.

- Šaltinis: `/home/dode/graikija`.
- **Cloudflare diegimas ir viešo adreso patikra dar neatlikti.** Numatyta `graikija-vertejas` / `graikija.vild.lt`; jei trūksta domeno leidimų, naudoti atskirą `wrangler.workers-dev.jsonc`. Diegia pagrindinis agentas tik po nepriklausomos pakartotinės peržiūros.
- **GitHub publikavimas, commit ir push dar neatlikti.** Patvirtinto naujo repozitorijos URL nėra.
- **NAS kopija dar neperduota.** Numatytas TrueNAS tikslas: `files/hermes/graikija` (`192.168.1.153:/mnt/storage/files/hermes/graikija`). Pagrindinis agentas kopijuoja šaltinius ir instrukcijas be paslapčių, priklausomybių, DB, talpyklų bei senų `artifacts/` failų; po kopijavimo patikrina tikslą ir kontrolines sumas.

## Patikros

Prieš šias pataisas pagrindinis agentas pranešė: **49/49** Node testų, sėkmingas build, **21/21** Cloudflare testų su `--test-timeout=90000` ir **122/126** Node serverio naršyklių testų (desktop + Android, nuosekliai). Keturi nepraėję atvejai – mažo telefono geometrija ir statistikos paieška abiejuose profiliuose.

Šiame taisymo etape realiai vykdyta:

| Komanda / apimtis | Rezultatas |
| --- | --- |
| `node_modules/.bin/tsx --test tests/greece.test.ts` prieš pataisą | Exit 1: 4 praėjo, 2 nauji regresiniai testai pagrįstai nepraėjo (mišri kalba, itališkos dialogo etiketės). |
| Ta pati komanda po pataisos | Exit 0: 6/6. |
| `npm test` | Exit 0: 51/51. |
| `npm run build` | Exit 0; abi TypeScript patikros, klientas/PWA ir Node serverio paketas. |
| `npm run test:cloudflare` | Exit 0: 21/21; skripto timeout dabar 90000 ms. |
| Tik du anksčiau nepraėję scenarijai ir visi `live-feedback` scenarijai, desktop + Android, vienas worker, portas 4473 | Exit 0: 10/10. |

Įrodymai: `/home/dode/research/graikija/evidence/retry-fixes.md`, `retry-{regression-red,regression-green,unit,build,cloudflare,focused-browser}.log` ir `retry-focused-browser/`. Visas 126 naršyklių testų rinkinys po pataisų **nebuvo pakartotas**. Esamas statistikos testas taip pat perrašė `artifacts/stats/{desktop,android}.png` imituotų duomenų ekrano vaizdais; tai nėra gyvos paslaugos patikra.

Testai naudoja imituojamą tiekėją. Tikros AI užklausos nevykdytos; rakto galiojimas, graikų vertimo / garso kokybė ir fizinio iPhone / Android elgsena nepatvirtinti. Testų serveris uždarytas, portas 4473 nebeklauso.

## Pataisos ir likusios rizikos

- Aktyvus „Parodyti žmogui“ dialogas: `Μετάφραση` ir `Μπορείτε να απαντήσετε`, be itališkų etikečių.
- Kalbos parinkimas remiasi vyraujančiu graikišku / lotynišku raštu; lygybės ar tuščio teksto atveju – lietuvių. Tai ribota dviejų programėlės kalbų euristika, ne bendras kalbos atpažinimas.
- Siaurame telefone ilgesnis graikiškas tekstas užėmė daugiau eilučių; slinkimas iki apačios nukirpo pirmos eilutės viršų. Sumažintos tik ≤380 px išorinių tarpų paraštės: skaitymui atlaisvinti 8 px, nepakeitus šrifto, mygtukų ar geometrijos testų tolerancijos.
- Statistikos testas ieško tikro fixture žodžio `kavos`, sulaukia tos paieškos atsako ir tikrina rezultato ID bei sąsają.
- **Viešo Node/Express diegimo neatlikti iki atskiro priklausomybių taisymo ir pakartotinio audito.** Pagrindinio agento auditas nurodė paveldėtą kritinį `proxy-addr` ir vidutinio sunkumo `multer` / `ip-address` pažeidžiamumą. Šiame etape priklausomybės neatnaujintos. Cloudflare adapteris nenaudoja Express / multer; tai nėra bendras visų priklausomybių saugumo patvirtinimas.
- Build pateikė esamą Vite įspėjimą dėl `./shared/travel` importo be plėtinio būsimam native config loader; Node pateikė eksperimentinės SQLite funkcijos įspėjimą. Dabartinės patikros praėjo.

## Paleidimas ir paslaptys

Reikia Node.js ≥22.13.0. Šioje darbo kopijoje priklausomybės jau yra; naujoje kopijoje jas paruoškite atskirai tik turėdami leidimą. Node skaito `.env`, Cloudflare – `.dev.vars`; naudokite pavyzdžius ir neperrašykite esamų privačių failų.

```sh
cd /home/dode/graikija
npm run dev
# arba produkcinis vietinis paketas:
npm run build
npm start
# Patikros:
npm test
npm run test:cloudflare
```

Node vietinis adresas: `http://localhost:3000`. Be rakto galima tikrinti sąsają; naujoms AI užklausoms reikia serverio konfigūracijos. Diegimo instrukcijos: [CLOUDFLARE.md](CLOUDFLARE.md).

`.dev.vars` liko gitignored ir `0600`; turinys šio taisymo metu neskaitytas. Nekopijuoti `.dev.vars`, `.env`, API raktų, administratoriaus slaptažodžių, kvietimų, `.wrangler/`, `node_modules/` ar kelionių duomenų į Git, viešus failus arba NAS perdavimo rinkinį. Nenaudoti `VITE_` prefikso paslaptims.
