# archemapa

Aplikacja (PWA) do kalibracji (georeferencji) starych map i zdjęć lotniczych oraz
nakładania ich na współczesne mapy — z użyciem w terenie na telefonie (żywa pozycja
GPS, działanie offline po pierwszym załadowaniu).

Pełne instrukcje: [CLAUDE.md](CLAUDE.md) (architektura, konwencje) oraz
[dokumentacja/workflow_georeferencji.md](dokumentacja/workflow_georeferencji.md)
(krok po kroku: kalibracja i praca w terenie).

## Szybki start

**Lokalnie (testowanie na komputerze):**
```
cd app && python3 -m http.server 8765
```
i otwórz `http://localhost:8765`.

**Na telefonie:** appka jest wystawiona przez GitHub Pages — otwórz link w Safari/
Chrome i użyj „Dodaj do ekranu głównego”, żeby zainstalować jak natywną appkę.
(Link znajdziesz w ustawieniach repo → Pages, albo zapytaj — bywa wklejony w
historii sesji, w której appka powstała.)

## Jak to działa

1. **Kalibracja**: wgrywasz skan starej mapy, klikasz min. 3 pary punktów
   (ten sam punkt na starej mapie i na współczesnej), appka liczy dopasowanie
   i pokazuje błąd przy każdym punkcie.
2. **Teren**: otwierasz zapisaną kalibrację, widzisz starą mapę nałożoną na
   współczesną z suwakiem przezroczystości i niebieską kropką Twojej pozycji GPS.

Wszystko działa lokalnie na urządzeniu — appka nie ma backendu ani nie wysyła
danych na żaden serwer.
