import { select, zoom, zoomIdentity } from "d3";

import { invert, project } from "./albers.js";
import { ramp } from "./layers.js";
import { css, theme } from "./theme.js";

const PADL = 34,
  PADT = 16,
  PADR = 12,
  PADB = 26;
const SANS = (s) => `${s}px "IBM Plex Sans",Helvetica,sans-serif`;

// Tier, position on the sky ramp, alpha, screen width, and the zoom it starts at.
const TIERS = [
  ["major", 0.9, 0.85, 1.0, 0],
  ["second", 0.72, 0.6, 0.7, 1.4],
  ["minor", 0.55, 0.38, 0.5, 2.6],
];

const rgb = (c) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0})`;

// Marching squares over the sky grid, in frame metres.
function contour(raster, levels) {
  const { nx, ny, cell_m, vmin, vmax } = raster.meta;
  const span = vmax - vmin;
  const S = (i, j) => vmin + (raster.values[j * nx + i] / 255) * span;
  return levels
    .filter((v) => v !== null)
    .map((thr) => {
      const seg = [];
      const push = (p, q) => seg.push(p[0], p[1], q[0], q[1]);
      for (let j = 0; j < ny - 1; j++) {
        for (let i = 0; i < nx - 1; i++) {
          const a = S(i, j),
            b = S(i + 1, j),
            c = S(i + 1, j + 1),
            d = S(i, j + 1);
          const k =
            (a > thr ? 8 : 0) |
            (b > thr ? 4 : 0) |
            (c > thr ? 2 : 0) |
            (d > thr ? 1 : 0);
          if (k === 0 || k === 15) continue;
          const T = () => [i + (thr - a) / (b - a), j];
          const R = () => [i + 1, j + (thr - b) / (c - b)];
          const B = () => [i + (thr - d) / (c - d), j + 1];
          const L = () => [i, j + (thr - a) / (d - a)];
          switch (k) {
            case 1:
            case 14:
              push(L(), B());
              break;
            case 2:
            case 13:
              push(B(), R());
              break;
            case 3:
            case 12:
              push(L(), R());
              break;
            case 4:
            case 11:
              push(T(), R());
              break;
            case 6:
            case 9:
              push(T(), B());
              break;
            case 7:
            case 8:
              push(T(), L());
              break;
            case 5:
              push(T(), L());
              push(B(), R());
              break;
            case 10:
              push(T(), R());
              push(L(), B());
              break;
          }
        }
      }
      const flat = new Float32Array(seg.length);
      for (let n = 0; n < seg.length; n++) flat[n] = (seg[n] + 0.5) * cell_m;
      return flat;
    });
}

export class Scene {
  constructor(canvas, data) {
    this.cv = canvas;
    this.cx = canvas.getContext("2d");
    this.data = data;
    this.show = {
      sky: true,
      glow: false,
      roads: false,
      spots: true,
      cont: true,
      grid: true,
    };
    this.sel = null;
    this.t = zoomIdentity;

    const [w, s, e, n] = data.sky.frame;
    this.frame = { w, s, e, n, width: e - w, height: n - s };
    this.roads = this.toFrame(data.roads);
    this.spots = data.spots.map((p) => ({
      ...p,
      xy: this.point(p.lon, p.lat),
    }));
    const path = (pts) => pts.map(([lon, lat]) => this.point(lon, lat));
    this.land = data.basemap.land.map(path);
    this.lakes = data.basemap.lakes.map(path);
    this.rivers = data.basemap.rivers.map(path);
    this.border = data.basemap.border.map(path);
    this.places = data.basemap.places.map(([name, lon, lat]) => ({
      name,
      xy: this.point(lon, lat),
    }));
    this.contours = contour(
      data.rasters.sky,
      data.sky.bortle.map((b) => b[0]),
    );

    const buildPath = (lists, close) => {
      const p = new Path2D();
      for (const pts of lists) {
        p.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < pts.length; i++) p.lineTo(pts[i][0], pts[i][1]);
        if (close) p.closePath();
      }
      return p;
    };
    this.landPath = buildPath(this.land, true);
    this.lakePath = buildPath(this.lakes, true);
    this.riverPath = buildPath(this.rivers, false);
    this.borderPath = buildPath(this.border, false);
    this.contourPaths = this.contours.map((seg) => {
      const p = new Path2D();
      for (let n = 0; n < seg.length; n += 4) {
        p.moveTo(seg[n], seg[n + 1]);
        p.lineTo(seg[n + 2], seg[n + 3]);
      }
      return p;
    });
    this.roadPaths = {};
    for (const [tier, lines] of Object.entries(this.roads)) {
      const p = new Path2D();
      for (const line of lines) {
        p.moveTo(line[0], line[1]);
        for (let i = 2; i < line.length; i += 2) p.lineTo(line[i], line[i + 1]);
      }
      this.roadPaths[tier] = p;
    }

    this._raf = 0;
    this.zoom = zoom()
      .scaleExtent([1, 60])
      .on("zoom", (ev) => {
        this.t = ev.transform;
        if (!this._raf) {
          this._raf = requestAnimationFrame(() => {
            this._raf = 0;
            this.draw();
          });
        }
      });
    select(canvas).call(this.zoom);
  }

  point(lon, lat) {
    const [x, y] = project(lon, lat);
    return [x - this.frame.w, this.frame.n - y];
  }

  toFrame(roads) {
    const out = {};
    for (const [tier, lines] of Object.entries(roads)) {
      out[tier] = lines.map((line) => {
        const flat = new Float32Array(line.length * 2);
        line.forEach(([lon, lat], i) => {
          const [x, y] = this.point(lon, lat);
          flat[i * 2] = x;
          flat[i * 2 + 1] = y;
        });
        return flat;
      });
    }
    return out;
  }

  resize() {
    const box = this.cv.parentElement.getBoundingClientRect();
    this.dpr = Math.min(2, devicePixelRatio || 1);
    const aspect = this.frame.width / this.frame.height;
    let w = box.width,
      h = box.height;
    if ((w - PADL - PADR) / (h - PADT - PADB) > aspect)
      w = (h - PADT - PADB) * aspect + PADL + PADR;
    else h = (w - PADL - PADR) / aspect + PADT + PADB;

    this.W = w;
    this.H = h;
    this.cv.width = Math.round(w * this.dpr);
    this.cv.height = Math.round(h * this.dpr);
    this.cv.style.width = `${w}px`;
    this.cv.style.height = `${h}px`;
    this.mw = w - PADL - PADR;
    this.mh = h - PADT - PADB;
    this.s0 = this.mw / this.frame.width;
    this.zoom
      .extent([
        [PADL, PADT],
        [PADL + this.mw, PADT + this.mh],
      ])
      .translateExtent([
        [PADL, PADT],
        [PADL + this.mw, PADT + this.mh],
      ]);
    select(this.cv).call(this.zoom.transform, this.t);
    this.draw();
  }

  // Frame metres, y already flipped down, to CSS pixels.
  screen(fx, fy) {
    const k = this.t.k * this.s0;
    return [
      this.t.x + this.t.k * PADL + fx * k,
      this.t.y + this.t.k * PADT + fy * k,
    ];
  }

  lonLat(sx, sy) {
    const k = this.t.k * this.s0;
    const fx = (sx - this.t.x - this.t.k * PADL) / k;
    const fy = (sy - this.t.y - this.t.k * PADT) / k;
    return invert(this.frame.w + fx, this.frame.n - fy);
  }

  // Build one path over a list of vertex lists, in frame metres.
  trace(paths, close) {
    const cx = this.cx;
    cx.beginPath();
    for (const pts of paths) {
      cx.moveTo(pts[0][0], pts[0][1]);
      for (let i = 1; i < pts.length; i++) cx.lineTo(pts[i][0], pts[i][1]);
      if (close) cx.closePath();
    }
  }

  applyTransform() {
    const cx = this.cx;
    cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    cx.translate(this.t.x, this.t.y);
    cx.scale(this.t.k, this.t.k);
    cx.translate(PADL, PADT);
    cx.scale(this.s0, this.s0);
  }

  draw() {
    const cx = this.cx;
    const INK = css("--ink"),
      INK2 = css("--ink2"),
      INK3 = css("--ink3"),
      AC = css("--accent"),
      PAPER = css("--paper");
    const dark = theme() === "dark";
    const k = this.t.k * this.s0;

    cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    cx.fillStyle = PAPER;
    cx.fillRect(0, 0, this.W, this.H);

    cx.save();
    cx.beginPath();
    cx.rect(PADL, PADT, this.mw, this.mh);
    cx.clip();

    this.applyTransform();

    const WATER = css("--water");
    cx.fillStyle = WATER;
    cx.fillRect(0, 0, this.frame.width, this.frame.height);
    cx.fillStyle = PAPER;
    cx.fill(this.landPath, "evenodd");
    cx.fillStyle = WATER;
    cx.fill(this.lakePath, "evenodd");

    cx.imageSmoothingEnabled = true;
    cx.imageSmoothingQuality = "high";
    cx.globalCompositeOperation = dark ? "screen" : "multiply";
    for (const name of ["sky", "glow"]) {
      if (!this.show[name]) continue;
      const r = this.data.rasters[name];
      cx.drawImage(r.canvas, 0, 0, this.frame.width, this.frame.height);
    }
    cx.globalCompositeOperation = "source-over";

    cx.strokeStyle = INK;
    cx.globalAlpha = dark ? 0.5 : 0.75;
    cx.lineWidth = 0.8 / k;
    cx.stroke(this.landPath);
    cx.lineWidth = 0.6 / k;
    cx.stroke(this.lakePath);

    cx.strokeStyle = INK2;
    cx.globalAlpha = dark ? 0.45 : 0.55;
    cx.lineWidth = 0.6 / k;
    cx.stroke(this.riverPath);

    cx.strokeStyle = INK3;
    cx.globalAlpha = 0.7;
    cx.lineWidth = 0.7 / k;
    cx.setLineDash([4 / k, 3 / k]);
    cx.stroke(this.borderPath);
    cx.setLineDash([]);
    cx.globalAlpha = 1;

    if (this.show.cont) {
      cx.lineJoin = "round";
      cx.lineCap = "round";
      this.contourPaths.forEach((path, i) => {
        const hot = i >= 3;
        cx.strokeStyle = hot ? AC : INK2;
        cx.globalAlpha = hot ? (dark ? 0.42 : 0.5) : dark ? 0.3 : 0.38;
        cx.lineWidth = (hot ? 0.55 : 0.45) / k;
        cx.stroke(path);
      });
      cx.globalAlpha = 1;
    }

    if (this.show.roads) {
      cx.lineCap = "round";
      cx.lineJoin = "round";
      for (const [tier, t, alpha, width, from] of TIERS) {
        if (this.t.k < from) continue;
        cx.strokeStyle = rgb(ramp(t));
        cx.globalAlpha = alpha;
        cx.lineWidth = width / k;
        cx.stroke(this.roadPaths[tier]);
      }
      cx.globalAlpha = 1;
    }

    if (this.show.grid) {
      cx.strokeStyle = AC;
      cx.globalAlpha = dark ? 0.22 : 0.34;
      cx.lineWidth = 0.5 / k;
      if (!this._gratPath) {
        this._gratPath = new Path2D();
        for (const g of this.graticule()) {
          this._gratPath.moveTo(g.pts[0][0], g.pts[0][1]);
          for (const p of g.pts.slice(1)) this._gratPath.lineTo(p[0], p[1]);
        }
      }
      cx.stroke(this._gratPath);
      cx.globalAlpha = 1;
    }

    cx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    cx.save();
    cx.beginPath();
    cx.rect(PADL, PADT, this.mw, this.mh);
    cx.clip();

    cx.font = SANS(9);
    cx.textBaseline = "middle";
    for (const place of this.places) {
      const [x, y] = this.screen(place.xy[0], place.xy[1]);
      cx.strokeStyle = INK;
      cx.globalAlpha = 0.55;
      cx.lineWidth = 0.7;
      cx.beginPath();
      cx.arc(x, y, 2.6, 0, 6.284);
      cx.stroke();
      cx.beginPath();
      cx.moveTo(x + 2.6, y);
      cx.lineTo(x + 8, y);
      cx.stroke();
      cx.globalAlpha = 0.9;
      cx.fillStyle = INK;
      cx.fillText(place.name, x + 10.5, y + 0.5);
      cx.globalAlpha = 1;
    }

    if (this.show.spots) {
      cx.font = SANS(8);
      cx.textBaseline = "middle";
      this.spots.forEach((p, i) => {
        const [x, y] = this.screen(p.xy[0], p.xy[1]);
        cx.strokeStyle = AC;
        cx.lineWidth = 0.9;
        cx.beginPath();
        cx.arc(x, y, 4, 0, 6.284);
        cx.stroke();
        cx.fillStyle = AC;
        cx.beginPath();
        cx.arc(x, y, 1.1, 0, 6.284);
        cx.fill();
        cx.fillText(String(i + 1).padStart(2, "0"), x + 6, y + 0.5);
      });
    }

    if (this.sel) {
      const [x, y] = this.screen(...this.point(this.sel.lon, this.sel.lat));
      cx.strokeStyle = AC;
      cx.lineWidth = 1;
      cx.beginPath();
      cx.arc(x, y, 8, 0, 6.284);
      cx.stroke();
      cx.beginPath();
      cx.moveTo(x - 14, y);
      cx.lineTo(x - 10, y);
      cx.moveTo(x + 10, y);
      cx.lineTo(x + 14, y);
      cx.moveTo(x, y - 14);
      cx.lineTo(x, y - 10);
      cx.moveTo(x, y + 10);
      cx.lineTo(x, y + 14);
      cx.stroke();
    }
    cx.restore();
    cx.restore();

    this.margins(INK, INK2, INK3);
  }

  // Half-degree meridians and parallels, as sampled polylines.
  graticule() {
    if (this._grat) return this._grat;
    const [w, s] = invert(this.frame.w, this.frame.s);
    const [e, n] = invert(this.frame.e, this.frame.n);
    const lo0 = Math.ceil(Math.min(w, e) * 2) / 2,
      lo1 = Math.max(w, e);
    const la0 = Math.ceil(Math.min(s, n) * 2) / 2,
      la1 = Math.max(s, n);
    const out = [];
    for (let lo = lo0; lo <= lo1; lo += 0.5) {
      const pts = [];
      for (let la = la0 - 0.5; la <= la1 + 0.5; la += 0.1)
        pts.push(this.point(lo, la));
      out.push({ lon: lo, pts });
    }
    for (let la = la0; la <= la1; la += 0.5) {
      const pts = [];
      for (let lo = lo0 - 0.5; lo <= lo1 + 0.5; lo += 0.1)
        pts.push(this.point(lo, la));
      out.push({ lat: la, pts });
    }
    this._grat = out;
    return out;
  }

  // Where a graticule line leaves the frame, in CSS pixels along that edge.
  crossing(pts, axis, at) {
    for (let i = 1; i < pts.length; i++) {
      const a = this.screen(pts[i - 1][0], pts[i - 1][1]);
      const b = this.screen(pts[i][0], pts[i][1]);
      if ((a[axis] - at) * (b[axis] - at) <= 0 && a[axis] !== b[axis]) {
        const f = (at - a[axis]) / (b[axis] - a[axis]);
        return a[1 - axis] + (b[1 - axis] - a[1 - axis]) * f;
      }
    }
    return null;
  }

  margins(INK, INK2, INK3) {
    const cx = this.cx;
    const bottom = PADT + this.mh,
      right = PADL + this.mw;
    cx.strokeStyle = INK;
    cx.lineWidth = 0.8;
    cx.strokeRect(PADL + 0.5, PADT + 0.5, this.mw - 1, this.mh - 1);

    cx.font = SANS(8);
    cx.fillStyle = INK3;
    cx.strokeStyle = INK3;
    cx.lineWidth = 0.6;
    cx.textAlign = "center";
    cx.textBaseline = "top";
    for (const g of this.graticule()) {
      if (g.lon === undefined) continue;
      const x = this.crossing(g.pts, 1, bottom);
      if (x === null || x < PADL || x > right) continue;
      cx.beginPath();
      cx.moveTo(x, bottom);
      cx.lineTo(x, bottom + 3.5);
      cx.stroke();
      cx.fillText(`${Math.abs(g.lon).toFixed(1)}°W`, x, bottom + 6);
    }
    cx.textAlign = "right";
    cx.textBaseline = "middle";
    for (const g of this.graticule()) {
      if (g.lat === undefined) continue;
      const y = this.crossing(g.pts, 0, PADL);
      if (y === null || y < PADT || y > bottom) continue;
      cx.beginPath();
      cx.moveTo(PADL - 3.5, y);
      cx.lineTo(PADL, y);
      cx.stroke();
      cx.fillText(`${g.lat.toFixed(1)}°N`, PADL - 5.5, y);
    }

    const perM = this.s0 * this.t.k;
    const nice = [1, 2, 5, 10, 20, 50, 100, 200].filter(
      (d) => d * 1000 * perM <= this.mw / 3,
    );
    const dist = nice.length ? nice[nice.length - 1] : 1;
    const bar = dist * 1000 * perM;
    const bx = PADL + 14,
      by = bottom - 16;
    cx.strokeStyle = INK;
    cx.lineWidth = 0.8;
    cx.textAlign = "center";
    cx.textBaseline = "bottom";
    cx.beginPath();
    cx.moveTo(bx, by);
    cx.lineTo(bx + bar, by);
    cx.stroke();
    for (let i = 0; i <= 5; i++) {
      const x = bx + (bar * i) / 5;
      cx.beginPath();
      cx.moveTo(x, by);
      cx.lineTo(x, by - (i % 5 ? 3 : 5));
      cx.stroke();
    }
    cx.fillStyle = INK2;
    cx.fillText("0", bx, by - 7);
    cx.fillText(`${dist} km`, bx + bar, by - 7);
    cx.textAlign = "left";
    cx.textBaseline = "alphabetic";
  }
}
