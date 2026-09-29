// Custom warstwa Leaflet renderująca obraz rastrowy (starą mapę/zdjęcie lotnicze)
// nałożony na mapę współczesną wg dopasowania afinicznego (patrz georef.js).
// Technika: przy każdym ruchu/zoomie mapy liczymy, gdzie na ekranie wypadają
// trzy narożniki obrazu (0,0), (W,0), (0,H) — trzy punkty jednoznacznie
// wyznaczają transformację afiniczną — i ustawiamy <img> przez CSS `matrix()`.

L.AffineImageOverlay = L.Layer.extend({
  // options.transform: {a,b,c,d,e,f} piksel obrazu -> metry EPSG:3857
  initialize: function (imageUrl, imgWidth, imgHeight, transform, options) {
    this._url = imageUrl;
    this._w = imgWidth;
    this._h = imgHeight;
    this._transform = transform;
    L.Util.setOptions(this, options);
  },

  onAdd: function (map) {
    this._map = map;
    if (!this._image) {
      const img = L.DomUtil.create('img', 'affine-image-overlay');
      img.src = this._url;
      img.width = this._w;
      img.height = this._h;
      img.draggable = false;
      img.style.position = 'absolute';
      img.style.top = '0';
      img.style.left = '0';
      img.style.transformOrigin = '0 0';
      img.style.pointerEvents = 'none';
      img.style.opacity = this.options.opacity != null ? this.options.opacity : 1;
      img.style.willChange = 'transform';
      this._image = img;
    }
    this.getPane().appendChild(this._image);
    map.on('move zoom', this._reset, this);
    this._reset();
    return this;
  },

  onRemove: function (map) {
    L.DomUtil.remove(this._image);
    map.off('move zoom', this._reset, this);
  },

  getPane: function () {
    return this._map.getPane(this.options.pane || 'overlayPane');
  },

  setOpacity: function (opacity) {
    this.options.opacity = opacity;
    if (this._image) this._image.style.opacity = opacity;
  },

  setTransform: function (transform) {
    this._transform = transform;
    this._reset();
  },

  getTransform: function () {
    return this._transform;
  },

  // Włącza/wyłącza możliwość łapania nakładki kursorem — domyślnie
  // pointer-events:none, żeby nie blokować przeciągania/klikania mapy pod spodem.
  // Włączane tylko w trybie ręcznej korekty pozycji (patrz field.js).
  setInteractive: function (interactive) {
    if (!this._image) return;
    this._image.style.pointerEvents = interactive ? 'auto' : 'none';
    this._image.style.cursor = interactive ? 'grab' : '';
  },

  _reset: function () {
    if (!this._map || !this._image) return;
    const map = this._map;
    const zoom = map.getZoom();

    const cornerLatLng = (px, py) => {
      const ll = Georef.pixelToLatLng(this._transform, px, py);
      return map.latLngToLayerPoint([ll.lat, ll.lng]);
    };

    const p00 = cornerLatLng(0, 0);
    const p10 = cornerLatLng(this._w, 0);
    const p01 = cornerLatLng(0, this._h);

    const a = (p10.x - p00.x) / this._w;
    const b = (p10.y - p00.y) / this._w;
    const c = (p01.x - p00.x) / this._h;
    const d = (p01.y - p00.y) / this._h;
    const e = p00.x;
    const f = p00.y;

    this._image.style.transform = `matrix(${a},${b},${c},${d},${e},${f})`;
  },
});

L.affineImageOverlay = function (url, w, h, transform, options) {
  return new L.AffineImageOverlay(url, w, h, transform, options);
};
