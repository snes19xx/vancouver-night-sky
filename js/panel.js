import { project } from "./albers.js";
import { drawPatch, ladder, scaleChart } from "./charts.js";
import { ramp } from "./layers.js";
import { onTheme } from "./theme.js";

const VAN = [-123.1207, 49.2827];
const $ = (id) => document.getElementById(id);
const PAGES = ["Site", "Sky", "Objects"];
const rgb = (c) => `rgb(${c[0] | 0} ${c[1] | 0} ${c[2] | 0})`;
const tOf = (S) => Math.max(0, Math.min(1, (22.0 - S) / (22.0 - 16.6)));
const countOf = (N) => Math.round(7.5 * Math.pow(3.1, N - 1));

const BANDS = [
  [22.25, 21.99, 1],
  [21.99, 21.89, 2],
  [21.89, 21.69, 3],
  [21.69, 20.49, 4],
  [20.49, 19.5, 5],
  [19.5, 18.94, 6],
  [18.94, 18.38, 7],
  [18.38, 17.8, 8],
  [17.8, 16.4, 9],
];

let scene,
  data,
  page = 0,
  vanS,
  last = null;

export function skyAt(lon, lat) {
  const [x, y] = project(lon, lat);
  const { nx, ny, cell_m, frame, scale, offset } = data.sky;
  const col = Math.floor((x - frame[0]) / cell_m);
  const row = Math.floor((frame[3] - y) / cell_m);
  if (col < 0 || col >= nx || row < 0 || row >= ny) return null;
  return offset + data.skyBin[row * nx + col] * scale;
}

export function bortleOf(S) {
  for (const [floor, k, label] of data.sky.bortle)
    if (floor === null || S >= floor) return [k, label];
}

export function nelmOf(S) {
  return 7.93 - 5 * Math.log10(Math.pow(10, 4.316 - S / 5) + 1);
}

function ratioOf(S) {
  return (data.sky.l0_mcd * Math.pow(10, -S / 2.5)) / data.sky.natural_mcd - 1;
}

function countVisible(S) {
  const N = nelmOf(S);
  const stars = data.objects.stars.filter((o) => o.mag < N).length;
  const ext = data.objects.extended.filter((o) => S >= o.s_threshold).length;
  return { stars, ext, total: stars + ext };
}

function distKm(lon, lat) {
  const [x1, y1] = project(lon, lat);
  const [x2, y2] = project(...VAN);
  return Math.hypot(x1 - x2, y1 - y2) / 1000;
}

export function probe(lon, lat) {
  const S = skyAt(lon, lat);
  if (S === null) return null;
  const [cls, label] = bortleOf(S);
  const N = nelmOf(S);
  const r = ratioOf(S);
  const vis = countVisible(S);
  return { S, bortle: cls, label, nelm: N, ratio: 1 + r, ...vis };
}

function physChart(S, N, ratio, availH, availW) {
  const w = Math.max(280, Math.min(360, availW || 318));
  const h = Math.max(190, Math.min(560, availH || 300));
  const PT = 20,
    PB = 30,
    PL = 28,
    PR = 26;
  const IW = w - PL - PR,
    IH = h - PT - PB;
  const x = (v) => PL + ((22.25 - v) / (22.25 - 16.4)) * IW;
  const maxC = countOf(nelmOf(22.25));
  const yC = (c) => PT + (1 - c / maxC) * IH;
  const yN = (v) => PT + (1 - (v - 2) / 5) * IH;

  const cls = bortleOf(S)[0];
  let o = "";

  for (const [a, b, k] of BANDS) {
    const c = rgb(ramp(tOf((a + b) / 2)));
    const X = x(a),
      W = x(b) - x(a);
    o += `<rect x="${X}" y="${PT}" width="${W}" height="${IH}" fill="${c}" opacity="0.14"/>`;
    if (k === cls)
      o += `<rect x="${X}" y="${PT}" width="${W}" height="${IH}" fill="var(--accent)" opacity="0.12"/>`;
    if (W > 14)
      o += `<text class="t" x="${X + W / 2}" y="${PT - 5}" text-anchor="middle" fill="${k === cls ? "var(--accent)" : "var(--ink3)"}">${k}</text>`;
  }

  const P = [],
    Q = [];
  for (let k = 0; k <= 90; k++) {
    const v = 22.25 - (k / 90) * (22.25 - 16.4);
    P.push([x(v), yC(countOf(nelmOf(v)))]);
    Q.push([x(v), yN(nelmOf(v))]);
  }
  const d = (a) =>
    a.map((q) => `${q[0].toFixed(1)},${q[1].toFixed(1)}`).join(" L");

  o += `<path d="M${PL},${PT + IH} L${d(P)} L${PL + IW},${PT + IH} Z" fill="var(--ok)" opacity=".16"/>`;
  o += `<path d="M${d(P)}" fill="none" stroke="var(--ok)" stroke-width="1.4"/>`;
  o += `<path d="M${d(Q)}" fill="none" stroke="var(--ink2)" stroke-width=".9" stroke-dasharray="3 2.5"/>`;

  for (const [v, lb] of [
    [vanS, "city"],
    [22.0, "pristine"],
  ]) {
    o += `<line x1="${x(v)}" y1="${PT + IH}" x2="${x(v)}" y2="${PT + IH + 4}" stroke="var(--ink3)" stroke-width=".6"/>`;
    o += `<text class="t" x="${x(v)}" y="${PT + IH + 12}" text-anchor="middle">${lb}</text>`;
  }

  const mx = x(S),
    mc = yC(countOf(N)),
    mn = yN(N);
  o += `<line x1="${mx}" y1="${PT}" x2="${mx}" y2="${PT + IH}" stroke="var(--accent)" stroke-width="1.1"/>`;
  o += `<circle cx="${mx}" cy="${mc}" r="4" fill="var(--ok)" stroke="var(--paper)" stroke-width="1"/>`;
  o += `<circle cx="${mx}" cy="${mn}" r="3" fill="var(--ink)" stroke="var(--paper)" stroke-width="1"/>`;

  const RW = 140,
    RH = 58;
  const rx = mx > w * 0.55 ? PL + 10 : PL + IW - RW - 10;
  const ry = PT + 10;
  const key = [
    [0, "var(--ok)", "0", `${countOf(N).toLocaleString()} stars`, "var(--ink)"],
    [1, "var(--ink2)", "3 2", `mag ${N.toFixed(2)} limit`, "var(--ink)"],
    [
      2,
      "var(--accent)",
      "0",
      `${(1 + ratio).toFixed(1)}× natural sky`,
      "var(--ink2)",
    ],
  ];
  o += `<rect x="${rx}" y="${ry}" width="${RW}" height="${RH}" fill="var(--paper)" opacity=".92"/>`;
  for (const [k, col, dash, txt, fill] of key) {
    const ky = ry + 15 + k * 15;
    o += `<line x1="${rx + 10}" y1="${ky - 3.5}" x2="${rx + 24}" y2="${ky - 3.5}" stroke="${col}" stroke-width="1.6" stroke-dasharray="${dash}"/>`;
    o += `<text class="o" x="${rx + 31}" y="${ky}" style="font-size:11px" fill="${fill}">${txt}</text>`;
  }

  o += `<text class="t" x="${PL - 6}" y="${PT + 8}" text-anchor="end">More</text>`;
  o += `<text class="t" x="${PL - 6}" y="${PT + IH / 2 + 3}" text-anchor="end" style="font-size:7px;letter-spacing:.14em;text-transform:uppercase">Stars</text>`;
  o += `<text class="t" x="${PL - 6}" y="${PT + IH - 2}" text-anchor="end">Less</text>`;

  for (let v = 22; v >= 17; v--)
    o += `<text class="t" x="${x(v)}" y="${PT + IH + 22}" text-anchor="middle">${v}</text>`;
  o += `<line x1="${PL}" y1="${PT + IH}" x2="${PL + IW}" y2="${PT + IH}" stroke="var(--ink3)" stroke-width=".6"/>`;

  return `<svg viewBox="-4 -14 ${w + 8} ${h + 16}" width="100%">${o}</svg>`;
}

function fit() {
  if (!last) return;
  const ph = $("physHost");
  if (ph)
    ph.innerHTML = physChart(
      last.S,
      last.N,
      last.ratio,
      ph.clientHeight,
      ph.clientWidth,
    );
  const duo = document.querySelector(".duo");
  if (duo) {
    const gap = 14,
      lab = 22;
    let side = Math.min(
      duo.clientWidth,
      Math.floor((duo.clientHeight - gap - 2 * lab) / 2),
    );
    side = Math.max(70, side);
    for (const id of ["pHere", "pPure"]) {
      const c = $(id);
      if (!c) continue;
      c.style.width = side + "px";
      c.style.height = side + "px";
      c.parentElement.style.width = side + "px";
    }
  }
  drawPatch($("pHere"), last.N);
  drawPatch($("pPure"), last.pure);
  const host = $("ladderHost");
  if (host)
    host.innerHTML = ladder(last.N, last.S, data.objects, host.clientHeight);
}

function close() {
  scene.sel = null;
  last = null;
  render();
}

function render() {
  const panel = $("panel"),
    wrap = $("wrap"),
    pages = $("pages");
  if (!scene.sel) {
    panel.hidden = true;
    pages.innerHTML = "";
    wrap.classList.remove("split");
    scene.resize();
    return;
  }

  const { lon, lat } = scene.sel;
  const S = skyAt(lon, lat);
  if (S === null) {
    close();
    return;
  }

  const [cls, label] = bortleOf(S);
  const N = nelmOf(S);
  const r = ratioOf(S);
  const dist = distKm(lon, lat);

  const tile = (v, k) => `<div class="tile"><b>${v}</b><span>${k}</span></div>`;

  const pure = nelmOf(22.0);
  const vis = countVisible(S);

  pages.innerHTML = `
  <section class="pg">
    <div class="hd">
      <b>${lat.toFixed(3)}°N ${Math.abs(lon).toFixed(3)}°W</b>
      <button class="x" id="close-panel" aria-label="Close">×</button>
    </div>
    <div class="grow">
      <div id="physHost" style="flex:1 1 auto;min-height:0"></div>
      <div class="note" style="padding:.4rem 0 0;line-height:1.45">
        <p style="margin:0 0 .15rem">mag ${N.toFixed(1)} — faintest star your eye can see here</p>
        <p style="margin:0 0 .15rem">sky is ${(1 + r).toFixed(1)}× the natural brightness</p>
        <p style="margin:0">red band — the Bortle ${cls} range this site falls in</p>
      </div>
      <div class="sfoot">
        ${tile(cls, `bortle · ${label}`)}
        ${tile(`${Math.round(dist)}<u>km</u>`, "from vancouver")}
      </div>
    </div>
  </section>

  <section class="pg">
    <div class="hd">
      <b>Simulated sky</b>
      <button class="x" id="close-sky" aria-label="Close">×</button>
    </div>
    <div class="grow">
      <div class="duo">
        <div class="pw"><canvas class="patch" id="pHere"></canvas>
          <div class="pl"><b>Here</b><span>${countOf(N).toLocaleString()}</span></div></div>
        <div class="pw"><canvas class="patch" id="pPure"></canvas>
          <div class="pl"><b>Pristine</b><span>${countOf(pure).toLocaleString()}</span></div></div>
      </div>
      ${scaleChart(S)}
    </div>
  </section>

  <section class="pg">
    <div class="hd">
      <b>What survives</b>
      <span>${vis.stars}/${data.objects.stars.length} stars · ${vis.ext}/${data.objects.extended.length} deep-sky</span>
      <button class="x" id="close-obj" aria-label="Close">×</button>
    </div>
    <div class="grow">
      <div id="ladderHost" style="flex:1 1 auto;min-height:0;padding-top:.35rem"></div>
      <div class="legend"><s>visible</s><s class="o">invisible</s><s class="h">deep-sky</s></div>
    </div>
  </section>`;

  last = { S, N, ratio: r, pure };
  panel.hidden = false;
  wrap.classList.add("split");
  page = 0;
  syncPager();
  $("close-panel").onclick = close;
  $("close-sky").onclick = close;
  $("close-obj").onclick = close;
  scene.resize();
  requestAnimationFrame(fit);
}

function syncPager() {
  const tabs = $("tabs");
  tabs.innerHTML = PAGES.map(
    (nm, k) =>
      `<button data-p="${k}" class="${k === page ? "on" : ""}">${nm}</button>`,
  ).join("");
  tabs
    .querySelectorAll("button")
    .forEach((b) => (b.onclick = () => goto(+b.dataset.p)));
  $("prev").disabled = page === 0;
  $("next").disabled = page === PAGES.length - 1;
}

function goto(i) {
  const el = $("pages");
  page = Math.max(0, Math.min(PAGES.length - 1, i));
  el.scrollTo({ top: page * el.clientHeight, behavior: "smooth" });
  syncPager();
}

export function init(s, d) {
  scene = s;
  data = d;
  vanS = skyAt(...VAN);

  let down = null;
  s.cv.addEventListener("pointerdown", (e) => {
    down = [e.clientX, e.clientY];
  });
  s.cv.addEventListener("click", (e) => {
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 4)
      return;
    const rect = s.cv.getBoundingClientRect();
    const [lon, lat] = s.lonLat(e.clientX - rect.left, e.clientY - rect.top);
    const [x, y] = project(lon, lat);
    const f = data.sky.frame;
    if (x < f[0] || x > f[2] || y < f[1] || y > f[3]) return;
    s.sel = { lon, lat };
    render();
  });

  $("prev").onclick = () => goto(page - 1);
  $("next").onclick = () => goto(page + 1);

  $("pages").addEventListener("scroll", () => {
    const el = $("pages");
    const i = Math.round(el.scrollTop / Math.max(1, el.clientHeight));
    if (i !== page && i >= 0 && i < PAGES.length) {
      page = i;
      syncPager();
    }
  });

  addEventListener("keydown", (e) => {
    if (!scene.sel) return;
    if (e.key === "Escape") close();
    if (e.key === "ArrowDown" || e.key === "PageDown") {
      e.preventDefault();
      goto(page + 1);
    }
    if (e.key === "ArrowUp" || e.key === "PageUp") {
      e.preventDefault();
      goto(page - 1);
    }
  });

  addEventListener("resize", () => {
    if (!scene.sel) return;
    const el = $("pages");
    el.scrollTop = page * el.clientHeight;
    fit();
  });

  onTheme(() => fit());
}
