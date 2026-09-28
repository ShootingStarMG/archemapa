# Workflow: kalibracja i użycie w terenie (appka `app/`)

## 1. Uruchomienie appki

Appka to statyczna strona (HTML/CSS/JS, bez etapu budowania) — można ją:

- **Testować na komputerze**: `cd app && python3 -m http.server 8765`, potem otwórz
  `http://localhost:8765` w przeglądarce.
- **Zainstalować na telefonie**: wystaw folder `app/` pod dowolnym adresem HTTPS
  (patrz sekcja Hosting w [CLAUDE.md](../CLAUDE.md)), otwórz w Safari/Chrome na
  telefonie, użyj „Dodaj do ekranu głównego” — appka działa wtedy jak natywna,
  pełnoekranowo, i offline (po pierwszym załadowaniu).

## 2. Kalibracja nowej mapy

1. Na ekranie głównym appki dotknij **„+ Nowa kalibracja”**.
2. Wybierz plik ze skanem starej mapy / zdjęciem lotniczym (z Plików albo Zdjęć
   na telefonie).
3. U góry pojawi się stara mapa, u dołu żywa mapa współczesna (OpenStreetMap):
   - Kliknij/dotknij charakterystyczny punkt na starej mapie (skrzyżowanie,
     kościół, róg budynku).
   - Zaraz potem kliknij **ten sam punkt** na mapie współczesnej poniżej
     (można ją przesuwać/przybliżać jak zwykłą mapę).
   - Powtórz dla min. **3 punktów**, rozproszonych po całym obszarze mapy
     (nie w jednym rogu) — im więcej i dalej od siebie, tym dokładniej.
4. Po 3. punkcie appka od razu liczy dopasowanie i pokazuje **podgląd nałożenia**
   na mapie współczesnej oraz **błąd (m)** przy każdym punkcie w tabeli — duży
   błąd przy jednym punkcie względem innych sugeruje pomyłkę (usuń go i dodaj
   ponownie, dokładniej).
5. Użyj przycisków **„−” / „+”** nad starą mapą, żeby przybliżyć obraz i kliknąć
   punkt precyzyjnie (ważne przy dużych skanach).
6. Nadaj nazwę (np. `1935 Chorzele — mapa topo`) i dotknij **„Zapisz”**.

Kalibracja zapisuje się lokalnie na urządzeniu (IndexedDB) — działa offline,
nic nie wysyła na żaden serwer.

## 3. Praca w terenie

1. Z ekranu głównego wybierz zapisaną kalibrację → **„Otwórz w terenie”**.
2. Appka pokazuje starą mapę nałożoną na współczesną, z **niebieską kropką**
   Twojej pozycji GPS (i okręgiem dokładności).
3. Suwak **„Widoczność”** u góry reguluje przezroczystość starej mapy — przesuń
   w lewo, żeby porównać z terenem pod spodem.
4. Przycisk **◎** (dolny prawy róg) centruje mapę na Twojej pozycji.

### Offline w terenie

Appka cache'uje kafelki mapy współczesnej, które już wcześniej zobaczyłaś na
danym urządzeniu — **przed wyjazdem w teren otwórz appkę w miejscu z zasięgiem
i przybliż/oddal/pomigraj po interesującym Cię obszarze**, żeby kafelki się
zapisały lokalnie. Sama nałożona stara mapa i pozycja GPS działają offline
zawsze (są zapisane lokalnie / liczone przez telefon), bez wyjątków.

## 4. Ograniczenia v1 (do rozbudowy w razie potrzeby)

- Nie da się edytować punktów kontrolnych po zapisaniu kalibracji — trzeba
  zrobić nową. (Do dodania: ekran edycji.)
- Transformacja jest wyłącznie afiniczna (przesunięcie/obrót/skalowanie/ścinanie)
  — dobra dla większości map topograficznych, ale nie skoryguje lokalnych
  zniekształceń papieru tak dobrze jak TPS. Jeśli dopasowanie kuleje w jednym
  rejonie mapy, na razie jedyna opcja to dodać więcej punktów kontrolnych
  blisko tego rejonu (poprawi to dopasowanie lokalnie tylko trochę, bo cała
  transformacja jest jedna dla całego obrazu).
- Offline działa tylko dla kafelków już wcześniej wyświetlonych na danym
  telefonie (nie ma pre-pobierania całego regionu).
