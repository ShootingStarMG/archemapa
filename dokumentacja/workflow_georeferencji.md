# Workflow: kalibracja starej mapy / zdjęcia lotniczego w QGIS

## 0. Przygotowanie

1. Zeskanowaną mapę lub zdjęcie lotnicze wrzuć do `dane/zrodlowe/`, nazwane wg konwencji
   z [CLAUDE.md](../CLAUDE.md) (np. `1935_chorzele_mapa-topo.tif`).
2. Skan powinien być możliwie wysokiej rozdzielczości i bez przycięcia marginesów z ew.
   siatką współrzędnych/ramką mapy — łatwiej o precyzyjne punkty kontrolne.
3. Otwórz/utwórz projekt QGIS w `qgis/` (np. `archemapa.qgz`), ustaw układ współrzędnych
   projektu na **EPSG:2180**.
4. Dodaj warstwę referencyjną współczesną — najprościej wtyczka **QuickMapServices**
   (menu Wtyczki → Zarządzaj wtyczkami → zainstaluj) i dodaj np. OpenStreetMap jako tło.

## 1. Georeferencer — kalibracja

1. Menu **Raster → Georeferencer** (lub Warstwa → Georeferencer w starszych wersjach QGIS).
2. **Plik → Otwórz raster** — wskaż skan z `dane/zrodlowe/`.
3. Dodawaj punkty kontrolne (**Dodaj punkt**): klikasz charakterystyczny, rozpoznawalny
   obiekt na starej mapie (skrzyżowanie dróg, kościół, róg budynku, punkt siatki kilometrowej),
   potem podajesz jego współrzędne we współczesnym układzie:
   - **Z mapy referencyjnej** — jeśli widać ten sam obiekt na warstwie OSM w tle głównego
     okna QGIS (najwygodniejsze i najdokładniejsze przy punktach terenowych).
   - **Wpisz X/Y ręcznie** — gdy znasz dokładne współrzędne (np. z siatki na starej mapie,
     osnowy geodezyjnej, danych archiwalnych).
4. Minimum punktów zależy od transformacji (patrz niżej) — praktycznie zbieraj **10+**
   dobrze rozproszonych po całym obszarze mapy, nie skupionych w jednym rogu.
5. Zapisz punkty: **Plik → Zapisz punkty GCP jako...** → do `dane/punkty_kontrolne/`
   pod nazwą zgodną z konwencją (`.points`). To pozwala wrócić i poprawić kalibrację później.

## 2. Wybór transformacji

- **Wielomianowa 1. stopnia (affine)** — mapa niezniekształcona, tylko przesunięta/obrócona/
  przeskalowana. Rzadko wystarcza przy starych, ręcznie rysowanych mapach.
- **Wielomianowa 2–3 stopnia** — koryguje też deformacje papieru/skanu. Dobry domyślny wybór
  dla map topograficznych sprzed XX w. Wymaga więcej punktów (min. 6 dla st. 2, 10 dla st. 3).
- **TPS (Thin Plate Spline)** — najbardziej elastyczna, dopasowuje lokalnie punkt po punkcie.
  Dobra dla mocno zniekształconych/pogniecionych skanów lub zdjęć lotniczych z dystorsją
  obiektywu. Ryzyko: przy błędnym punkcie kontrolnym może mocno "wykrzywić" okolicę.
- **Zdjęcia lotnicze** — jeśli dysponujesz parametrami kamery/lotu, rozważ ortorektyfikację
  zamiast prostego georeferencera (dokładniejsze przy terenie o dużej rzeźbie). W praktyce
  do analiz historycznych zwykle wystarczy TPS lub wielomian 2. stopnia.

Ustaw też **metodę resamplingu** (Najbliższy sąsiad / Dwuliniowa / Sześcienna) —
dwuliniowa jest zwykle dobrym kompromisem jakość/ostrość.

## 3. Eksport

1. **Ustawienia transformacji**: wskaż plik wyjściowy w `dane/zgeoreferencowane/`
   (`..._georef.tif`), format GeoTIFF, kompresja LZW (oszczędza miejsce).
2. Uruchom transformację (**Start georeferencji**).
3. Sprawdź wynik w głównym oknie QGIS — nałóż wynikowy raster na warstwę OSM,
   oceń wizualnie dopasowanie (drogi, cieki wodne, granice).
4. Jeśli dopasowanie kuleje w jakimś rejonie — wróć do Georeferencera, dodaj punkty
   kontrolne w tym rejonie, powtórz eksport.

## 4. Ocena jakości kalibracji

- QGIS Georeferencer pokazuje **błąd resztkowy (residual)** przy każdym punkcie —
  duże odchylenie (kilkukrotnie większe niż pozostałe) sugeruje błąd w punkcie
  (złe współrzędne albo pomyłka w rozpoznaniu obiektu na starej mapie).
- Przy niepewnych/nieczytelnych fragmentach starej mapy — nie zgadywać punktów kontrolnych.
  Lepiej zostawić dany obszar słabiej skalibrowany i odnotować to w nazwie/notatce niż
  wymusić fałszywą precyzję.

## 5. Dalsza praca

- W QGIS można teraz nakładać warstwy: przezroczystość (Właściwości warstwy → Przezroczystość),
  porównanie side-by-side (wtyczka **MapSwipe Tool** — suwak odsłaniający jedną warstwę pod drugą).
- Pomiary, digitalizacja obiektów ze starej mapy jako osobne warstwy wektorowe (.gpkg)
  w `dane/zgeoreferencowane/` lub osobnym katalogu roboczym.
