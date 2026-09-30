// Wspólne warstwy bazowe (mapa / satelita / LIDAR) dla wszystkich map Leaflet
// w appce. Esri World Imagery i geoportal.gov.pl nie wymagają kluczy API —
// pasuje do zasady "appka bez backendu i kluczy API" z CLAUDE.md.
// Pokazuje mały znacznik "Ładowanie…", dopóki trwają zapytania danej warstwy —
// bez tego wolno ładujący się LIDAR wygląda jak zawieszony/zepsuty, a nie
// "po prostu wolny serwer".
function wireLoadingBadge(map, layer, label) {
  const badge = L.DomUtil.create('div', 'layer-loading-badge');
  badge.textContent = `Ładowanie: ${label}…`;
  badge.hidden = true;
  map.getContainer().appendChild(badge);
  let safetyTimer = null;
  layer.on('loading', () => {
    badge.hidden = false;
    // zabezpieczenie: gdyby mimo wszystko żaden kafelek nigdy się nie
    // rozstrzygnął (nawet po limicie czasu z wireTileRetry), pasek i tak
    // nie zostanie widoczny w nieskończoność
    clearTimeout(safetyTimer);
    safetyTimer = setTimeout(() => {
      badge.hidden = true;
    }, 20000);
  });
  layer.on('load', () => {
    badge.hidden = true;
    clearTimeout(safetyTimer);
  });
}

function wireTileRetry(layer, maxRetries = 3, delayMs = 1500) {
  const attempts = new Map();
  const pendingTimers = new Map(); // klucz kafelka -> timer limitu czasu (patrz niżej)

  const TIMEOUT_MS = 10000;

  function keyOf(coords) {
    return `${coords.x}:${coords.y}:${coords.z}`;
  }
  function armWatchdog(coords, tile) {
    const key = keyOf(coords);
    clearTimeout(pendingTimers.get(key));
    pendingTimers.set(
      key,
      setTimeout(() => {
        if (!tile.parentNode || tile.classList.contains('leaflet-tile-loaded')) return;
        retry(coords, tile);
      }, TIMEOUT_MS)
    );
  }
  function retry(coords, tile) {
    const key = keyOf(coords);
    const n = (attempts.get(key) || 0) + 1;
    if (n > maxRetries) return;
    attempts.set(key, n);
    setTimeout(() => {
      if (!tile.parentNode) return; // kafelek już zniknął (np. po przewinięciu mapy)
      tile.src = layer.getTileUrl(coords);
      // Ręczne przypisanie .src nie odpala ponownie 'tileloadstart' (to
      // zdarzenie Leaflet emituje tylko przy tworzeniu NOWEGO elementu
      // kafelka), więc bez ponownego uzbrojenia strażnika kolejne zawieszenie
      // tej samej próby przeszłoby niezauważone.
      armWatchdog(coords, tile);
    }, delayMs * n);
  }

  layer.on('tileerror', (err) => {
    clearTimeout(pendingTimers.get(keyOf(err.coords)));
    retry(err.coords, err.tile);
  });

  // Geoportal czasem nie kończy zapytania w ogóle — ani sukcesem, ani błędem
  // (sprawdzone: kafelek potrafi "wisieć" bez końca) — bez własnego limitu
  // czasu takie zapytanie nigdy by się nie doczekało ponowienia, a pasek
  // ładowania zostałby widoczny bez końca (Leaflet czeka na rozstrzygnięcie
  // WSZYSTKICH kafelków, żeby uznać widok za w pełni załadowany).
  layer.on('tileloadstart', (e) => armWatchdog(e.coords, e.tile));
  layer.on('tileload', (e) => clearTimeout(pendingTimers.get(keyOf(e.coords))));
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
    // - minZoom:14 = przy większym oddaleniu trzeba by ładować dużo kafelków
    //   naraz, a każdy może zająć kilka-kilkanaście sekund — łączny czas
    //   oczekiwania rośnie z liczbą kafelków w widoku, więc każemy dojść
    //   bliżej (i tak dane 1m nic by nie wniosły z daleka),
    // - updateWhenZooming:false = nie odpytuj w trakcie animacji zoomu,
    //   tylko po jej zakończeniu,
    // - updateWhenIdle:true = nie odpytuj też w trakcie samego przeciągania
    //   mapy, tylko po puszczeniu — inaczej przy wolnym serwerze każdy ruch
    //   w trakcie przeciągania odpala nowe zapytanie, które i tak zostanie
    //   porzucone, zanim zdąży odpowiedzieć,
    // - keepBuffer:6 = trzyma znacznie więcej już wczytanych sąsiednich
    //   kafelków w pamięci DOM, więc drobne doprecyzowanie widoku nie
    //   zeruje tego, co już się załadowało.
    const lidar = L.tileLayer.wms('https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WMS/ShadedRelief', {
      layers: 'Raster',
      format: 'image/jpeg',
      version: '1.3.0',
      crs: L.CRS.EPSG4326,
      tileSize: 512,
      minZoom: 14,
      maxZoom: 18,
      updateWhenZooming: false,
      updateWhenIdle: true,
      keepBuffer: 6,
      bounds: L.latLngBounds([48.88, 13.78], [54.93, 24.76]), // zasięg danych: Polska
      attribution: 'NMT (LIDAR) © GUGiK',
    });

    // Geoportal bywa niestabilny — pojedyncze kafelki losowo nie odpowiadają
    // (sprawdzone bezpośrednio), a Leaflet domyślnie nie ponawia takich
    // zapytań, więc mapa zostaje z pustymi/szarymi dziurami na stałe. Kilka
    // prób z odstępem naprawia to w praktyce w większości przypadków.
    wireTileRetry(lidar);
    wireLoadingBadge(map, lidar, 'LIDAR');

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
