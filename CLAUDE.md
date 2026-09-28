# archemapa

Narzędzie do georeferencji (kalibracji) starych map i zdjęć lotniczych oraz nakładania ich
na współczesne mapy. Projekt badawczy/analityczny — nie publikacja online.

## Stos technologiczny

- **QGIS** (Georeferencer) — kalibracja rastrów, wyznaczanie punktów kontrolnych (GCP),
  transformacje (najczęściej wielomianowa 1–3 stopnia lub TPS przy mocno zniekształconych mapach).
- **GDAL** — silnik pod spodem (warp, reprojekcja, informacje o rastrach). Dostępny też
  z linii poleceń (`gdalinfo`, `gdalwarp`, `gdal_translate`) i z Pythona (`osgeo`, `rasterio`).
- Układ współrzędnych roboczy: **EPSG:2180** (PL-1992, oficjalny polski układ, metryczny,
  dobry do pomiarów). Do porównań z mapami internetowymi (OSM, Google) używać EPSG:3857/4326
  na etapie wizualizacji.

## Struktura katalogów

```
dane/
  zrodlowe/            surowe skany/zdjęcia — NIEZMIENIane, punkt wyjścia (poza git, duże pliki)
  zgeoreferencowane/   wynikowe GeoTIFF po kalibracji (poza git, duże pliki)
  punkty_kontrolne/    pliki .points z QGIS Georeferencer — W GIT (małe, tekstowe, warto wersjonować)
qgis/                  projekty QGIS (.qgz)
dokumentacja/          instrukcje procesu, notatki
skrypty/               ewentualna automatyzacja (Python/GDAL)
```

`dane/zrodlowe/` i `dane/zgeoreferencowane/` są w `.gitignore` — to duże pliki binarne,
git by się nimi zapchał. W repo śledzimy tylko strukturę, punkty kontrolne i dokumentację.

## Konwencja nazewnictwa plików

`RRRR_nazwa-obszaru_typ.rozszerzenie`, np.:
- `1935_chorzele_mapa-topo.tif` (źródłowy skan)
- `1935_chorzele_mapa-topo_georef.tif` (po kalibracji)
- `1935_chorzele_mapa-topo.points` (punkty kontrolne QGIS)

Rok = rok powstania oryginału (jeśli nieznany dokładnie, przybliżenie z dopiskiem `ok` np. `1935ok`).

## Workflow kalibracji — patrz [dokumentacja/workflow_georeferencji.md](dokumentacja/workflow_georeferencji.md)

## Kontekst

Projekt powiązany z research'em historycznym wokół Chorzel (por. projekt książkowy "Na nowiu",
Stella Olgierd) — patrz pamięć Claude z innych projektów. Stare mapy/zdjęcia lotnicze mogą
dotyczyć tego obszaru, ale narzędzie ma być generyczne, nie ograniczone do jednej lokalizacji.

## Zasady pracy

- Nie commitować dużych plików rastrowych (skanów, GeoTIFF) — tylko struktura i punkty kontrolne.
- Przy niepewności co do georeferencji (brak jasnych punktów odniesienia na starej mapie) —
  zaznaczać to wprost, nie zgadywać współrzędnych.
