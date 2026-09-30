// Wspólne warstwy bazowe (mapa / satelita / LIDAR) dla wszystkich map Leaflet
// w appce. Esri World Imagery i geoportal.gov.pl nie wymagają kluczy API —
// pasuje do zasady "appka bez backendu i kluczy API" z CLAUDE.md.
function wireTileRetry(layer, maxRetries = 3, delayMs = 1500) {
  const attempts = new Map();
  layer.on('tileerror', (err) => {
    const key = `${err.coords.x}:${err.coords.y}:${err.coords.z}`;
    const n = (attempts.get(key) || 0) + 1;
    if (n > maxRetries) return;
    attempts.set(key, n);
    setTimeout(() => {
      if (!err.tile.parentNode) return; // kafelek już zniknął (np. po przewinięciu mapy)
      err.tile.src = layer.getTileUrl(err.coords);
    }, delayMs * n);
  });
}

const Basemaps = {
  add(map, options = {}) {
    const mapa = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    });
    const satelita = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      { maxZoom: 19, attribution: 'Tiles © Esri' }
    );
    // Cieniowanie NMT (numeryczny model terenu) z danych LIDAR — polski
    // geoportal, darmowe, bez klucza. Serwis WMS udostępnia tylko
    // EPSG:4326/2180 (nie 3857, którego używa Leaflet/mapa) — `crs` każe
    // Leafletowi przeliczać BBOX każdego kafelka do EPSG:4326 przy zapytaniu,
    // nadal renderując wynik jako zwykły kafelek XYZ na mapie.
    //
    // Serwis renderuje każdy kafelek "na żywo" (nie ma gotowej piramidy
    // kafelków jak OSM/Esri) i bywa bardzo wolny/niestabilny (sprawdzone:
    // pojedynczy kafelek 8+ sekund, czasem timeout) — to ograniczenie
    // darmowego serwisu rządowego, nie da się tego w pełni obejść. Poniższe
    // ustawienia tylko ograniczają liczbę i częstotliwość zapytań:
    // - tileSize:512 = 4x mniej zapytań dla tego samego obszaru,
    // - minZoom = nie próbuj renderować całej Polski naraz (i tak dane 1m
    //   nic by tam nie wniosły),
    // - updateWhenZooming:false = nie odpytuj w trakcie animacji zoomu,
    //   tylko po jej zakończeniu.
    const lidar = L.tileLayer.wms('https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WMS/ShadedRelief', {
      layers: 'Raster',
      format: 'image/jpeg',
      version: '1.3.0',
      crs: L.CRS.EPSG4326,
      tileSize: 512,
      minZoom: 12,
      maxZoom: 18,
      updateWhenZooming: false,
      keepBuffer: 1,
      bounds: L.latLngBounds([48.88, 13.78], [54.93, 24.76]), // zasięg danych: Polska
      attribution: 'NMT (LIDAR) © GUGiK',
    });

    // Geoportal bywa niestabilny — pojedyncze kafelki losowo nie odpowiadają
    // (sprawdzone bezpośrednio), a Leaflet domyślnie nie ponawia takich
    // zapytań, więc mapa zostaje z pustymi/szarymi dziurami na stałe. Kilka
    // prób z odstępem naprawia to w praktyce w większości przypadków.
    wireTileRetry(lidar);

    const layers = { mapa, satelita, lidar };
    let active = layers[options.default] || mapa;
    active.addTo(map);
    L.control.layers({ Mapa: mapa, Satelita: satelita, 'LIDAR (cieniowanie)': lidar }, null, { position: 'topright' }).addTo(map);
    map.on('baselayerchange', (e) => {
      active = e.layer;
    });
    layers.getActive = () => active;
    return layers;
  },
};
