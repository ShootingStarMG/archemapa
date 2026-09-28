const Calibrate = {
  async render(root) {
    const state = {
      imageDataUrl: null,
      imageEl: null,
      naturalWidth: 0,
      naturalHeight: 0,
      displayScale: 1, // mnożnik względem naturalWidth
      points: [], // {id, px, py, lat, lng}
      pendingImagePoint: null, // {px, py} — czeka na kliknięcie na mapie
      transform: null,
      previewLayer: null,
      calibMap: null,
      pointMarkersOnMap: {}, // id -> L.Marker
    };

    root.innerHTML = `
      <header class="topbar">
        <button class="icon" id="btn-back">←</button>
        <h1>Nowa kalibracja</h1>
        <button class="primary" id="btn-save" disabled>Zapisz</button>
      </header>
      <div class="banner" id="banner">Wybierz zdjęcie/skan starej mapy lub zdjęcia lotniczego.</div>
      <main id="calib-main" style="display:flex; flex-direction:column; min-height:0; flex:1;">
        <div id="upload-step" class="step">
          <input type="file" id="file-input" accept="image/*" style="display:none" />
          <button class="primary" id="btn-pick">Wybierz plik…</button>
          <div class="hint">JPG, PNG lub podobny skan/zdjęcie. Im wyższa rozdzielczość, tym dokładniejsza kalibracja.</div>
        </div>
      </main>
    `;

    document.getElementById('btn-back').onclick = () => {
      if (state.points.length > 0 && !confirm('Odrzucić tę kalibrację? Niezapisane punkty zostaną utracone.')) return;
      location.hash = '#/';
    };
    document.getElementById('btn-pick').onclick = () => document.getElementById('file-input').click();
    document.getElementById('file-input').onchange = (e) => Calibrate._onFile(e, state);

    Calibrate._state = state;
  },

  _onFile(e, state) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      state.imageDataUrl = reader.result;
      const img = new Image();
      img.onload = () => {
        state.naturalWidth = img.naturalWidth;
        state.naturalHeight = img.naturalHeight;
        Calibrate._buildWorkspace(state);
      };
      img.src = state.imageDataUrl;
    };
    reader.readAsDataURL(file);
  },

  _buildWorkspace(state) {
    const main = document.getElementById('calib-main');
    main.innerHTML = `
      <div class="calib-image-wrap" id="img-wrap">
        <img id="calib-img" src="${state.imageDataUrl}" />
        <div class="points-layer" id="points-layer"></div>
      </div>
      <div class="toolbar">
        <button class="icon" id="btn-zoom-out">−</button>
        <button class="icon" id="btn-zoom-in">+</button>
        <span class="hint" style="color:var(--text-dim); font-size:12px;">powiększ, by dokładnie kliknąć punkt</span>
      </div>
      <div id="calib-map"></div>
      <div class="points-panel" id="points-panel"></div>
      <div class="toolbar">
        <input type="text" id="name-input" placeholder="Nazwa (np. 1935 Chorzele — mapa topo)" />
      </div>
    `;
    document.getElementById('banner').textContent =
      'Kliknij charakterystyczny punkt na starej mapie (np. skrzyżowanie, kościół), potem ten sam punkt na mapie poniżej.';

    const imgEl = document.getElementById('calib-img');
    state.imageEl = imgEl;

    // dopasuj początkowy rozmiar do szerokości ekranu
    const wrapWidth = document.getElementById('img-wrap').clientWidth;
    state.displayScale = Math.min(1, (wrapWidth || state.naturalWidth) / state.naturalWidth);
    Calibrate._applyImgScale(state);

    document.getElementById('img-wrap').addEventListener('click', (ev) => Calibrate._onImageClick(ev, state));
    document.getElementById('btn-zoom-in').onclick = () => {
      state.displayScale = Math.min(state.displayScale * 1.4, 4);
      Calibrate._applyImgScale(state);
      Calibrate._redrawImagePoints(state);
    };
    document.getElementById('btn-zoom-out').onclick = () => {
      state.displayScale = Math.max(state.displayScale / 1.4, 0.05);
      Calibrate._applyImgScale(state);
      Calibrate._redrawImagePoints(state);
    };
    document.getElementById('name-input').addEventListener('input', () => Calibrate._updateSaveEnabled(state));

    // mapa współczesna
    const map = L.map('calib-map');
    state.calibMap = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    map.setView([52.0, 20.0], 6);
    // Leaflet mierzy kontener przy tworzeniu; nasz layout dogrywa się (obrazek,
    // czcionki) chwilę później, więc bez tego mapa bywa błędnie wyskalowana
    // (np. wygląda jakby była wyzoomowana na całą Europę).
    requestAnimationFrame(() => map.invalidateSize());
    window.addEventListener('resize', () => map.invalidateSize());
    navigator.geolocation?.getCurrentPosition(
      (pos) => map.setView([pos.coords.latitude, pos.coords.longitude], 13),
      () => {},
      { timeout: 3000 }
    );
    map.on('click', (ev) => Calibrate._onMapClick(ev, state));

    document.getElementById('btn-save').onclick = () => Calibrate._onSave(state);
  },

  _applyImgScale(state) {
    const w = state.naturalWidth * state.displayScale;
    const h = state.naturalHeight * state.displayScale;
    state.imageEl.style.width = w + 'px';
    state.imageEl.style.height = h + 'px';
    const layer = document.getElementById('points-layer');
    layer.style.width = w + 'px';
    layer.style.height = h + 'px';
  },

  _onImageClick(ev, state) {
    const rect = state.imageEl.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    const px = (x / rect.width) * state.naturalWidth;
    const py = (y / rect.height) * state.naturalHeight;
    state.pendingImagePoint = { px, py };
    Calibrate._redrawImagePoints(state);
    document.getElementById('banner').textContent =
      'Teraz kliknij ten sam punkt na mapie współczesnej poniżej.';
  },

  _onMapClick(ev, state) {
    if (!state.pendingImagePoint) {
      document.getElementById('banner').textContent =
        'Najpierw kliknij punkt na starej mapie powyżej, potem tutaj.';
      return;
    }
    const id = 'p' + Date.now() + Math.random().toString(36).slice(2, 6);
    const point = {
      id,
      px: state.pendingImagePoint.px,
      py: state.pendingImagePoint.py,
      lat: ev.latlng.lat,
      lng: ev.latlng.lng,
    };
    state.points.push(point);
    state.pendingImagePoint = null;

    const idx = state.points.length;
    const marker = L.marker(ev.latlng, {
      icon: L.divIcon({ className: '', html: `<div class="point-marker">${idx}</div>`, iconSize: [22, 22] }),
    }).addTo(state.calibMap);
    state.pointMarkersOnMap[id] = marker;

    Calibrate._recompute(state);
  },

  _redrawImagePoints(state) {
    const layer = document.getElementById('points-layer');
    const scale = state.displayScale;
    const all = state.points.map((p, i) => ({ ...p, num: i + 1, pending: false }));
    if (state.pendingImagePoint) {
      all.push({ ...state.pendingImagePoint, num: '?', pending: true });
    }
    layer.innerHTML = all
      .map(
        (p) => `<div class="point-marker${p.pending ? ' pending' : ''}" style="left:${p.px * scale}px; top:${p.py * scale}px;">${p.num}</div>`
      )
      .join('');
  },

  _recompute(state) {
    Calibrate._redrawImagePoints(state);
    Calibrate._renderPointsPanel(state);

    const banner = document.getElementById('banner');
    const n = state.points.length;

    if (n >= 3) {
      try {
        state.transform = Georef.computeAffine(state.points);
        Calibrate._updatePreview(state);
        banner.textContent = 'Możesz dodać kolejne punkty (więcej = dokładniej) albo zapisać kalibrację.';
      } catch (err) {
        state.transform = null;
        if (state.previewLayer) {
          state.calibMap.removeLayer(state.previewLayer);
          state.previewLayer = null;
        }
        banner.textContent = '⚠ ' + err.message + ' Usuń jeden z punktów i dodaj go w innym miejscu.';
      }
    } else {
      state.transform = null;
      if (state.previewLayer) {
        state.calibMap.removeLayer(state.previewLayer);
        state.previewLayer = null;
      }
      banner.textContent =
        n === 0
          ? 'Kliknij charakterystyczny punkt na starej mapie (np. skrzyżowanie, kościół), potem ten sam punkt na mapie poniżej.'
          : `Dodano ${n} ${n === 1 ? 'punkt' : 'punkty'}. Potrzeba minimum 3 — kliknij kolejny na starej mapie.`;
    }
    Calibrate._updateSaveEnabled(state);
  },

  _updatePreview(state) {
    if (!state.transform) return;
    if (state.previewLayer) state.calibMap.removeLayer(state.previewLayer);
    state.previewLayer = L.affineImageOverlay(state.imageDataUrl, state.naturalWidth, state.naturalHeight, state.transform, {
      opacity: 0.55,
    });
    state.previewLayer.addTo(state.calibMap);
  },

  _renderPointsPanel(state) {
    const panel = document.getElementById('points-panel');
    if (state.points.length === 0) {
      panel.innerHTML = '';
      return;
    }
    let residuals = null;
    if (state.transform) {
      residuals = Georef.computeResiduals(state.transform, state.points);
    }
    const rows = state.points
      .map((p, i) => {
        const err = residuals ? residuals[i] : null;
        const errCell = err == null ? '—' : `<td class="${err < 30 ? 'err-ok' : 'err-bad'}">${err.toFixed(1)} m</td>`;
        return `<tr>
          <td>${i + 1}</td>
          <td>${p.px.toFixed(0)}, ${p.py.toFixed(0)}</td>
          <td>${p.lat.toFixed(5)}, ${p.lng.toFixed(5)}</td>
          ${errCell}
          <td><button class="danger icon btn-del-pt" data-id="${p.id}">✕</button></td>
        </tr>`;
      })
      .join('');
    panel.innerHTML = `
      <table>
        <thead><tr><th>#</th><th>px na mapie</th><th>lat, lng</th><th>błąd</th><th></th></tr></thead>
        <tbody>${rows}</tbody>
      </table>`;
    panel.querySelectorAll('.btn-del-pt').forEach((btn) => {
      btn.onclick = () => {
        const id = btn.dataset.id;
        const marker = state.pointMarkersOnMap[id];
        if (marker) state.calibMap.removeLayer(marker);
        delete state.pointMarkersOnMap[id];
        state.points = state.points.filter((p) => p.id !== id);
        Calibrate._recompute(state);
      };
    });
  },

  _updateSaveEnabled(state) {
    const name = document.getElementById('name-input')?.value.trim();
    document.getElementById('btn-save').disabled = !(name && state.transform);
  },

  async _onSave(state) {
    const name = document.getElementById('name-input').value.trim();
    if (!name || !state.transform) return;
    const record = {
      id: 'k' + Date.now() + Math.random().toString(36).slice(2, 6),
      name,
      createdAt: Date.now(),
      imageDataUrl: state.imageDataUrl,
      imageWidth: state.naturalWidth,
      imageHeight: state.naturalHeight,
      controlPoints: state.points,
      transform: state.transform,
    };
    await KalibracjeDB.saveKalibracja(record);
    location.hash = '#/';
  },
};
