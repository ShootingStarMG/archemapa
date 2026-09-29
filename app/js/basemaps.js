// Wspólne warstwy bazowe (mapa / satelita) dla wszystkich map Leaflet w appce.
// Esri World Imagery nie wymaga klucza API (tylko atrybucja) — pasuje do
// zasady "appka bez backendu i kluczy API" z CLAUDE.md.
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
    (options.default === 'satelita' ? satelita : mapa).addTo(map);
    L.control.layers({ Mapa: mapa, Satelita: satelita }, null, { position: 'topright' }).addTo(map);
    return { mapa, satelita };
  },
};
