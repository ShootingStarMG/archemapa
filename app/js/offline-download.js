// Jawne pobranie aktualnie widocznego fragmentu mapy na offline (zamiast
// polegać wyłącznie na tym, co przypadkiem zostało wyświetlone wcześniej).
// Celowo ograniczone do bieżącego zoomu i tego, co Leaflet aktualnie renderuje
// (layer._tiles) — to prosty, przewidywalny zakres (dziesiątki kafelków, nie
// tysiące), zgodny z zasadami "fair use" darmowych serwisów kafelkowych
// (OSM/Esri/geoportal wprost zabraniają masowego pobierania — to nie jest to).
const OfflineDownload = {
  // `getActiveLayer()` musi zwrócić bieżącą warstwę kafelkową (patrz
  // Basemaps.trackActiveLayer w basemaps.js).
  async downloadVisible(map, getActiveLayer, onProgress) {
    const layer = getActiveLayer();
    if (!layer || !layer._tiles) return { done: 0, total: 0 };
    const coordsList = Object.values(layer._tiles).map((t) => t.coords);
    let done = 0;
    for (const coords of coordsList) {
      try {
        await fetch(layer.getTileUrl(coords));
      } catch (err) {
        // brak sieci albo błąd pojedynczego kafelka — nie przerywamy reszty
      }
      done++;
      onProgress(done, coordsList.length);
    }
    return { done, total: coordsList.length };
  },
};
