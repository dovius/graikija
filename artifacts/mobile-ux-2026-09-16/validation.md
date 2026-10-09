# Mobilus išdėstymas senjorams · 2026-09-16

Mobilus išdėstymas peržiūrėtas ir taisytas penkiais etapais. Funkcijos išliko: pakeista jų vieta, dydis ir pateikimas. Pakeitimai veikia vietiniame serveryje `http://localhost:3000` ir 2026-09-16 paskelbti [italiano.vild.lt](https://italiano.vild.lt). [Diegimo patikra](../deploy-2026-09-16/validation.md).

## Kas pakeista

- Pradžioje trys platūs, vienas po kitu išdėstyti pasirinkimai. Visi telpa ir 320 × 568 ekrane. Matomi mygtukų pavadinimai, o pagalba turi užrašą „Pagalba“.
- Grįžimas į pradžią visur toje pačioje vietoje. Telefone pašalintos pasikartojančios antraštės ir dekoracijos, kurios užimdavo pokalbio vietą.
- Ryškus 64 px aukščio „Pauzė“ mygtukas perkeltas prie mikrofono būsenos, virš pokalbio teksto. Pristabdžius toje pačioje vietoje atsiranda „Klausytis toliau“. Apačioje lieka „Pakartoti“, „Parodyti žmogui“ ir atskiras viso pločio „Baigti pokalbį“. Jie neuždengia teksto. Papildomi veiksmai ir kalbos nustatymai pasiekiami per „Daugiau“.
- Pasirinkta frazė rodoma pagrindinėje skaitymo srityje, nekartojant jos dar vienoje kortelėje. Pasirinkimas lieka nekintanti frazės kopija. Baigus pokalbį, „Tęsti“ ir „Naujas pokalbis“ matomi greta vienoje srityje.
- Nuotraukos keitimas turi aiškų mygtuką ir du įvardytus pasirinkimus. Ilgų atsakymų skaitymas prasideda nuo pirmo sakinio; „Išklausyti“ yra atsakymo pradžioje.
- Atsakymas ir klausimo įvedimas turi atskiras sritis. Sumažėjus matomam ekranui rašymo metu, paslepiama antra informacija ir išlaikomas stabilus „Siųsti“ mygtukas. Pataisyta klaida, kai išdėstymas pasikeisdavo tarp paspaudimo pradžios ir pabaigos.
- Dialoguose atskirai slenka turinys, o uždarymas ir pagrindiniai grįžimo mygtukai lieka vietoje. Rodant itališką frazę, naujas pašnekovo atsakymo vertimas turi atskirą vietą.
- Tekstų dydžiai remiasi `rem`; standartinis įvedimo tekstas yra 18 px, vertimai – 22 px. Pagrindiniai valdikliai ne mažesni kaip 52 px aukščio.

## Patikra

| Patikra | Rezultatas |
| --- | --- |
| `npm run build` su abiem TypeScript konfigūracijomis | Pavyko |
| Visa Playwright patikrų serija po pagrindinio mobiliųjų ekranų perdarymo | **189 / 189** |
| Pakartotos patikros perkėlus pauzę | **81 / 81**; `mobile-ux`, `live-feedback`, `live-improvements`, `layout` |
| Naršyklių projektai | Desktop Chromium, Android Chromium, iPhone WebKit |
| Pradžios ekranas | 320 × 568, 360 × 640, 360 × 800, 375 × 812, 390 × 640, 390 × 844, 430 × 932 |
| Papildomi scenarijai | 150 % tekstas, gulsčias ekranas, 390 × 380 rašymo sritis, ilgas atsakymas, pasirinktų frazių stabilumas, grįžimas į naujausią tekstą, modalų slinkimas |
| Galutinių vaizdų matavimai | 47 Chromium ir 47 WebKit ekranų būsenos; **0 horizontalių išsikišimų** |
| Pokalbio valdymo mygtukai | Po 12 pokalbio būsenų kiekvienoje naršyklėje; visi 42 matuoti mygtukai telpa ekrane, jų aukštis ne mažesnis kaip 60 px |
| Prieinamumas | Esamos ir papildomos axe patikros praėjo; tikrinti kontrastai, valdiklių pavadinimai ir dialogai |
| Vietinis serveris | `/api/health` ir naujas CSS atsako HTTP 200; OpenAI raktas sukonfigūruotas |

Naršyklės testuose naudoti sintetiniai pokalbiai ir imituoti API atsakymai. Šiame etape tikrintas išdėstymas ir veiksmų sąveika; fizinio telefono klaviatūra, mikrofonas ir tikras lauko pokalbis nebuvo testuoti. Ilgas turinys ir padidintas tekstas gali reikalauti slinkimo; tekstas nemažinamas vien tam, kad visas tilptų į vieną ekraną.

## Ekranai

- [Pradžia · 390 × 640](home-390x640.png), [pradžia · 320 × 568](home-320x568.png).
- [Pokalbis · 390 × 640](live-390x640.png), [pokalbis · 320 × 568](live-320x568.png), [pasirinkta frazė mažame ekrane](selected-320x568.png).
- [Pauzė · 320 × 568](paused-320x568.png), [pauzė · 390 × 640](paused-390x640.png).
- [Nuotraukos pasirinkimas](photo-390x640.png), [nuotraukos atsakymas](photo-answer-390x640.png).
- [Patarimo klausimas](assistant-390x640.png), [atsakymas nuo pradžios](assistant-answer-390x640.png), [rašymas sumažėjusioje WebKit srityje](typing-webkit-390x380.png).
- [Papildomi veiksmai](live-menu-390x640.png), [pagalba](help-390x640.png), [pokalbio užrašas](recap-390x640.png).
- [Frazė ir naujas atsakymas](show-reply-390x640.png), [baigtas pokalbis](ended-320x568.png), [kompiuterio pradžia](home-1440x1000.png).

Galutiniai matavimai: [Chromium](geometry.json), [WebKit](geometry-webkit.json). Visos tarpinės peržiūros saugomos ignoruojamame `data/analysis/mobile-ux-2026-09-16/` kataloge. Peržiūras galima pakartoti su `scripts/capture-mobile-ux.ts`, nurodant `QA_BASE_URL`; `QA_BROWSER=webkit` parenka WebKit. Skriptas naudoja imituotus atsakymus ir neatidaro tikro mikrofono.
