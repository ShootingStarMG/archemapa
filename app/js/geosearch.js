// Wyszukiwarka miejsc przez Nominatim (OpenStreetMap) — darmowe, bez klucza.
// Szukamy tylko na Enter/klik przycisku (nie przy każdym znaku), zgodnie z
// polityką użytkowania Nominatim (bez masowego/auto-uzupełniającego odpytywania).
const GeoSearch = {
  wire(map, inputEl, buttonEl) {
    const doSearch = async () => {
      const q = inputEl.value.trim();
      if (!q) return;
      buttonEl.disabled = true;
      const prevLabel = buttonEl.textContent;
      buttonEl.textContent = '…';
      try {
        const res = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q), {
          headers: { 'Accept-Language': 'pl' },
        });
        const results = await res.json();
        if (!results.length) {
          alert('Nie znaleziono miejsca: ' + q);
          return;
        }
        const { lat, lon, boundingbox } = results[0];
        if (boundingbox) {
          const [south, north, west, east] = boundingbox.map(Number);
          map.fitBounds([
            [south, west],
            [north, east],
          ]);
        } else {
          map.setView([parseFloat(lat), parseFloat(lon)], 14);
        }
      } catch (err) {
        alert('Błąd wyszukiwania (sprawdź połączenie z internetem): ' + err.message);
      } finally {
        buttonEl.disabled = false;
        buttonEl.textContent = prevLabel;
      }
    };
    buttonEl.addEventListener('click', doSearch);
    inputEl.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        doSearch();
      }
    });
  },
};
