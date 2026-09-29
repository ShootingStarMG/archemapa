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
      <div class="banner" id="adjust-bar" hidden>
        Tryb przesuwania: przeciągnij starą mapę kursorem albo użyj strzałek (Shift = większy krok).
        <button class="icon" id="btn-adjust-reset">Cofnij zmiany</button>
        <button class="primary" id="btn-adjust-save">Zapisz przesunięcie</button>
      </div>
      <div class="field-map-container">
        <div id="field-map"></div>
        <div class="gps-badge" id="gps-badge">GPS: szukam sygnału…</div>
        <div class="field-controls">
          <button class="icon" id="btn-adjust" title="Przesuń nałożenie ręcznie">✥</button>
          <button class="icon" id="btn-locate" title="Wyśrodkuj na mojej pozycji">◎</button>
        </div>
      </div>
    `;

    const map = L.map('field-map', { zoomControl: true });
    Basemaps.add(map);
    requestAnimationFrame(() => map.invalidateSize());
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    // Kopia robocza transformacji — poprawki ręczne działają na niej, dopóki
    // nie zapiszesz (oryginał w `rec.transform` zostaje nietknięty do porównania/cofnięcia).
    let workingTransform = { ...rec.transform };

    const overlay = L.affineImageOverlay(rec.imageDataUrl, rec.imageWidth, rec.imageHeight, workingTransform, {
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

    // --- Ręczne przesuwanie nałożenia (mysz + strzałki) ---
    function metersPerPixel() {
      const R = 6378137;
      return (2 * Math.PI * R) / (256 * Math.pow(2, map.getZoom()));
    }
    function nudge(dxMeters, dyMeters) {
      workingTransform = { ...workingTransform, c: workingTransform.c + dxMeters, f: workingTransform.f + dyMeters };
      overlay.setTransform(workingTransform);
    }

    let adjustMode = false;
    let drag = null;
    const adjustBar = document.getElementById('adjust-bar');
    const btnAdjust = document.getElementById('btn-adjust');
    const imgEl = overlay._image;

    const onPointerDown = (ev) => {
      if (!adjustMode) return;
      drag = { startX: ev.clientX, startY: ev.clientY, start: { ...workingTransform } };
      map.dragging.disable();
      imgEl.style.cursor = 'grabbing';
      imgEl.setPointerCapture(ev.pointerId);
    };
    const onPointerMove = (ev) => {
      if (!drag) return;
      const mpp = metersPerPixel();
      const dxPx = ev.clientX - drag.startX;
      const dyPx = ev.clientY - drag.startY;
      workingTransform = { ...drag.start, c: drag.start.c + dxPx * mpp, f: drag.start.f - dyPx * mpp };
      overlay.setTransform(workingTransform);
    };
    const endDrag = (ev) => {
      if (!drag) return;
      drag = null;
      map.dragging.enable();
      imgEl.style.cursor = 'grab';
      imgEl.releasePointerCapture(ev.pointerId);
    };
    imgEl.addEventListener('pointerdown', onPointerDown);
    imgEl.addEventListener('pointermove', onPointerMove);
    imgEl.addEventListener('pointerup', endDrag);
    imgEl.addEventListener('pointercancel', endDrag);

    const onKeyDown = (ev) => {
      if (!adjustMode) return;
      const step = (ev.shiftKey ? 10 : 2) * metersPerPixel();
      if (ev.key === 'ArrowLeft') nudge(-step, 0);
      else if (ev.key === 'ArrowRight') nudge(step, 0);
      else if (ev.key === 'ArrowUp') nudge(0, step);
      else if (ev.key === 'ArrowDown') nudge(0, -step);
      else return;
      ev.preventDefault();
    };
    window.addEventListener('keydown', onKeyDown);

    btnAdjust.onclick = () => {
      adjustMode = !adjustMode;
      btnAdjust.classList.toggle('active', adjustMode);
      adjustBar.hidden = !adjustMode;
      overlay.setInteractive(adjustMode);
      // Leaflet domyślnie łapie strzałki do przesuwania mapy i zatrzymuje
      // dalsze propagowanie zdarzenia — bez wyłączenia tego nasz listener
      // na window (do przesuwania nałożenia) nigdy by ich nie dostał.
      if (adjustMode) map.keyboard.disable();
      else map.keyboard.enable();
    };
    document.getElementById('btn-adjust-reset').onclick = () => {
      workingTransform = { ...rec.transform };
      overlay.setTransform(workingTransform);
    };
    document.getElementById('btn-adjust-save').onclick = async () => {
      rec.transform = { ...workingTransform };
      await KalibracjeDB.saveKalibracja(rec);
      adjustBar.textContent = '';
      adjustBar.append('Zapisano przesunięcie.');
      setTimeout(() => {
        if (!adjustMode) return;
        adjustBar.innerHTML =
          'Tryb przesuwania: przeciągnij starą mapę kursorem albo użyj strzałek (Shift = większy krok). ' +
          '<button class="icon" id="btn-adjust-reset">Cofnij zmiany</button> <button class="primary" id="btn-adjust-save">Zapisz przesunięcie</button>';
      }, 1500);
    };

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

    document.getElementById('btn-back').onclick = () => {
      window.removeEventListener('resize', onResize);
      window.removeEventListener('keydown', onKeyDown);
      map.remove();
      location.hash = '#/';
    };

    Field._map = map;
  },
};
