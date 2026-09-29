function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}

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
      <div id="overlay-rows" class="overlay-rows"></div>
      <div class="toolbar toolbar--form">
        <input type="text" id="search-input" placeholder="Szukaj miejsca…" />
        <button class="icon" id="search-btn">🔍</button>
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
          <button class="icon" id="btn-add-overlay" title="Dodaj kolejną mapę do porównania">🗺+</button>
          <button class="icon" id="btn-measure" title="Zmierz odległość/powierzchnię">📏</button>
          <button class="icon" id="btn-note" title="Dodaj pinezkę z notatką">📍</button>
          <button class="icon" id="btn-offline" title="Zapisz ten widok offline">⬇</button>
          <button class="icon" id="btn-adjust" title="Przesuń nałożenie ręcznie">✥</button>
          <button class="icon" id="btn-locate" title="Wyśrodkuj na mojej pozycji">◎</button>
        </div>
      </div>
      <div class="modal-card" id="note-form" hidden>
        <h3>Nowa pinezka</h3>
        <textarea id="note-text" placeholder="Co tu znalazłaś?" rows="3"></textarea>
        <input type="file" id="note-photo" accept="image/*" capture="environment" />
        <div class="row">
          <button id="note-cancel">Anuluj</button>
          <button class="primary" id="note-save">Zapisz</button>
        </div>
      </div>
      <div class="modal-card" id="overlay-picker" hidden>
        <h3>Dodaj mapę do porównania</h3>
        <select id="overlay-picker-select"></select>
        <div class="row">
          <button id="overlay-picker-cancel">Anuluj</button>
          <button class="primary" id="overlay-picker-add">Dodaj</button>
        </div>
      </div>
    `;

    const map = L.map('field-map', { zoomControl: true });
    const basemaps = Basemaps.add(map);
    requestAnimationFrame(() => map.invalidateSize());
    const onResize = () => map.invalidateSize();
    window.addEventListener('resize', onResize);

    GeoSearch.wire(map, document.getElementById('search-input'), document.getElementById('search-btn'));

    // --- Nakładka główna + dodatkowe (porównanie kilku map naraz) ---
    let workingTransform = { ...rec.transform };
    const primaryOverlay = L.affineImageOverlay(rec.imageDataUrl, rec.imageWidth, rec.imageHeight, workingTransform, { opacity: 0.7 });
    primaryOverlay.addTo(map);
    const extraOverlays = []; // { rec, overlay }

    const overlayRowsEl = document.getElementById('overlay-rows');
    function renderOverlayRows() {
      const rows = [{ id: rec.id, name: rec.name, opacity: primaryOverlay.options.opacity, removable: false }].concat(
        extraOverlays.map((e) => ({ id: e.rec.id, name: e.rec.name, opacity: e.overlay.options.opacity, removable: true }))
      );
      overlayRowsEl.innerHTML = rows
        .map(
          (r) => `
        <div class="overlay-row">
          <span class="overlay-row-name">${escapeHtml(r.name)}</span>
          <input type="range" min="0" max="100" value="${Math.round(r.opacity * 100)}" class="overlay-opacity" data-id="${r.id}" />
          ${r.removable ? `<button class="icon danger overlay-remove" data-id="${r.id}">✕</button>` : ''}
        </div>`
        )
        .join('');
      overlayRowsEl.querySelectorAll('.overlay-opacity').forEach((inp) => {
        inp.addEventListener('input', (e) => {
          const val = e.target.value / 100;
          if (e.target.dataset.id === rec.id) primaryOverlay.setOpacity(val);
          else {
            const ex = extraOverlays.find((x) => x.rec.id === e.target.dataset.id);
            if (ex) ex.overlay.setOpacity(val);
          }
        });
      });
      overlayRowsEl.querySelectorAll('.overlay-remove').forEach((btn) => {
        btn.onclick = () => {
          const idx = extraOverlays.findIndex((x) => x.rec.id === btn.dataset.id);
          if (idx >= 0) {
            map.removeLayer(extraOverlays[idx].overlay);
            extraOverlays.splice(idx, 1);
            renderOverlayRows();
          }
        };
      });
    }
    renderOverlayRows();

    const overlayPicker = document.getElementById('overlay-picker');
    const pickerSelect = document.getElementById('overlay-picker-select');
    document.getElementById('btn-add-overlay').onclick = async () => {
      const all = await KalibracjeDB.getAllKalibracje();
      const options = all.filter((k) => k.id !== rec.id && !extraOverlays.some((e) => e.rec.id === k.id));
      if (options.length === 0) {
        alert('Brak innych zapisanych kalibracji do dodania.');
        return;
      }
      pickerSelect.innerHTML = options.map((k) => `<option value="${k.id}">${escapeHtml(k.name)}</option>`).join('');
      overlayPicker.hidden = false;
    };
    document.getElementById('overlay-picker-cancel').onclick = () => {
      overlayPicker.hidden = true;
    };
    document.getElementById('overlay-picker-add').onclick = async () => {
      const chosenRec = await KalibracjeDB.getKalibracja(pickerSelect.value);
      if (!chosenRec) return;
      const ov = L.affineImageOverlay(chosenRec.imageDataUrl, chosenRec.imageWidth, chosenRec.imageHeight, chosenRec.transform, {
        opacity: 0.5,
      });
      ov.addTo(map);
      extraOverlays.push({ rec: chosenRec, overlay: ov });
      overlayPicker.hidden = true;
      renderOverlayRows();
    };

    // ustaw widok tak, by objąć nałożoną mapę (główną)
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

    // --- Ręczne przesuwanie nakładki głównej (mysz + strzałki) ---
    function metersPerPixel() {
      const R = 6378137;
      return (2 * Math.PI * R) / (256 * Math.pow(2, map.getZoom()));
    }
    function nudge(dxMeters, dyMeters) {
      workingTransform = { ...workingTransform, c: workingTransform.c + dxMeters, f: workingTransform.f + dyMeters };
      primaryOverlay.setTransform(workingTransform);
    }

    let adjustMode = false;
    let drag = null;
    const adjustBar = document.getElementById('adjust-bar');
    const btnAdjust = document.getElementById('btn-adjust');
    const imgEl = primaryOverlay._image;

    imgEl.addEventListener('pointerdown', (ev) => {
      if (!adjustMode) return;
      drag = { startX: ev.clientX, startY: ev.clientY, start: { ...workingTransform } };
      map.dragging.disable();
      imgEl.style.cursor = 'grabbing';
      imgEl.setPointerCapture(ev.pointerId);
    });
    imgEl.addEventListener('pointermove', (ev) => {
      if (!drag) return;
      const mpp = metersPerPixel();
      const dxPx = ev.clientX - drag.startX;
      const dyPx = ev.clientY - drag.startY;
      workingTransform = { ...drag.start, c: drag.start.c + dxPx * mpp, f: drag.start.f - dyPx * mpp };
      primaryOverlay.setTransform(workingTransform);
    });
    const endDrag = (ev) => {
      if (!drag) return;
      drag = null;
      map.dragging.enable();
      imgEl.style.cursor = 'grab';
      imgEl.releasePointerCapture(ev.pointerId);
    };
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
      primaryOverlay.setInteractive(adjustMode);
      if (adjustMode) map.keyboard.disable();
      else map.keyboard.enable();
    };
    document.getElementById('btn-adjust-reset').onclick = () => {
      workingTransform = { ...rec.transform };
      primaryOverlay.setTransform(workingTransform);
    };
    document.getElementById('btn-adjust-save').onclick = async () => {
      rec.transform = { ...workingTransform };
      await KalibracjeDB.saveKalibracja(rec);
      const original = adjustBar.innerHTML;
      adjustBar.textContent = 'Zapisano przesunięcie.';
      setTimeout(() => {
        if (adjustMode) adjustBar.innerHTML = original;
      }, 1500);
    };

    // --- Pomiar odległości/powierzchni ---
    const measureTool = Measure.create(map);
    const btnMeasure = document.getElementById('btn-measure');
    btnMeasure.onclick = () => {
      const on = !measureTool.isActive();
      measureTool.setActive(on);
      btnMeasure.classList.toggle('active', on);
    };

    // --- Pinezki z notatką i zdjęciem ---
    let noteMode = false;
    let pendingNoteLatLng = null;
    const btnNote = document.getElementById('btn-note');
    const noteForm = document.getElementById('note-form');
    const noteTextEl = document.getElementById('note-text');
    const notePhotoEl = document.getElementById('note-photo');

    btnNote.onclick = () => {
      noteMode = !noteMode;
      btnNote.classList.toggle('active', noteMode);
    };

    function addNoteMarker(note) {
      const marker = L.marker([note.lat, note.lng], {
        icon: L.divIcon({ className: '', html: '<div class="note-marker">📍</div>', iconSize: [26, 26], iconAnchor: [13, 26] }),
      });
      const photoHtml = note.photoDataUrl
        ? `<img src="${note.photoDataUrl}" style="max-width:180px;display:block;margin-top:6px;border-radius:8px;" />`
        : '';
      marker.bindPopup(
        `<div>${escapeHtml(note.text || '(bez opisu)')}</div>${photoHtml}<button class="danger icon note-del-btn">Usuń</button>`
      );
      marker.on('popupopen', (e) => {
        const btn = e.popup._contentNode.querySelector('.note-del-btn');
        if (btn)
          btn.onclick = async () => {
            await KalibracjeDB.deleteNotatka(note.id);
            map.removeLayer(marker);
          };
      });
      marker.addTo(map);
    }
    (await KalibracjeDB.getNotatkiForKalibracja(rec.id)).forEach(addNoteMarker);

    map.on('click', (ev) => {
      if (!noteMode) return;
      pendingNoteLatLng = ev.latlng;
      noteTextEl.value = '';
      notePhotoEl.value = '';
      noteForm.hidden = false;
    });
    document.getElementById('note-cancel').onclick = () => {
      noteForm.hidden = true;
      pendingNoteLatLng = null;
    };
    document.getElementById('note-save').onclick = async () => {
      if (!pendingNoteLatLng) return;
      const file = notePhotoEl.files[0];
      const note = {
        id: 'n' + Date.now() + Math.random().toString(36).slice(2, 6),
        kalibracjaId: rec.id,
        lat: pendingNoteLatLng.lat,
        lng: pendingNoteLatLng.lng,
        text: noteTextEl.value.trim(),
        photoDataUrl: file ? await readFileAsDataUrl(file) : null,
        createdAt: Date.now(),
      };
      await KalibracjeDB.saveNotatka(note);
      addNoteMarker(note);
      noteForm.hidden = true;
      pendingNoteLatLng = null;
    };

    // --- Zapis widocznego obszaru offline ---
    const btnOffline = document.getElementById('btn-offline');
    btnOffline.onclick = async () => {
      btnOffline.disabled = true;
      await OfflineDownload.downloadVisible(
        map,
        () => basemaps.getActive(),
        (done, total) => {
          btnOffline.textContent = total ? `${done}/${total}` : '⬇';
        }
      );
      btnOffline.textContent = '✓';
      setTimeout(() => {
        btnOffline.textContent = '⬇';
        btnOffline.disabled = false;
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
