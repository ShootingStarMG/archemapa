const Home = {
  async render(root) {
    root.innerHTML = `
      <header class="topbar">
        <h1>archemapa</h1>
      </header>
      <div class="tabs" id="tabs">
        <button class="tab active" data-tab="projekty">📁 Projekty</button>
        <button class="tab" data-tab="mapa">🗺 Mapa</button>
      </div>
      <div id="home-body" class="home-body">
        <div id="view-projekty" class="list"></div>
        <div id="view-mapa" class="overview-map-view" hidden>
          <div id="overview-map"></div>
        </div>
      </div>
      <button class="primary fab" id="btn-new">+ Nowa kalibracja</button>
    `;
    document.getElementById('btn-new').onclick = () => {
      location.hash = '#/kalibracja/nowa';
    };

    document.querySelectorAll('.tab').forEach((tab) => {
      tab.onclick = () => Home._switchTab(tab.dataset.tab);
    });

    Home._items = await KalibracjeDB.getAllKalibracje();
    Home._renderProjectsView();
    if (Home._overviewMap) {
      Home._renderOverviewMarkers();
    }
  },

  _switchTab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.getElementById('view-projekty').hidden = name !== 'projekty';
    document.getElementById('view-mapa').hidden = name !== 'mapa';
    if (name === 'mapa') Home._renderMapView();
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
  },

  _renderMapView() {
    if (!Home._overviewMap) {
      const map = L.map('overview-map');
      Home._overviewMap = map;
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '© OpenStreetMap',
      }).addTo(map);
      map.setView([52.0, 20.0], 6);
      Home._overviewLayer = L.layerGroup().addTo(map);
      Home._renderOverviewMarkers();
    }
    requestAnimationFrame(() => Home._overviewMap.invalidateSize());
  },

  _renderOverviewMarkers() {
    if (!Home._overviewLayer) return;
    Home._overviewLayer.clearLayers();
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
