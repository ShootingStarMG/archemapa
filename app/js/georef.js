// Georeferencja: dopasowanie afiniczne piksel obrazu -> metry Web Mercator (EPSG:3857)
// oraz pomocnicze przeliczenia lat/lng <-> metry. Bez zewnętrznych zależności (nie
// polegamy na Leaflet przy samym liczeniu, żeby dało się to też przetestować osobno).

const R_EARTH = 6378137; // promień Ziemi używany w Web Mercator (ten sam co Leaflet/EPSG:3857)

function latLngToMeters(lat, lng) {
  const x = (lng * Math.PI * R_EARTH) / 180;
  const y = R_EARTH * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return { x, y };
}

function metersToLatLng(x, y) {
  const lng = (x / R_EARTH) * (180 / Math.PI);
  const lat = ((2 * Math.atan(Math.exp(y / R_EARTH)) - Math.PI / 2) * 180) / Math.PI;
  return { lat, lng };
}

// Rozwiązuje układ 3x3 metodą eliminacji Gaussa. `A` to macierz 3x3 (tablica wierszy),
// `b` to wektor długości 3. Zwraca wektor rozwiązania długości 3.
function solve3x3(A, b) {
  const M = A.map((row, i) => [...row, b[i]]);
  for (let col = 0; col < 3; col++) {
    let pivot = col;
    for (let r = col + 1; r < 3; r++) {
      if (Math.abs(M[r][col]) > Math.abs(M[pivot][col])) pivot = r;
    }
    if (pivot !== col) [M[col], M[pivot]] = [M[pivot], M[col]];
    const pv = M[col][col];
    if (Math.abs(pv) < 1e-12) throw new Error('Punkty kontrolne są zdegenerowane (współliniowe?) — nie da się policzyć transformacji.');
    for (let c = col; c < 4; c++) M[col][c] /= pv;
    for (let r = 0; r < 3; r++) {
      if (r === col) continue;
      const factor = M[r][col];
      for (let c = col; c < 4; c++) M[r][c] -= factor * M[col][c];
    }
  }
  return [M[0][3], M[1][3], M[2][3]];
}

// points: [{px, py, lat, lng}, ...] min. 3 punkty (przy >3 liczy dopasowanie
// najmniejszych kwadratów). Zwraca transform {a,b,c,d,e,f} takie, że:
//   mx = a*px + b*py + c
//   my = d*px + e*py + f
// (mx, my w metrach Web Mercator EPSG:3857)
function computeAffine(points) {
  if (points.length < 3) {
    throw new Error('Potrzeba minimum 3 punktów kontrolnych.');
  }
  const pts = points.map((p) => {
    const m = latLngToMeters(p.lat, p.lng);
    return { px: p.px, py: p.py, mx: m.x, my: m.y };
  });

  // Normalne równania dla mx = a*px + b*py + c*1 (i analogicznie dla my)
  let Sxx = 0, Sxy = 0, Sx = 0, Syy = 0, Sy = 0, n = pts.length;
  let SxMx = 0, SyMx = 0, SMx = 0;
  let SxMy = 0, SyMy = 0, SMy = 0;
  for (const p of pts) {
    Sxx += p.px * p.px;
    Sxy += p.px * p.py;
    Sx += p.px;
    Syy += p.py * p.py;
    Sy += p.py;
    SxMx += p.px * p.mx;
    SyMx += p.py * p.mx;
    SMx += p.mx;
    SxMy += p.px * p.my;
    SyMy += p.py * p.my;
    SMy += p.my;
  }
  const A = [
    [Sxx, Sxy, Sx],
    [Sxy, Syy, Sy],
    [Sx, Sy, n],
  ];
  const [a, b, c] = solve3x3(A, [SxMx, SyMx, SMx]);
  const [d, e, f] = solve3x3(A, [SxMy, SyMy, SMy]);
  return { a, b, c, d, e, f };
}

function applyAffine(t, px, py) {
  return { mx: t.a * px + t.b * py + t.c, my: t.d * px + t.e * py + t.f };
}

// Błąd resztkowy każdego punktu w metrach (analogicznie do "residual" w QGIS Georeferencer)
function computeResiduals(transform, points) {
  return points.map((p) => {
    const target = latLngToMeters(p.lat, p.lng);
    const got = applyAffine(transform, p.px, p.py);
    const dx = got.mx - target.x;
    const dy = got.my - target.y;
    return Math.sqrt(dx * dx + dy * dy);
  });
}

// Piksel obrazu (px,py) -> LatLng, przez nasz transform + metersToLatLng
function pixelToLatLng(transform, px, py) {
  const { mx, my } = applyAffine(transform, px, py);
  return metersToLatLng(mx, my);
}

window.Georef = {
  latLngToMeters,
  metersToLatLng,
  computeAffine,
  applyAffine,
  computeResiduals,
  pixelToLatLng,
};
