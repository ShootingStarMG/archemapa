// Pomiar odległości (i powierzchni, jeśli dodano min. 3 punkty — traktujemy
// je wtedy jako zamknięty wielokąt). Liczymy prawdziwą odległość na sferze
// (Haversine) i powierzchnię przez lokalną projekcję równoodległościową
// wokół środka punktów — NIE przez metry Web Mercator (Georef.latLngToMeters),
// bo te są mocno rozciągnięte na szerokości geogr. Polski (~52°N czynnik
// zniekształcenia ok. 1.6x) i dawałyby wyraźnie zawyżony dystans.
const Measure = {
  create(map) {
    let active = false;
    let points = [];
    let line = null;
    const markers = [];

    const readout = L.DomUtil.create('div', 'measure-readout');
    readout.hidden = true;
    map.getContainer().appendChild(readout);

    function haversineMeters(lat1, lng1, lat2, lng2) {
      const R = 6371000;
      const toRad = (d) => (d * Math.PI) / 180;
      const dLat = toRad(lat2 - lat1);
      const dLng = toRad(lng2 - lng1);
      const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
      return 2 * R * Math.asin(Math.sqrt(a));
    }

    function polygonAreaMeters(pts) {
      if (pts.length < 3) return 0;
      const R = 6371000;
      const toRad = (d) => (d * Math.PI) / 180;
      const lat0 = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
      const xy = pts.map((p) => ({
        x: R * toRad(p.lng) * Math.cos(toRad(lat0)),
        y: R * toRad(p.lat),
      }));
      let sum = 0;
      for (let i = 0; i < xy.length; i++) {
        const j = (i + 1) % xy.length;
        sum += xy[i].x * xy[j].y - xy[j].x * xy[i].y;
      }
      return Math.abs(sum) / 2;
    }

    function formatMeters(m) {
      return m < 1000 ? m.toFixed(0) + ' m' : (m / 1000).toFixed(2) + ' km';
    }
    function formatArea(m2) {
      return m2 < 10000 ? m2.toFixed(0) + ' m²' : (m2 / 10000).toFixed(2) + ' ha';
    }

    function redraw() {
      if (line) {
        map.removeLayer(line);
        line = null;
      }
      if (points.length >= 2) {
        line = L.polyline(
          points.map((p) => [p.lat, p.lng]),
          { color: '#ffb84f', weight: 3, dashArray: '6 6' }
        ).addTo(map);
      }
      if (points.length === 0) {
        readout.hidden = true;
        return;
      }
      readout.hidden = false;
      let dist = 0;
      for (let i = 1; i < points.length; i++) {
        dist += haversineMeters(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
      }
      let html = `Odległość: ${formatMeters(dist)}`;
      if (points.length >= 3) {
        html += `<br>Powierzchnia (zamknięty kształt): ${formatArea(polygonAreaMeters(points))}`;
      }
      readout.innerHTML = html;
    }

    map.on('click', (ev) => {
      if (!active) return;
      points.push(ev.latlng);
      markers.push(
        L.circleMarker(ev.latlng, { radius: 5, color: '#ffb84f', weight: 2, fillColor: '#ffb84f', fillOpacity: 1 }).addTo(map)
      );
      redraw();
    });

    return {
      setActive(on) {
        active = on;
      },
      isActive: () => active,
      clear() {
        points = [];
        markers.splice(0).forEach((m) => map.removeLayer(m));
        redraw();
      },
      hasPoints: () => points.length > 0,
    };
  },
};
