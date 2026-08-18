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
  ["b-spots", "spots"],
  ["b-cont", "cont"],
  ["b-grid", "grid"],
])
  toggle(id, key);

$("b-theme").onclick = () => setTheme(theme() === "dark" ? "light" : "dark");
onTheme((name) => {
  const b = $("b-theme");
  b.textContent = name === "dark" ? "Light" : "Dark";
  b.setAttribute("aria-pressed", String(name === "light"));
  redraw();
});

initPanel(scene, data);
addEventListener("resize", () => scene.resize());
restore();
scene.resize();
