// BC Albers (EPSG:3005) on the GRS80 ellipsoid, Snyder 14-4.

const A = 6378137,
  F = 1 / 298.257222101;
const E2 = F * (2 - F),
  E = Math.sqrt(E2);
const RAD = Math.PI / 180;

const LAT1 = 50 * RAD,
  LAT2 = 58.5 * RAD,
  LAT0 = 45 * RAD,
  LON0 = -126 * RAD;
const X0 = 1e6,
  Y0 = 0;

const q = (phi) => {
  const s = Math.sin(phi);
  return (
    (1 - E2) *
    (s / (1 - E2 * s * s) - Math.log((1 - E * s) / (1 + E * s)) / (2 * E))
  );
};
const m = (phi) => {
  const s = Math.sin(phi);
  return Math.cos(phi) / Math.sqrt(1 - E2 * s * s);
};

const m1 = m(LAT1),
  m2 = m(LAT2),
  q1 = q(LAT1),
  q2 = q(LAT2);
const N = (m1 * m1 - m2 * m2) / (q2 - q1);
const C = m1 * m1 + N * q1;
const RHO0 = (A * Math.sqrt(C - N * q(LAT0))) / N;

export function project(lon, lat) {
  const rho = (A * Math.sqrt(C - N * q(lat * RAD))) / N;
  const theta = N * (lon * RAD - LON0);
  return [X0 + rho * Math.sin(theta), Y0 + RHO0 - rho * Math.cos(theta)];
}

export function invert(x, y) {
  const dx = x - X0,
    dy = RHO0 - (y - Y0);
  const rho = Math.hypot(dx, dy);
  const qv = (C - (rho * rho * N * N) / (A * A)) / N;
  let phi = Math.asin(Math.min(1, Math.max(-1, qv / 2)));
  for (let i = 0; i < 12; i++) {
    const s = Math.sin(phi),
      t = 1 - E2 * s * s;
    const d =
      ((t * t) / (2 * Math.cos(phi))) *
      (qv / (1 - E2) - s / t + Math.log((1 - E * s) / (1 + E * s)) / (2 * E));
    phi += d;
    if (Math.abs(d) < 1e-12) break;
  }
  return [(LON0 + Math.atan2(dx, dy) / N) / RAD, phi / RAD];
}
