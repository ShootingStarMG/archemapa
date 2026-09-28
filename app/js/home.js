const Home = {
  async render(root) {
    root.innerHTML = `
      <header class="topbar"><h1>archemapa</h1></header>
      <main>
        <div id="home-list" class="list"><p class="hint">Wczytywanie…</p></div>
      </main>
      <button class="primary fab" id="btn-new">+ Nowa kalibracja</button>
    `;
    document.getElementById('btn-new').onclick = () => {
      location.hash = '#/kalibracja/nowa';
    };
    await Home._renderList();
  },

  async _renderList() {
    const listEl = document.getElementById('home-list');
    const items = await KalibracjeDB.getAllKalibracje();
    if (items.length === 0) {
      listEl.innerHTML = `
        <div class="empty-state">
          Brak zapisanych kalibracji.<br />
          Dotknij „Nowa kalibracja”, żeby nałożyć starą mapę na współczesną.
        </div>`;
      return;
    }
    listEl.innerHTML = items
      .map((k) => {
        const date = new Date(k.createdAt).toLocaleDateString('pl-PL');
        const nPts = k.controlPoints.length;
        return `
        <div class="card" data-id="${k.id}">
          <h3>${escapeHtml(k.name)}</h3>
          <div class="meta">${date} · ${nPts} pkt. kontrolnych</div>
          <div class="row">
            <button class="primary btn-open" data-id="${k.id}">Otwórz w terenie</button>
            <button class="danger btn-del" data-id="${k.id}">Usuń</button>
          </div>
        </div>`;
      })
      .join('');

    listEl.querySelectorAll('.btn-open').forEach((btn) => {
      btn.onclick = () => {
        location.hash = `#/teren/${btn.dataset.id}`;
      };
    });
    listEl.querySelectorAll('.btn-del').forEach((btn) => {
      btn.onclick = async () => {
        if (confirm('Usunąć tę kalibrację? Tej operacji nie można cofnąć.')) {
          await KalibracjeDB.deleteKalibracja(btn.dataset.id);
          await Home._renderList();
        }
      };
    });
  },
};

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
