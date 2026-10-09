# Pokalbio UX atnaujinimas · 2026-09-16

Pakeitimai įgyvendinti bendrame React, Node ir Cloudflare kode. Po vietinių patikrų ir mobiliųjų ekranų atnaujinimo 2026-09-16 paskelbta [italiano.vild.lt](https://italiano.vild.lt). [Diegimo patikra](../deploy-2026-09-16/validation.md).

## Kas pakeista

- „Versti pokalbį“ pradeda naują temą be ankstesnių dialogų. „Tęsti pokalbį“ ir automatinis ryšio atkūrimas gauna tik to paties loginio pokalbio kontekstą. Naujas pokalbis grąžina automatinę kalbų kryptį, išlaikydamas lėtesnio kalbėjimo pasirinkimą.
- Senesni užrašai ir naujos santraukos pasiekiami telefone iš pradžios ekrano. Ankstesnės saugyklos versijos tekstai išlieka, tačiau nesiunčiami naujam vertimui.
- Palietus vertimą pasirenkama jo kopija: vėluojančios antraštės nepakeičia pakartojamos ar rodomos frazės. Galima grįžti prie naujausios. Trumpi prasmingi atsakymai, pvz., „Ne“ ir „Šeši“, nefiltruojami.
- „Pakartoti lėčiau“ tą patį TTS garsą groja 0,78 greičiu, išlaikydamas balso aukštį. Kartojant pristabdomas mikrofonas ir Live garsas. Pasibaigus atkūrimui grįžta ankstesnė klausymo būsena.
- „Parodyti žmogui“ toliau klausosi ir aiškiai rodo mikrofono būseną. Nauji vertimai matomi po rodoma fraze. Yra atskira pauzė ir pokalbio užbaigimas.
- Automatinę kryptį galima pakeisti į vertimą itališkai arba lietuviškai; galima paprašyti lėtesnio Live kalbėjimo. Laukiama būtent išsiųstos instrukcijos patvirtinimo. Klaida nepakeičia saugomo nustatymo, o nepatvirtintas pakeitimas po 5 s atkuria ryšį su paskutiniais patvirtintais nustatymais.
- „Ką sutarėme?“ paruošia išsaugomą datų, laikų, žmonių, vietos, kainos ir sąlygų kortelę. Serveris tikrina JSON struktūrą ir kiekvienos nurodytos detalės citatą iš išgirsto teksto. Vertėjo paties sugalvotas atsakymas nelaikomas įrodymu. Trūkstami duomenys ir neaiškumai pažymimi; sutrumpintas ilgas kontekstas atskleidžiamas.
- „Paaiškink man“ yra atskiras lietuviškas paaiškinimas. Vertėjas lieka vertėju; patarimo nereikia prašyti žodžiais, kuriuos jis turėtų versti pašnekovui.
- Promptas `2026-09-16.3` saugo neiginius, pataisymus ir skaičių paskirtį, neleidžia baigti senų frazių, skiria tikrą pakartojimą nuo paties modelio kartojimosi ir slopina modelio pritarimo intarpus.
- Kompaktiškesnė būsena atlaisvina vietą tekstui. Antraščių aukštis apskaičiuojamas pagal tikrą laisvą vietą. Sumažėjus langui išlieka naujausias tekstas; žmogui slenkant atgal jo skaitymo vieta saugoma. Papildomi veiksmai turi matomą nuorodą.
- Užblokuotas Live garsas pristabdo mikrofono perdavimą iki aiškaus „Įjungti garsą“. Kalbėjimo indikatorius vertina gaunamą garsą, o ne antraščių pasirodymą.
- Paties modelio antraštės nepratęsia neveiklumo laikmačio. Išliko automatinis išjungimas paslėpus puslapį, 2 min. neveiklumo ir 10 min. patvirtinimo ribos.
- `/stats` atsirado ribota diagnostika: loginio pokalbio ID, prompto versija, pradžios priežastis, pirmų antraščių laikas, garso blokavimas, rodymas, kartojimas, pauzė, atkūrimas ir užbaigimas. Garso įrašymas neįjungtas. Esami techninių sesijų ID ir jų užbaigimo mechanizmas išsaugoti; DB pakeitimas prideda atskirą lentelę.

## Automatinės patikros

- TypeScript patikra ir produkcinis surinkimas.
- 44 Node / bendro kodo testai: API, konteksto izoliacija, santraukų citatos ir diagnostika.
- 20 Cloudflare testų su Miniflare: Durable Objects, saugojimas, autentifikacija, sesijų savininkai, pakartojimai ir uždarymas.
- Naršyklės rinkinys: 56 scenarijai × 3 konfigūracijos (desktop Chromium, Android dydžio Chromium, iPhone dydžio WebKit). Visi 168 patikrinimai praėjo. Po paskutinio santraukos garso valdiklių pataisymo atskirai pakartoti 9 garso scenarijai visose trijose konfigūracijose (santrauka, lėtas kartojimas, užblokuotas Live garsas).
- `npm run cf:check`: Cloudflare paketas paruošiamas sausu diegimo paleidimu.
- Naršyklės testai naudoja imituojamą mikrofoną ir modelio atsakymus. Patikros apima 390 × 640 sumažintą langą, kitus telefonų dydžius, prieinamumo spalvas, sumažintą judesį, fokusą, ryšio praradimą, senų įvykių ignoravimą ir išjungimą.

Testuojant buvo aptiktas ir pataisytas vertimo uždengimas valdikliais bei atvejis, kai antraščių srities aukščio pokytis buvo palaikytas žmogaus slinkimu. Vieną bendro rinkinio paleidimą paveikė tuo pačiu metu perrašomas `dist` katalogas; galutinis rinkinys paleistas tik užbaigus surinkimą.

## Realios OpenAI užklausos

Atliktos 2 Responses užklausos ir 6 trumpos Live sesijos, naudojant 4 specialiai sukurtus sintetinius garso pavyzdžius. Siųsta `store: false`; privačių kelionės pokalbių garsas ar eksportas šiam bandymui nenaudoti.

| Bandymas | Rezultatas |
| --- | --- |
| LT → IT: staliukas šešiems, rytoj 15:30 | Su promptu v2 išlaikė visus skaičius ir prasmę. |
| LT → IT: „ne aštuoni, o šeši; ne 15:00, o 15:30“ | Su v2 išlaikė abu pataisymus ir neiginius. |
| IT → LT: grįžimas 17:30, kaina 15 € žmogui | V2 supainiojo 17:30 su 15:30, nors įvesties antraštė teisinga. Pridėjus skaičių paskirties taisyklę, v3 pakartotinis bandymas abu skaičius išvertė teisingai. |
| LT → IT: „paklausk, ar galime važiuoti šešiese; ar rytoj bus vietos“ | Pirmą kartą strigo sesijos progresas, nebuvo antraščių ir uždarymo patvirtinimo. Pakartojus su v3 gautas instrukcijos pakeitimo ACK, teisingas tiesioginis klausimas itališkai ir uždarymo ACK. |
| Santrauka: du skirtingi laikai, 6 žmonės, 15 → 20 € pataisymas, klaidingas vertėjo rezervacijos patvirtinimas | Išskyrė 15:30 / 17:30, 6 žmones, galutinę 20 € kainą; nepriėmė klaidingo patvirtinimo ir pasiūlė patikslinti rezervaciją. Citatų patikra praėjo. |
| Paaiškinimas apie rezervaciją | Atsakė, kad patvirtinimo iš pokalbio nematyti, atpažino klaidingą vertimą ir pateikė itališką patikslinimo klausimą. |

Prieš įvestį tikrinta 2 s tyla – nei viename bandyme nebuvo ankstyvo vertimo. Penkios sesijos pateikė garsą, antraštes ir `session.closed`; stringanti sesija uždaryta atsarginiu HTTP keliu, o vėliau serveris patvirtino `session_id_not_found`. Tai nėra bendras tikslumo įvertis: imtis maža, o originalus garsas buvo sintetinis. V3 pakartotinai tikrinti du paskutiniai probleminiai Live scenarijai, ne visi įmanomi dialogai.

Pilni vietiniai rezultatai ir WAV failai yra ignoruojamuose `data/analysis/live-eval-2026-09-16T15-04-44.019Z/` ir `data/analysis/live-eval-2026-09-16T15-08-21.779Z/`. Mokamą bandymą galima pakartoti su `node --import tsx scripts/evaluate-live.mjs`.

## Ekranai

Visi vaizdai naudoja sintetinius dialogus. Kortelės santraukos vaizdas yra UI maketas su imituotu atsakymu; tikros santraukos rezultatai aprašyti aukščiau.

- [Pradžia, 390 × 640](home-390x640.png)
- [Vertimas sumažintame lange](live-390x640.png)
- [Pasirinkta frazė](selected-390x844.png)
- [Rodomas tekstas ir įjungtas klausymas](show-and-listen-390x844.png)
- [Susitarimo užrašas](recap-390x844.png)
- [Baigtas pokalbis](ended-390x640.png)

## Liekantys praktiniai patikrinimai

Fiziniame iPhone ir Android dar verta išbandyti telefono garsiakalbį, Bluetooth maršrutą, aidą, du vienu metu kalbančius žmones ir triukšmingą aplinką. WebKit emuliacija ir sintetinė API įvestis nepakeičia šio bandymo. Modelio vertimai ir pirminės antraštės gali klysti; citatos patikra patvirtina citatos buvimą, ne jos teisingumą ar visų išvadų pagrįstumą.

Naudota oficiali dokumentacija: [Live sesijų valdymas ir instrukcijų papildymas](https://developers.openai.com/api/docs/guides/live-conversations), [Live promptai](https://developers.openai.com/api/docs/guides/live-prompting), [WebRTC](https://developers.openai.com/api/docs/guides/voice-webrtc?api=live), [WebSocket garso formatas ir uždarymas](https://developers.openai.com/api/docs/guides/voice-websockets?api=live), [struktūruoti atsakymai](https://developers.openai.com/api/docs/guides/structured-outputs).
