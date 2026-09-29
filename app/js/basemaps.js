// Wspólne warstwy bazowe (mapa / satelita / LIDAR) dla wszystkich map Leaflet
// w appce. Esri World Imagery i geoportal.gov.pl nie wymagają kluczy API —
// pasuje do zasady "appka bez backendu i kluczy API" z CLAUDE.md.
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
    const lidar = L.tileLayer.wms('https://mapy.geoportal.gov.pl/wss/service/PZGIK/NMT/GRID1/WMS/ShadedRelief', {
      layers: 'Raster',
      format: 'image/png',
      version: '1.3.0',
      crs: L.CRS.EPSG4326,
      maxZoom: 18,
      bounds: L.latLngBounds([48.88, 13.78], [54.93, 24.76]), // zasięg danych: Polska
      attribution: 'NMT (LIDAR) © GUGiK',
    });

    const layers = { mapa, satelita, lidar };
    (layers[options.default] || mapa).addTo(map);
    L.control.layers({ Mapa: mapa, Satelita: satelita, 'LIDAR (cieniowanie)': lidar }, null, { position: 'topright' }).addTo(map);
    return layers;
  },
};
