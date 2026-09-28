# archemapa

Aplikacja (PWA) do georeferencji (kalibracji) starych map i zdjęć lotniczych oraz
nakładania ich na współczesne mapy — z użyciem w terenie na telefonie (GPS, offline).
Projekt badawczy/analityczny na własny użytek, nie publikacja dla szerokiej publiki.

## Decyzja architektoniczna

Pierwotnie planowany desktop (QGIS + Georeferencer) — **porzucony**, bo appka musi
działać na telefonie w terenie. Zamiast tego: **własna aplikacja webowa (PWA)**,
w pełni frontendowa (bez backendu), przechowuje dane lokalnie na urządzeniu
(IndexedDB), instalowalna na ekranie głównym telefonu, działa offline po pierwszym
załadowaniu. Hosting: **GitHub Pages** (repo: sprawdź `git remote -v`).

## Struktura katalogów

```
app/                     aplikacja (PWA) — patrz app/README.md (jeśli powstanie) i niżej
  index.html
  manifest.webmanifest   metadane PWA (ikona, nazwa, tryb standalone)
  sw.js                  service worker — cache appki + kafelków mapy na offline
  css/style.css
  js/
    georef.js            matematyka: dopasowanie afiniczne (piksel obrazu -> EPSG:3857),
                          bez zależności od Leaflet — do testowania w Node
    overlay-layer.js      custom warstwa Leaflet renderująca obraz przez CSS matrix()
                          wg transformacji z georef.js
    db.js                 wrapper na IndexedDB (zapisane kalibracje)
    home.js                ekran listy kalibracji
    calibrate.js            ekran kalibracji (dodawanie punktów kontrolnych)
    field.js                 ekran terenowy (nałożenie + GPS)
    app.js                    router (hash-based)
  vendor/leaflet/          Leaflet 1.9.4 wgrany lokalnie (nie z CDN — appka ma działać
                            w pełni offline, bez zależności sieciowych w runtime)
  icons/                    ikony PWA (wygenerowane, do podmiany na docelowe)
dokumentacja/
  workflow_georeferencji.md  instrukcja krok po kroku: kalibracja + użycie w terenie
```

`dane/`, `qgis/`, `skrypty/` z pierwszej wersji projektu (podejście QGIS) — nieużywane,
zostawione na wypadek gdyby ktoś chciał wrócić do desktopowego workflow.

## Jak appka liczy georeferencję (dla przyszłych zmian w kodzie)

1. Użytkownik klika parę punktów: piksel na starej mapie (px,py) + punkt na żywej
   mapie współczesnej (lat,lng).
2. `georef.js` przelicza lat/lng na metry Web Mercator (EPSG:3857, ten sam układ co
   Leaflet) i dopasowuje transformację **afiniczną** (6 parametrów: przesunięcie,
   obrót, skala, ścinanie) metodą najmniejszych kwadratów — min. 3 punkty, więcej =
   dokładniej. Brak obsługi TPS/wielomianów wyższego stopnia (świadome uproszczenie v1).
3. `overlay-layer.js` (custom `L.Layer`) przy każdym ruchu/zoomie mapy liczy, gdzie
   na ekranie wypadają 3 narożniki obrazu, i ustawia `<img>` przez CSS `transform:
   matrix(...)` — stąd obraz renderuje się poprawnie skręcony/przeskalowany na każdym
   poziomie zoomu, bez przeliczania pikseli po stronie JS przy każdej klatce.
4. Kalibracja (obraz jako data URL + punkty + transformacja) zapisywana jest w całości
   w IndexedDB pod jednym rekordem — stąd offline i bez potrzeby backendu.

## Testowanie zmian w kodzie appki

- Matematyka (`georef.js`) da się testować gołym Node.js (nie zależy od `window`/DOM
  poza końcowym `window.Georef = ...`) — patrz przykład w historii sesji: podstawienie
  `global.window = {}` przed `require()`.
- Do testów end-to-end w przeglądarce używany był Playwright (headless Chromium) —
  symulacja: upload pliku, kliknięcia na obrazie/mapie, zapis, otwarcie widoku
  terenowego, mock geolokalizacji przez `context.geolocation`. Nie ma na stałe
  skonfigurowanego test runnera w repo — pisz taki skrypt doraźnie w razie potrzeby.
- Przy zmianach w `overlay-layer.js` warto zrobić zrzut ekranu (Playwright
  `page.screenshot()`) i sprawdzić wizualnie, czy obraz nakłada się poprawnie
  (widoczny skos = afiniczna transformacja działa, nie tylko przesunięcie).

## Zasady pracy

- Appka ma zero zależności backendowych i zero kluczy API — nie dodawaj usług
  wymagających kluczy/rejestracji bez wyraźnej potrzeby (koliduje z celem
  "działa offline w terenie za darmo").
- Leaflet i inne biblioteki wgrywaj lokalnie do `app/vendor/`, nie z CDN — appka ma
  działać bez internetu w terenie.
- Przy niepewności co do georeferencji (brak jasnych punktów odniesienia na starej
  mapie) appka ma to pokazywać wprost (błąd w metrach przy punkcie), nie ukrywać.
