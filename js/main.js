import { load, repaint } from "./layers.js";
import { init as initPanel, probe } from "./panel.js";
import { Scene } from "./scene.js";
import { onTheme, restore, setTheme, theme } from "./theme.js";

const $ = (id) => document.getElementById(id);

const data = await load();
const scene = new Scene($("map"), data);
window.vns = { scene, data, probe };

function redraw() {
  repaint(data.rasters);
  scene.draw();
}

function toggle(id, key) {
  const b = $(id);
  b.setAttribute("aria-pressed", String(scene.show[key]));
  b.onclick = () => {
    scene.show[key] = !scene.show[key];
    b.setAttribute("aria-pressed", String(scene.show[key]));
    scene.draw();
  };
}

for (const [id, key] of [
  ["b-sky", "sky"],
  ["b-glow", "glow"],
  ["b-roads", "roads"],
  ["b-stars", "stars"],
  ["b-spots", "spots"],
  ["b-cont", "cont"],
  ["b-grid", "grid"],
])
  toggle(id, key);

const methodEl = $("method");
const bMethod = $("b-method");

// Sit the method sheet exactly on the map's stroked frame.
function placeMethod() {
  const r = scene.plotRect();
  methodEl.style.left = `${r.left}px`;
  methodEl.style.top = `${r.top}px`;
  methodEl.style.width = `${r.width}px`;
  methodEl.style.height = `${r.height}px`;
}

scene.onResize = placeMethod;

function renderMath() {
  if (window.renderMathInElement && methodEl) {
    window.renderMathInElement(methodEl, {
      delimiters: [
        { left: "$$", right: "$$", display: true },
        { left: "\\(", right: "\\)", display: false },
        { left: "$", right: "$", display: false },
      ],
      throwOnError: false,
    });
  }
}

bMethod.onclick = () => {
  const on = methodEl.hidden;
  methodEl.hidden = !on;
  if (on) renderMath();
  // Keep the canvas laid out (placeMethod reads its box) but drop the map
  // and its coordinate margins while the sheet is up.
  scene.cv.style.visibility = on ? "hidden" : "";
  bMethod.setAttribute("aria-pressed", String(on));
};

$("b-theme").onclick = () => setTheme(theme() === "dark" ? "light" : "dark");
onTheme((name) => {
  const b = $("b-theme");
  b.textContent = name === "dark" ? "Light" : "Dark";
  b.setAttribute("aria-pressed", String(name === "light"));
  redraw();
});

initPanel(scene, data);
addEventListener("resize", () => scene.resize());
window.addEventListener("load", renderMath);
restore();
scene.resize();
renderMath();
