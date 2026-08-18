const KEY = "vns-theme";
const listeners = [];

export function theme() {
  return document.documentElement.dataset.theme;
}

export function css(name) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(name)
    .trim();
}

export function setTheme(name) {
  document.documentElement.dataset.theme = name;
  localStorage.setItem(KEY, name);
  listeners.forEach((fn) => fn(name));
}

export function onTheme(fn) {
  listeners.push(fn);
}

export function restore() {
  setTheme(localStorage.getItem(KEY) || "dark");
}
