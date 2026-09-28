const Home = {
  async render(root) {
    root.innerHTML = `
      <header class="topbar">
        <h1>archemapa</h1>
      </header>
      <div class="split-workspace">
        <div class="split-pane">
          <div class="pane-toolbar"><span class="label">Projekty</span></div>
          <div id="view-projekty" class="list"></div>
        </div>
        <div class="split-pane">
          <div class="pane-toolbar"><span class="label">Mapa — wszystkie punkty</span></div>
          <div id="overview-map"></div>
        </div>
      </div>
      <button class="primary fab" id="btn-new">+ Nowa kalibracja</button>
    `;
    document.getElementById('btn-new').onclick = () => {
      location.hash = '#/kalibracja/nowa';
    };

    Home._initOverviewMap();

    Home._items = await KalibracjeDB.getAllKalibracje();
    Home._renderProjectsView();
    Home._renderOverviewMarkers();
  },

  _initOverviewMap() {
    const map = L.map('overview-map');
    Home._overviewMap = map;
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
    }).addTo(map);
    map.setView([52.0, 20.0], 6);
    Home._overviewLayer = L.layerGroup().addTo(map);
    requestAnimationFrame(() => map.invalidateSize());
    window.addEventListener('resize', () => map.invalidateSize());
  },

  _renderProjectsView() {
    const listEl = document.getElementById('view-projekty');
    const items = Home._items;
    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          Brak zapisanych kalibracji.<br />
          Dotknij „Nowa kalibracja”, żeby nałożyć starą mapę na współczesną.
        </div>`;
      return;
    }

    const groups = {};
    for (const k of items) {
      const proj = k.project && k.project.trim() ? k.project.trim() : 'Bez projektu';
      (groups[proj] = groups[proj] || []).push(k);
    }
    const projectNames = Object.keys(groups).sort((a, b) => {
      if (a === 'Bez projektu') return 1;
      if (b === 'Bez projektu') return -1;
      return a.localeCompare(b, 'pl');
    });

    listEl.innerHTML = projectNames
      .map((proj, gi) => {
        const items = groups[proj]
          .sort((a, b) => b.createdAt - a.createdAt)
          .map((k) => Home._cardHtml(k))
          .join('');
        return `
        <div class="project-group">
          <button class="project-header" data-group="${gi}">
            <span class="chev">▾</span>
            <span class="project-name">${escapeHtml(proj)}</span>
            <span class="count">${groups[proj].length}</span>
          </button>
          <div class="project-items" data-group-items="${gi}">${items}</div>
        </div>`;
      })
      .join('');

    listEl.querySelectorAll('.project-header').forEach((btn) => {
      btn.onclick = () => {
        btn.classList.toggle('collapsed');
        listEl.querySelector(`[data-group-items="${btn.dataset.group}"]`).classList.toggle('collapsed');
      };
    });
    Home._wireCardButtons(listEl);
  },

  _cardHtml(k) {
    const date = new Date(k.createdAt).toLocaleDateString('pl-PL');
    return `
      <div class="card" data-id="${k.id}">
        <h3>${escapeHtml(k.name)}</h3>
        <div class="meta">${date} · ${k.controlPoints.length} pkt. kontrolnych</div>
        <div class="row">
          <button class="primary btn-open" data-id="${k.id}">Otwórz w terenie</button>
          <button class="icon btn-locate" data-id="${k.id}" title="Pokaż na mapie">🎯</button>
          <button class="icon btn-move" data-id="${k.id}" title="Zmień projekt">📁</button>
          <button class="danger icon btn-del" data-id="${k.id}" title="Usuń">✕</button>
        </div>
      </div>`;
  },

  _wireCardButtons(scope) {
    scope.querySelectorAll('.btn-open').forEach((btn) => {
      btn.onclick = () => {
        location.hash = `#/teren/${btn.dataset.id}`;
      };
    });
    scope.querySelectorAll('.btn-del').forEach((btn) => {
      btn.onclick = async () => {
        if (confirm('Usunąć tę kalibrację? Tej operacji nie można cofnąć.')) {
          await KalibracjeDB.deleteKalibracja(btn.dataset.id);
          Home._items = await KalibracjeDB.getAllKalibracje();
          Home._renderProjectsView();
          Home._renderOverviewMarkers();
        }
      };
    });
    scope.querySelectorAll('.btn-move').forEach((btn) => {
      btn.onclick = async () => {
        const k = Home._items.find((x) => x.id === btn.dataset.id);
        const next = prompt('Nazwa projektu (zostaw puste, żeby usunąć z projektu):', k.project || '');
        if (next === null) return;
        k.project = next.trim();
        await KalibracjeDB.saveKalibracja(k);
        Home._items = await KalibracjeDB.getAllKalibracje();
        Home._renderProjectsView();
      };
    });
    scope.querySelectorAll('.btn-locate').forEach((btn) => {
      btn.onclick = () => Home._focusOnMap(btn.dataset.id);
    });
  },

  _focusOnMap(id) {
    const marker = Home._markersById?.[id];
    if (!marker) return;
    Home._overviewMap.setView(marker.getLatLng(), 15);
    marker.openPopup();
  },

  _renderOverviewMarkers() {
    if (!Home._overviewLayer) return;
    Home._overviewLayer.clearLayers();
    Home._markersById = {};
    const bounds = [];
    for (const k of Home._items) {
      if (!k.controlPoints || k.controlPoints.length === 0) continue;
      const lat = k.controlPoints.reduce((s, p) => s + p.lat, 0) / k.controlPoints.length;
      const lng = k.controlPoints.reduce((s, p) => s + p.lng, 0) / k.controlPoints.length;
      bounds.push([lat, lng]);
      const marker = L.marker([lat, lng]).bindPopup(
        `<b>${escapeHtml(k.name)}</b><br>${escapeHtml(k.project || 'Bez projektu')}<br><a href="#/teren/${k.id}">Otwórz w terenie →</a>`
      );
      marker.addTo(Home._overviewLayer);
      Home._markersById[k.id] = marker;
    }
    if (bounds.length > 0) {
      Home._overviewMap.fitBounds(bounds, { padding: [30, 30], maxZoom: 14 });
    }
  },
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
