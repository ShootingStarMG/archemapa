// Pomocnicze funkcje do obrotu podglądu starej mapy o wielokrotność 90° w UI
// kalibracji. WAŻNE: obrót dotyczy wyłącznie WIDOKU w tym ekranie — punkty
// kontrolne (state.points) zawsze przechowujemy w oryginalnym układzie pikseli
// obrazu (bez obrotu), więc georef.js / overlay-layer.js / zapis do bazy nie
// muszą nic wiedzieć o obrocie. Konwersja dzieje się na granicy: klik na
// obróconym podglądzie -> RotateUtil.toOriginal(...) przed zapisaniem punktu;
// rysowanie zapisanych punktów -> RotateUtil.toDisplay(...) przed narysowaniem.
const RotateUtil = {
  dims(W, H, rotation) {
    return rotation === 90 || rotation === 270 ? { w: H, h: W } : { w: W, h: H };
  },
  toDisplay(px, py, W, H, rotation) {
    switch (rotation) {
      case 90:
        return { x: H - py, y: px };
      case 180:
        return { x: W - px, y: H - py };
      case 270:
        return { x: py, y: W - px };
      default:
        return { x: px, y: py };
    }
  },
  toOriginal(x, y, W, H, rotation) {
    switch (rotation) {
      case 90:
        return { x: y, y: H - x };
      case 180:
        return { x: W - x, y: H - y };
      case 270:
        return { x: W - y, y: x };
      default:
        return { x, y };
    }
  },
  // renderuje obrócony obraz na canvasie i zwraca data URL — patrz komentarz
  // przy wywołaniu (weryfikacja wzorów w opisie commita/sesji)
  renderCanvas(imgEl, W, H, rotation) {
    const dims = RotateUtil.dims(W, H, rotation);
    const canvas = document.createElement('canvas');
    canvas.width = dims.w;
    canvas.height = dims.h;
    const ctx = canvas.getContext('2d');
    switch (rotation) {
      case 90:
        ctx.translate(dims.w, 0);
        ctx.rotate(Math.PI / 2);
        break;
      case 180:
        ctx.translate(dims.w, dims.h);
        ctx.rotate(Math.PI);
        break;
      case 270:
        ctx.translate(0, dims.h);
        ctx.rotate(-Math.PI / 2);
        break;
    }
    ctx.drawImage(imgEl, 0, 0, W, H);
    return canvas.toDataURL('image/png');
  },
};

const Calibrate = {
  async render(root) {
    const state = {
      imageDataUrl: null, // oryginalny plik — to on trafia do zapisu/nakładki
      origImageEl: null, // wczytany <img> oryginału, do renderowania obróconego podglądu
      naturalWidth: 0,
      naturalHeight: 0,
      rotation: 0, // 0/90/180/270 — tylko podgląd w tym ekranie
      dispWidth: 0,
      dispHeight: 0, // wymiary aktualnie wyświetlanego (ew. obróconego) podglądu
      imageEl: null, // <img> podglądu w panelu kalibracji
      displayScale: 1,
      points: [], // {id, px, py, lat, lng} — px,py zawsze w oryginalnym układzie
      pendingImagePoint: null, // {px, py} w oryginalnym układzie — czeka na klik na mapie
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
        state.origImageEl = img;
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
      <div class="split-workspace">
        <div class="split-pane">
          <div class="pane-toolbar">
            <span class="label">Stara mapa</span>
            <button class="icon" id="btn-rotate-left" title="Obróć w lewo o 90°">⟲</button>
            <button class="icon" id="btn-rotate-right" title="Obróć w prawo o 90°">⟳</button>
            <button class="icon" id="btn-zoom-out" title="Pomniejsz">−</button>
            <button class="icon" id="btn-fit" title="Dopasuj do okna">⤢</button>
            <button class="icon" id="btn-zoom-in" title="Powiększ">+</button>
          </div>
          <div class="calib-image-wrap" id="img-wrap">
            <div class="img-canvas" id="img-canvas">
              <img id="calib-img" src="${state.imageDataUrl}" draggable="false" />
              <div class="points-layer" id="points-layer"></div>
            </div>
          </div>
        </div>
        <div class="split-pane">
          <div class="pane-toolbar">
            <span class="label">Mapa współczesna</span>
          </div>
          <div id="calib-map"></div>
        </div>
      </div>
      <div class="points-panel" id="points-panel"></div>
      <div class="toolbar toolbar--form">
        <input type="text" id="name-input" placeholder="Nazwa (np. 1935 Chorzele — mapa topo)" />
        <input type="text" id="project-input" list="project-list" placeholder="Projekt (opcjonalnie)" />
        <datalist id="project-list"></datalist>
        <button class="icon" id="btn-undo" title="Usuń ostatni punkt" disabled>↩ cofnij punkt</button>
      </div>
    `;
    document.getElementById('banner').textContent =
      'Kliknij charakterystyczny punkt na starej mapie (np. skrzyżowanie, kościół), potem ten sam punkt na mapie obok.';

    state.imageEl = document.getElementById('calib-img');

    KalibracjeDB.getAllKalibracje().then((items) => {
      const names = [...new Set(items.map((k) => k.project).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'pl'));
      document.getElementById('project-list').innerHTML = names.map((n) => `<option value="${n.replace(/"/g, '&quot;')}"></option>`).join('');
    });

    Calibrate._updateDisplayImage(state); // rotation=0 na start, ustawia dispWidth/Height i skalę "dopasuj"

    const wrap = document.getElementById('img-wrap');
    wrap.addEventListener('click', (ev) => {
      if (state.suppressNextClick) {
        state.suppressNextClick = false;
        return;
      }
      Calibrate._onImageClick(ev, state);
    });
    wrap.addEventListener(
      'wheel',
      (ev) => {
        ev.preventDefault();
        const factor = ev.deltaY < 0 ? 1.15 : 1 / 1.15;
        Calibrate._zoomAtPoint(state, state.displayScale * factor, ev.clientX, ev.clientY);
      },
      { passive: false }
    );
    Calibrate._wireDrag(wrap, state);

    document.getElementById('btn-zoom-in').onclick = () => Calibrate._zoomAtCenter(state, state.displayScale * 1.4);
    document.getElementById('btn-zoom-out').onclick = () => Calibrate._zoomAtCenter(state, state.displayScale / 1.4);
    document.getElementById('btn-fit').onclick = () => Calibrate._setScale(state, Calibrate._fitScale(state));
    document.getElementById('btn-rotate-left').onclick = () => Calibrate._rotate(state, 270);
    document.getElementById('btn-rotate-right').onclick = () => Calibrate._rotate(state, 90);
    document.getElementById('btn-undo').onclick = () => Calibrate._undoLastPoint(state);
    document.getElementById('name-input').addEventListener('input', () => Calibrate._updateSaveEnabled(state));
    window.addEventListener('resize', () => Calibrate._setScale(state, Calibrate._fitScale(state)));

    // mapa współczesna
    const map = L.map('calib-map');
    state.calibMap = map;
    Basemaps.add(map);
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

  // Przelicza podgląd (obrócony canvas) dla bieżącej wartości state.rotation,
  // ustawia go jako src obrazu i dopasowuje skalę do okna.
  _updateDisplayImage(state) {
    const dims = RotateUtil.dims(state.naturalWidth, state.naturalHeight, state.rotation);
    state.dispWidth = dims.w;
    state.dispHeight = dims.h;
    state.imageEl.src =
      state.rotation === 0 ? state.imageDataUrl : RotateUtil.renderCanvas(state.origImageEl, state.naturalWidth, state.naturalHeight, state.rotation);
    Calibrate._setScale(state, Calibrate._fitScale(state));
  },

  _rotate(state, deltaDeg) {
    state.rotation = (state.rotation + deltaDeg) % 360;
    Calibrate._updateDisplayImage(state);
  },

  _fitScale(state) {
    const wrap = document.getElementById('img-wrap');
    const availW = wrap.clientWidth || state.dispWidth;
    const availH = wrap.clientHeight || state.dispHeight;
    if (!state.dispWidth || !state.dispHeight) return 1;
    return Math.min(availW / state.dispWidth, availH / state.dispHeight);
  },

  _setScale(state, scale) {
    state.displayScale = Math.min(Math.max(scale, 0.02), 8);
    Calibrate._applyImgScale(state);
    Calibrate._redrawImagePoints(state);
  },

  // Zmienia skalę tak, by punkt obrazu, który był pod kursorem (clientX, clientY),
  // zostawał pod kursorem także po zmianie — czyli powiększanie "od kursora",
  // a nie od lewego górnego rogu.
  _zoomAtPoint(state, newScale, clientX, clientY) {
    const wrap = document.getElementById('img-wrap');
    const imgRect = state.imageEl.getBoundingClientRect();
    const fracX = imgRect.width > 0 ? (clientX - imgRect.left) / imgRect.width : 0.5;
    const fracY = imgRect.height > 0 ? (clientY - imgRect.top) / imgRect.height : 0.5;
    const wrapRect = wrap.getBoundingClientRect();
    const cursorXInWrap = clientX - wrapRect.left;
    const cursorYInWrap = clientY - wrapRect.top;

    Calibrate._setScale(state, newScale);

    const newW = state.dispWidth * state.displayScale;
    const newH = state.dispHeight * state.displayScale;
    const mx = Math.max(0, (wrap.clientWidth - newW) / 2);
    const my = Math.max(0, (wrap.clientHeight - newH) / 2);
    wrap.scrollLeft = mx + fracX * newW - cursorXInWrap;
    wrap.scrollTop = my + fracY * newH - cursorYInWrap;
  },

  _zoomAtCenter(state, newScale) {
    const r = document.getElementById('img-wrap').getBoundingClientRect();
    Calibrate._zoomAtPoint(state, newScale, r.left + r.width / 2, r.top + r.height / 2);
  },

  // Przeciąganie obrazu kursorem myszy (chwyć i przesuń). Na dotyku zostawiamy
  // natywne przewijanie przeglądarki (nie łapiemy się w to dla pointerType!=mouse),
  // żeby nie psuć przewijania palcem.
  _wireDrag(wrap, state) {
    let drag = null;
    wrap.addEventListener('pointerdown', (ev) => {
      if (ev.pointerType !== 'mouse' || ev.button !== 0) return;
      drag = { startX: ev.clientX, startY: ev.clientY, scrollLeft: wrap.scrollLeft, scrollTop: wrap.scrollTop, moved: false };
      wrap.setPointerCapture(ev.pointerId);
      wrap.classList.add('grabbing');
    });
    wrap.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const dx = ev.clientX - drag.startX;
      const dy = ev.clientY - drag.startY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) drag.moved = true;
      wrap.scrollLeft = drag.scrollLeft - dx;
      wrap.scrollTop = drag.scrollTop - dy;
    });
    const endDrag = (ev) => {
      if (!drag) return;
      if (drag.moved) state.suppressNextClick = true;
      wrap.releasePointerCapture(ev.pointerId);
      wrap.classList.remove('grabbing');
      drag = null;
    };
    wrap.addEventListener('pointerup', endDrag);
    wrap.addEventListener('pointercancel', endDrag);
  },

  _applyImgScale(state) {
    const w = state.dispWidth * state.displayScale;
    const h = state.dispHeight * state.displayScale;
    state.imageEl.style.width = w + 'px';
    state.imageEl.style.height = h + 'px';
    const layer = document.getElementById('points-layer');
    layer.style.width = w + 'px';
    layer.style.height = h + 'px';

    // wyśrodkuj, gdy obraz jest mniejszy niż panel (nie zasłania to przewijania,
    // gdy jest większy — margin wtedy po prostu wychodzi 0)
    const wrap = document.getElementById('img-wrap');
    const canvas = document.getElementById('img-canvas');
    const mx = Math.max(0, (wrap.clientWidth - w) / 2);
    const my = Math.max(0, (wrap.clientHeight - h) / 2);
    canvas.style.margin = `${my}px ${mx}px`;
  },

  _onImageClick(ev, state) {
    const rect = state.imageEl.getBoundingClientRect();
    const x = ev.clientX - rect.left;
    const y = ev.clientY - rect.top;
    if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;
    const dx = (x / rect.width) * state.dispWidth;
    const dy = (y / rect.height) * state.dispHeight;
    const orig = RotateUtil.toOriginal(dx, dy, state.naturalWidth, state.naturalHeight, state.rotation);
    state.pendingImagePoint = { px: orig.x, py: orig.y };
    Calibrate._redrawImagePoints(state);
    document.getElementById('banner').textContent = 'Teraz kliknij ten sam punkt na mapie współczesnej obok.';
  },

  _onMapClick(ev, state) {
    if (!state.pendingImagePoint) {
      document.getElementById('banner').textContent = 'Najpierw kliknij punkt na starej mapie, potem tutaj.';
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

  _undoLastPoint(state) {
    const last = state.points[state.points.length - 1];
    if (!last) return;
    const marker = state.pointMarkersOnMap[last.id];
    if (marker) state.calibMap.removeLayer(marker);
    delete state.pointMarkersOnMap[last.id];
    state.points = state.points.slice(0, -1);
    Calibrate._recompute(state);
  },

  _redrawImagePoints(state) {
    const layer = document.getElementById('points-layer');
    const scale = state.displayScale;
    const toDisp = (px, py) => RotateUtil.toDisplay(px, py, state.naturalWidth, state.naturalHeight, state.rotation);
    const all = state.points.map((p, i) => ({ ...toDisp(p.px, p.py), num: i + 1, pending: false }));
    if (state.pendingImagePoint) {
      all.push({ ...toDisp(state.pendingImagePoint.px, state.pendingImagePoint.py), num: '?', pending: true });
    }
    layer.innerHTML = all
      .map((p) => `<div class="point-marker${p.pending ? ' pending' : ''}" style="left:${p.x * scale}px; top:${p.y * scale}px;">${p.num}</div>`)
      .join('');
  },

  _recompute(state) {
    Calibrate._redrawImagePoints(state);
    Calibrate._renderPointsPanel(state);
    document.getElementById('btn-undo').disabled = state.points.length === 0;

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
          ? 'Kliknij charakterystyczny punkt na starej mapie (np. skrzyżowanie, kościół), potem ten sam punkt na mapie obok.'
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
    const project = document.getElementById('project-input').value.trim();
    if (!name || !state.transform) return;
    const record = {
      id: 'k' + Date.now() + Math.random().toString(36).slice(2, 6),
      name,
      project,
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
