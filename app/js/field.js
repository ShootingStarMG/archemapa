const Field = {
  async render(root, id) {
    const rec = await KalibracjeDB.getKalibracja(id);
    if (!rec) {
      root.innerHTML = `<div class="empty-state">Nie znaleziono kalibracji.</div>`;
      return;
    }

    root.innerHTML = `
      <header class="topbar">
        <button class="icon" id="btn-back">←</button>
        <h1>${escapeHtml(rec.name)}</h1>
      </header>
      <div class="slider-row">
        <label>Widoczność</label>
        <input type="range" id="opacity" min="0" max="100" value="70" />
      </div>
      <div class="field-map-container">
        <div id="field-map"></div>
        <div class="gps-badge" id="gps-badge">GPS: szukam sygnału…</div>
        <div class="field-controls">
          <button class="icon" id="btn-locate" title="Wyśrodkuj na mojej pozycji">◎</button>
        </div>
      </div>
    `;

    document.getElementById('btn-back').onclick = () => {
      location.hash = '#/';
    };

    const map = L.map('field-map', { zoomControl: true });
    Basemaps.add(map);
    requestAnimationFrame(() => map.invalidateSize());
    window.addEventListener('resize', () => map.invalidateSize());

    const overlay = L.affineImageOverlay(rec.imageDataUrl, rec.imageWidth, rec.imageHeight, rec.transform, {
      opacity: 0.7,
    });
    overlay.addTo(map);

    // ustaw widok tak, by objąć nałożoną mapę
    const corners = [
      [0, 0],
      [rec.imageWidth, 0],
      [rec.imageWidth, rec.imageHeight],
      [0, rec.imageHeight],
    ].map(([px, py]) => {
      const ll = Georef.pixelToLatLng(rec.transform, px, py);
      return [ll.lat, ll.lng];
    });
    map.fitBounds(corners, { padding: [20, 20] });

    document.getElementById('opacity').addEventListener('input', (e) => {
      overlay.setOpacity(e.target.value / 100);
    });

    // pozycja GPS ("niebieska kropka")
    let gpsMarker = null;
    let gpsCircle = null;
    const badge = document.getElementById('gps-badge');

    map.on('locationfound', (e) => {
      badge.textContent = `GPS: dokładność ±${Math.round(e.accuracy)} m`;
      badge.classList.add('active');
      if (!gpsMarker) {
        gpsMarker = L.circleMarker(e.latlng, {
          radius: 8,
          color: '#fff',
          weight: 2,
          fillColor: '#4fb3ff',
          fillOpacity: 1,
        }).addTo(map);
        gpsCircle = L.circle(e.latlng, { radius: e.accuracy, color: '#4fb3ff', weight: 1, fillOpacity: 0.1 }).addTo(map);
      } else {
        gpsMarker.setLatLng(e.latlng);
        gpsCircle.setLatLng(e.latlng);
        gpsCircle.setRadius(e.accuracy);
      }
    });
    map.on('locationerror', (e) => {
      badge.textContent = 'GPS: brak sygnału (' + e.message + ')';
      badge.classList.remove('active');
    });
    map.locate({ watch: true, enableHighAccuracy: true, maximumAge: 5000 });

    document.getElementById('btn-locate').onclick = () => {
      if (gpsMarker) {
        map.setView(gpsMarker.getLatLng(), Math.max(map.getZoom(), 16));
      }
    };

    Field._map = map;
  },
};
