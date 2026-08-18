import json

import ee
import numpy as np
from pyproj import Transformer

import config
import glow
import rasterout
import sky
from visibility import load_objects, luminance_to_mag, mag_to_bortle, mag_to_nelm, visible_objects

_fwd = Transformer.from_crs("EPSG:4326", config.CRS, always_xy=True)
_inv = Transformer.from_crs(config.CRS, "EPSG:4326", always_xy=True)
_anchors = [(n, *_fwd.transform(lon, lat)) for n, lon, lat in config.SPOT_REGIONS]


def rank(S, land):
    """Darkest land cell near each anchor, dark first, thinned to SPOT_MIN_SEP_M apart."""
    cell = config.SKY_CELL_M
    ny, nx = S.shape
    x = config.FRAME_W + (np.arange(nx) + 0.5) * cell
    y = config.FRAME_N - (np.arange(ny) + 0.5) * cell
    picks = []
    for name, ax, ay in _anchors:
        d2 = (x - ax) ** 2 + (y[:, None] - ay) ** 2
        near = land & (d2 <= config.SPOT_ANCHOR_RADIUS_M ** 2)
        if not near.any():
            continue
        r, c = divmod(int(np.argmax(np.where(near, S, -np.inf))), nx)
        picks.append((float(S[r, c]), name, r, c))
    picks.sort(reverse=True)

    sep = (config.SPOT_MIN_SEP_M / cell) ** 2
    kept = []
    for p in picks:
        if all((p[2] - k[2]) ** 2 + (p[3] - k[3]) ** 2 >= sep for k in kept):
            kept.append(p)
            if len(kept) == config.SPOT_COUNT:
                break
    return kept


def elevations(pts):
    """Copernicus GLO-30 elevation in metres at each lon/lat."""
    glow.init()
    fc = ee.FeatureCollection([
        ee.Feature(ee.Geometry.Point(lon, lat), {"i": i})
        for i, (lon, lat) in enumerate(pts)
    ])
    dem = ee.ImageCollection(config.DEM_COLLECTION).select("DEM").mosaic()
    got = dem.sampleRegions(collection=fc, scale=30).getInfo()["features"]
    z = {f["properties"]["i"]: f["properties"]["DEM"] for f in got}
    return [z.get(i) for i in range(len(pts))]


def build():
    """Write spots.json, one site per named region sorted by sky brightness."""
    cell = config.SKY_CELL_M
    S = luminance_to_mag(sky.to_frame(cell))
    picks = rank(S, sky.land_mask(cell))
    xy = [
        (config.FRAME_W + (c + 0.5) * cell, config.FRAME_N - (r + 0.5) * cell)
        for _, _, r, c in picks
    ]
    lonlat = [_inv.transform(x, y) for x, y in xy]
    elev = elevations(lonlat)
    vx, vy = _fwd.transform(*config.VANCOUVER)
    objects = load_objects()

    out = []
    for (v, name, _, _), (x, y), (lon, lat), z in zip(picks, xy, lonlat, elev):
        out.append({
            "name": name,
            "lon": round(lon, 4),
            "lat": round(lat, 4),
            "s": round(v, 2),
            "bortle": mag_to_bortle(v)[0],
            "nelm": round(float(mag_to_nelm(v)), 2),
            "elev_m": None if z is None else round(z),
            "dist_km": round(float(np.hypot(x - vx, y - vy)) / 1000),
            "objects": sum(len(names) for names in visible_objects(v, objects).values()),
        })
    rasterout.write_json("spots", out)
    return out


def check(spots=None):
    """Assert the spot count, the ordering, the land mask and the separation."""
    if spots is None:
        spots = json.loads((config.ASSETS / "spots.json").read_text())
    n = len(spots)
    assert 0 < n <= config.SPOT_COUNT, f"{n} spots, want 1 to {config.SPOT_COUNT}"
    names = [x["name"] for x in spots]
    assert len(set(names)) == n, "two spots share a name"
    s = [x["s"] for x in spots]
    assert s == sorted(s, reverse=True), "spots are not sorted by sky brightness"
    land = sky.land_mask(config.SKY_CELL_M)
    for x in spots:
        r, c = sky.cell_of(x["lon"], x["lat"], config.SKY_CELL_M)
        assert land[r, c], f"{x['name']} falls on water"

    xy = [_fwd.transform(x["lon"], x["lat"]) for x in spots]
    for i, (ax, ay) in enumerate(xy):
        for bx, by in xy[i + 1:]:
            d = float(np.hypot(ax - bx, ay - by))
            # 20 m of slack for the 4-decimal rounding in spots.json.
            assert d >= config.SPOT_MIN_SEP_M - 20, f"two spots are {d / 1000:.2f} km apart"


def probe(spots):
    """Print the ranked spots."""
    for i, s in enumerate(spots, 1):
        print(
            f"  {i:2d} {s['name']:26s} S={s['s']:5.2f} B{s['bortle']} "
            f"nelm {s['nelm']:4.2f} {str(s['elev_m']):>5s} m {s['dist_km']:3d} km"
        )


if __name__ == "__main__":
    out = build()
    check(out)
    probe(out)
