import { ramp } from "./layers.js";
import { theme } from "./theme.js";

const nelmOf = (S) => 7.93 - 5 * Math.log10(Math.pow(10, 4.316 - S / 5) + 1);
const tOf = (S) => Math.max(0, Math.min(1, (22.0 - S) / (22.0 - 16.6)));
const rgb = (c) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0})`;

const LADDER_STARS = [
  "Sirius", "Vega", "Capella", "Betelgeuse", "Altair",
  "Deneb", "Polaris", "Mizar", "Alcor",
];

function lcg(seed) {
  let s = seed;
  return () => (s = (s * 16807) % 2147483647) / 2147483647;
}

const PATCH = (() => {
  const a = [], r = lcg(31);
  for (let k = 0; k < 3200; k++) {
    const u = r();
    a.push({
      x: r(), y: r(),
      m: -1 + Math.log(1 + u * (Math.pow(3.1, 7.6) - 1)) / Math.log(3.1),
    });
  }
  return a;
})();

export function drawPatch(c, N) {
  if (!c) return;
  const w = c.clientWidth, h = c.clientHeight;
  if (!w || !h) return;
  const g = c.getContext("2d"), d = Math.min(2, devicePixelRatio || 1);
  c.width = w * d;
  c.height = h * d;
  g.setTransform(d, 0, 0, d, 0, 0);
  const dark = theme() === "dark";
  g.fillStyle = dark ? "#04060a" : "#eceae4";
  g.fillRect(0, 0, w, h);
  g.fillStyle = dark ? "#f2efe8" : "#15171a";
  for (const s of PATCH) {
    if (s.m > N) continue;
    const br = Math.min(1, Math.pow(10, (1.8 - s.m) / 3.6));
    g.globalAlpha = 0.18 + 0.82 * br * Math.min(1, (N - s.m) / 1.2);
    g.beginPath();
    g.arc(s.x * w, s.y * h, 0.35 + 1.7 * br, 0, 6.284);
    g.fill();
  }
  g.globalAlpha = 1;
  g.strokeStyle = dark ? "#2a2d33" : "#c9c5bc";
  g.lineWidth = 1;
  g.strokeRect(0.5, 0.5, w - 1, h - 1);
}

export function scaleChart(S) {
  const w = 318;
  const x = (v) => ((22.2 - v) / (22.2 - 16.4)) * w;
  let g = "";
  for (let k = 0; k <= 64; k++) {
    const v = 22.2 - (k / 64) * (22.2 - 16.4);
    const c = rgb(ramp(tOf(v)));
    g += `<rect x="${((k / 64) * w).toFixed(1)}" y="0" width="${(w / 64 + 0.7).toFixed(1)}" height="9" fill="${c}"/>`;
  }
  let t = "";
  for (let v = 22; v >= 17; v--)
    t += `<line x1="${x(v)}" y1="9" x2="${x(v)}" y2="13" stroke="var(--ink3)" stroke-width=".6"/>
      <text class="t" x="${x(v)}" y="21" text-anchor="middle">${v}</text>`;
  const q = x(S);
  return `<svg viewBox="-8 -17 ${w + 16} 44" width="100%">
    <rect x="0" y="0" width="${w}" height="9" fill="none" stroke="var(--ink3)" stroke-width=".6"/>
    ${g}${t}<line x1="${q}" y1="-3" x2="${q}" y2="9" stroke="var(--accent)" stroke-width="1"/>
    <path d="M${q - 3.4},-8 L${q + 3.4},-8 L${q},-3 Z" fill="var(--accent)"/>
    <text class="t" x="${q}" y="-11" text-anchor="middle" fill="var(--accent)">${S.toFixed(2)}</text>
    <text class="t" x="${w}" y="31" text-anchor="end">mag / arcsec²</text></svg>`;
}

export function ladder(N, S, objects, availH) {
  const W_ = 318, LAB = 98, AX0 = LAB + 10, AXW = W_ - AX0 - 4;
  const MIN = -1.8, LIM = 6.9;
  const x = (m) => AX0 + ((m - MIN) / (LIM - MIN)) * AXW;

  const stars = LADDER_STARS
    .map((n) => {
      const obj = objects.stars.find((o) => o.name === n);
      return obj ? { n, m: obj.mag, e: 0 } : null;
    })
    .filter(Boolean);
  const ext = objects.extended.map((o) => ({
    n: o.name, m: nelmOf(o.s_threshold), s: o.s_threshold, e: 1,
  }));
  const rows = [...stars, ...ext];
  const step = Math.max(15, Math.min(46, ((availH || 300) - 70) / rows.length));
  const fs = Math.max(9, Math.min(12.5, step * 0.4));
  const HH = rows.length * step, nx = x(N);

  const mark = (X, cy, isExt, vis) => {
    const c = vis ? "var(--ok)" : "var(--accent)", r = isExt ? 4 : 2.9;
    return isExt
      ? `<path d="M${X},${cy - r} L${X + r},${cy} L${X},${cy + r} L${X - r},${cy} Z" fill="${c}"/>`
      : `<circle cx="${X}" cy="${cy}" r="${r}" fill="${c}"/>`;
  };

  const dark = theme() === "dark";
  let o = `<defs><pattern id="hx" width="5" height="5" patternUnits="userSpaceOnUse"
      patternTransform="rotate(45)">
      <line x1="0" y1="0" x2="0" y2="5" stroke="var(--accent)" stroke-width="1.4" opacity="${dark ? .25 : .45}"/>
    </pattern></defs>
    <rect x="${nx}" y="-4" width="${Math.max(0, AX0 + AXW - nx)}" height="${HH + 4}" fill="url(#hx)"/>`;

  let y = 0, divider = null;
  for (const d of rows) {
    if (d.e && divider === null) divider = y;
    const vis = d.e ? S >= d.s : d.m < N;
    const X = x(d.m), cy = y + step / 2;
    o += `<text class="o ${vis ? "" : "x"}" x="${LAB}" y="${cy + fs * 0.35}" text-anchor="end"
        style="font-size:${fs}px">${d.n}</text>
      <line x1="${AX0}" y1="${cy}" x2="${X}" y2="${cy}" stroke="var(--ink3)"
        stroke-width=".6" opacity="${vis ? 0.6 : 0.28}"/>
      ${mark(X, cy, d.e, vis)}`;
    y += step;
  }
  if (divider !== null)
    o += `<line x1="0" y1="${divider}" x2="${W_}" y2="${divider}" stroke="var(--rule)" stroke-width=".8"/>`;

  o += `<line x1="${nx}" y1="-4" x2="${nx}" y2="${HH + 3}" stroke="var(--accent)" stroke-width="1"/>
    <text class="t" x="${nx}" y="-8" text-anchor="middle" fill="var(--accent)">${N.toFixed(2)}</text>
    <line x1="${AX0}" y1="${HH + 3}" x2="${AX0 + AXW}" y2="${HH + 3}" stroke="var(--ink3)" stroke-width=".6"/>`;
  for (let m = -1; m <= 6; m++)
    o += `<line x1="${x(m)}" y1="${HH + 3}" x2="${x(m)}" y2="${HH + 6.5}"
      stroke="var(--ink3)" stroke-width=".6"/>
      <text class="t" x="${x(m)}" y="${HH + 15}" text-anchor="middle">${m}</text>`;
  o += `<text class="t" x="${AX0 + AXW}" y="${HH + 25}" text-anchor="end">apparent magnitude</text>`;

  return `<svg viewBox="-4 -18 ${W_ + 8} ${HH + 46}" width="100%">${o}</svg>`;
}
