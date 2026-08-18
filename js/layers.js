import { theme } from "./theme.js";

// Single hue, luminance only. Index 0 is the natural sky, index 1 the inner city.
const RAMP = {
  dark: [
    [0, 11, 13, 16],
    [0.16, 26, 26, 28],
    [0.34, 64, 58, 50],
    [0.54, 124, 110, 90],
    [0.74, 190, 168, 132],
    [0.89, 232, 214, 178],
    [1, 255, 247, 232],
  ],
  light: [
    [0, 245, 243, 238],
    [0.16, 214, 210, 202],
    [0.34, 168, 162, 152],
    [0.54, 116, 110, 102],
    [0.74, 70, 64, 58],
    [0.89, 38, 34, 30],
    [1, 14, 12, 10],
  ],
};

export function ramp(t) {
  const R = RAMP[theme()];
  t = Math.max(0, Math.min(1, t));
  for (let k = 1; k < R.length; k++) {
    if (t <= R[k][0]) {
      const a = R[k - 1],
        b = R[k],
        f = (t - a[0]) / (b[0] - a[0] || 1);
      return [
        a[1] + (b[1] - a[1]) * f,
        a[2] + (b[2] - a[2]) * f,
        a[3] + (b[3] - a[3]) * f,
      ];
    }
  }
  return R[R.length - 1].slice(1);
}

async function readPng(url, nx, ny) {
  const bmp = await createImageBitmap(await (await fetch(url)).blob());
  const cv = new OffscreenCanvas(nx, ny);
  const cx = cv.getContext("2d", { willReadFrequently: true });
  cx.drawImage(bmp, 0, 0);
  const rgba = cx.getImageData(0, 0, nx, ny).data;
  const out = new Uint8Array(nx * ny);
  for (let k = 0; k < out.length; k++) out[k] = rgba[k * 4];
  return out;
}

class Raster {
  constructor(meta, values) {
    this.meta = meta;
    this.values = values;
    this.canvas = new OffscreenCanvas(meta.nx, meta.ny);
    this.cx = this.canvas.getContext("2d");
    this.image = this.cx.createImageData(meta.nx, meta.ny);
  }

  // t runs 0 at the natural sky to 1 at the brightest end of the encoded range.
  paint(tOf, alphaOf) {
    const d = this.image.data;
    for (let k = 0; k < this.values.length; k++) {
      const t = tOf(this.values[k]);
      const c = ramp(t),
        q = k * 4;
      d[q] = c[0];
      d[q + 1] = c[1];
      d[q + 2] = c[2];
      d[q + 3] = 255 * Math.max(0, Math.min(1, alphaOf(t, this.values[k])));
    }
    this.cx.putImageData(this.image, 0, 0);
  }
}

export async function load(base = "assets") {
  const layers = await (await fetch(`${base}/layers.json`)).json();
  const sky = await (await fetch(`${base}/sky.json`)).json();
  const [skyPx, glowPx] = await Promise.all([
    readPng(`${base}/${layers.sky.file}`, layers.sky.nx, layers.sky.ny),
    readPng(`${base}/${layers.glow.file}`, layers.glow.nx, layers.glow.ny),
  ]);
  const [roads, spots, basemap] = await Promise.all([
    (await fetch(`${base}/roads.json`)).json(),
    (await fetch(`${base}/spots.json`)).json(),
    (await fetch(`${base}/basemap.json`)).json(),
  ]);
  return {
    sky,
    roads,
    spots,
    basemap,
    rasters: {
      sky: new Raster(layers.sky, skyPx),
      glow: new Raster(layers.glow, glowPx),
    },
  };
}

export function repaint(rasters) {
  const sky = rasters.sky.meta;
  const span = sky.vmax - sky.vmin;
  rasters.sky.paint(
    (v) => (sky.vmax - (sky.vmin + (v / 255) * span)) / span,
    (t) => Math.pow(t, 0.72) * 1.05,
  );
  rasters.glow.paint(
    (v) => (v ? 0.35 + 0.65 * (v / 255) : 0),
    (t, v) => (v ? Math.pow(v / 255, 0.85) * 0.6 : 0),
  );
}
