# archemapa

Narzędzie do kalibracji (georeferencji) starych map i zdjęć lotniczych oraz nakładania ich
na współczesne mapy, do celów analizy GIS.

Pełne instrukcje pracy: [CLAUDE.md](CLAUDE.md) (konfiguracja projektu, konwencje) oraz
[dokumentacja/workflow_georeferencji.md](dokumentacja/workflow_georeferencji.md)
(krok po kroku proces kalibracji w QGIS).

## Szybki start

1. Zainstaluj QGIS: `brew install --cask qgis` (macOS).
2. Wrzuć skan do `dane/zrodlowe/`.
3. Otwórz QGIS → Raster → Georeferencer → podążaj za
   [instrukcją](dokumentacja/workflow_georeferencji.md).
4. Wynik trafia do `dane/zgeoreferencowane/` jako GeoTIFF gotowy do nałożenia na
   współczesną mapę.
