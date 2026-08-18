import os

import ee
import numpy as np
import rasterio
import requests

import config
import rasterout


def init():
    """Start Earth Engine using the project id in $EE_PROJECT."""
    project = os.environ.get("EE_PROJECT")
    if not project:
        raise SystemExit("set EE_PROJECT to your Earth Engine cloud project id")
    ee.Initialize(project=project)


def fetch():
    """Download the latest VIIRS annual composite straight onto the frame grid."""
    if config.VIIRS_TIF.exists():
        return config.VIIRS_TIF
    init()
    cell = config.GLOW_CELL_M
    ny, nx = rasterout.grid_shape(cell)
    year = config.VIIRS_YEAR
    coll = ee.ImageCollection(config.VIIRS_COLLECTION).filter(
        ee.Filter.calendarRange(year, year, "year")
    )
    url = ee.Image(coll.first()).select(config.VIIRS_BAND).getDownloadURL({
        "crs": config.CRS,
        "crs_transform": [cell, 0, config.FRAME_W, 0, -cell, config.FRAME_N],
        "dimensions": f"{nx}x{ny}",
        "format": "GEO_TIFF",
    })
    r = requests.get(url, timeout=300)
    r.raise_for_status()
    config.VIIRS_TIF.write_bytes(r.content)
    print(f"viirs {year}, {nx}x{ny} at {cell} m")
    return config.VIIRS_TIF


def build():
    """Write glow.png and its layers.json entry from the VIIRS composite."""
    fetch()
    with rasterio.open(config.VIIRS_TIF) as src:
        rad = src.read(1).astype("float64")
    logv = np.log1p(np.clip(rad, 0, None))
    vmin = float(np.log1p(config.GLOW_FLOOR))
    on = logv > vmin
    vmax = float(np.percentile(logv[on], config.GLOW_CLIP_PCT))

    px = np.zeros_like(logv)
    px[on] = 1 + np.clip((logv[on] - vmin) / (vmax - vmin), 0, 1) ** config.GLOW_GAMMA * 254
    rasterout.write_png("glow", px)

    ny, nx = logv.shape
    rasterout.update_meta("glow", {
        "file": "glow.png", "kind": "sequential", "encode": "log1p",
        "vmin_log": round(vmin, 4), "vmax_log": round(vmax, 4),
        "gamma": config.GLOW_GAMMA, "cell_m": config.GLOW_CELL_M,
        "nx": nx, "ny": ny,
        "legend": ["dark", "upward radiance", "bright"],
        "year": config.VIIRS_YEAR,
        "note": f"VIIRS DNB {config.VIIRS_YEAR} annual {config.VIIRS_BAND}",
    })
    return px


if __name__ == "__main__":
    build()
