import zipfile

import geopandas as gpd
import numpy as np
import rasterio
from pyproj import Transformer
from rasterio.features import geometry_mask
from rasterio.warp import Resampling, reproject
from rasterio.windows import from_bounds

import config
import rasterout
from visibility import luminance_to_mag, mag_to_bortle, mag_to_nelm

_tx = Transformer.from_crs("EPSG:4326", config.CRS, always_xy=True)


def unpack():
    """Extract the Falchi GeoTIFF from the downloaded zip if it isn't already there."""
    if config.FALCHI_TIF.exists():
        return config.FALCHI_TIF
    if not config.FALCHI_ZIP.exists():
        raise SystemExit(
            f"missing {config.FALCHI_ZIP.name}; download it from "
            "https://datapub.gfz-potsdam.de/download/10.5880.GFZ.1.4.2016.001/"
        )
    with zipfile.ZipFile(config.FALCHI_ZIP) as z:
        names = [n for n in z.namelist() if n.lower().endswith(".tif")]
        if len(names) != 1:
            raise SystemExit(f"expected one tif in the zip, found {names}")
        with z.open(names[0]) as src, open(config.FALCHI_TIF, "wb") as dst:
            while chunk := src.read(1 << 24):
                dst.write(chunk)
    return config.FALCHI_TIF


def crop():
    """Windowed read of the global Falchi raster into a local bbox GeoTIFF."""
    unpack()
    with rasterio.open(config.FALCHI_TIF) as src:
        win = from_bounds(
            config.CROP_W, config.CROP_S, config.CROP_E, config.CROP_N, src.transform
        ).round_offsets().round_lengths()
        data = src.read(1, window=win)
        profile = src.profile | {
            "height": data.shape[0],
            "width": data.shape[1],
            "transform": src.window_transform(win),
            "compress": "deflate",
            "tiled": True,
        }
        profile.pop("blockxsize", None)
        profile.pop("blockysize", None)
    with rasterio.open(config.FALCHI_CROP, "w", **profile) as dst:
        dst.write(data, 1)
    return config.FALCHI_CROP


def check_units():
    """Assert the cropped Falchi values are mcd/m^2 and not micro-cd/m^2."""
    with rasterio.open(config.FALCHI_CROP) as src:
        peak = float(src.read(1).max())
    ratio = peak / config.NATURAL_MCD
    if not 20.0 <= ratio <= 5_000.0:
        raise SystemExit(
            f"falchi peak {peak:g} is {ratio:g}x natural; expected a metro core in "
            "20-5000x. a 1000x miss means the raster is micro-cd/m^2."
        )
    return peak


def to_frame(cell_m):
    """Reproject the cropped Falchi luminance into the frame grid."""
    ny, nx = rasterout.grid_shape(cell_m)
    dst = np.zeros((ny, nx), dtype="float32")
    with rasterio.open(config.FALCHI_CROP) as src:
        reproject(
            source=rasterio.band(src, 1),
            destination=dst,
            dst_transform=rasterout.frame_transform(cell_m),
            dst_crs=config.CRS,
            resampling=Resampling.bilinear,
        )
    return dst


def land_mask(cell_m):
    """True where a frame cell is land, from Natural Earth 10m."""
    if not config.LAND_SHP.exists():
        raise SystemExit(
            f"missing {config.LAND_SHP.parent.name}; unzip ne_10m_land.zip from "
            "https://naciscdn.org/naturalearth/10m/physical/ne_10m_land.zip into data_raw/"
        )
    box = (config.CROP_W, config.CROP_S, config.CROP_E, config.CROP_N)
    land = gpd.read_file(config.LAND_SHP, bbox=box).to_crs(config.CRS)
    return geometry_mask(
        land.geometry,
        out_shape=rasterout.grid_shape(cell_m),
        transform=rasterout.frame_transform(cell_m),
        invert=True,
    )


def cell_of(lon, lat, cell_m):
    """Lon/lat -> (row, col) in the frame grid, row 0 = north."""
    x, y = _tx.transform(lon, lat)
    return int((config.FRAME_N - y) // cell_m), int((x - config.FRAME_W) // cell_m)


def build():
    """Write sky.png, sky.bin and sky.json from the cropped Falchi raster."""
    cell = config.SKY_CELL_M
    S = luminance_to_mag(to_frame(cell))
    lo, hi = float(S.min()), float(S.max())

    q16, step16 = rasterout.quantize(S, lo, hi, 65536)
    q8, _ = rasterout.quantize(S, config.SKY_S_MIN, config.SKY_S_MAX, 256)
    rasterout.write_bin("sky", q16)
    rasterout.write_png("sky", q8)

    ny, nx = S.shape
    rasterout.write_json("sky", {
        "nx": nx, "ny": ny, "cell_m": cell, "crs": config.CRS,
        "frame": [config.FRAME_W, config.FRAME_S, config.FRAME_E, config.FRAME_N],
        "albers": {
            "parallels": [config.ALBERS_LAT1, config.ALBERS_LAT2],
            "origin": [config.ALBERS_LON0, config.ALBERS_LAT0],
            "x0": config.ALBERS_X0, "y0": config.ALBERS_Y0,
        },
        "scale": step16, "offset": lo,
        "natural_mcd": config.NATURAL_MCD, "l0_mcd": config.L0_MCD,
        "bortle": [[None if f < -1e3 else f, k, lab] for f, k, lab in config.BORTLE_BINS],
    })
    rasterout.update_meta("sky", {
        "file": "sky.png", "nx": nx, "ny": ny, "cell_m": cell,
        "vmin": config.SKY_S_MIN, "vmax": config.SKY_S_MAX,
        "unit": "mag/arcsec2",
    })
    return S


def check(S):
    """Assert the checkpoint Bortle classes and the ocean mask."""
    cell = config.SKY_CELL_M
    land = land_mask(cell)
    for name, (lon, lat, want_lo, want_hi) in config.CHECKPOINTS.items():
        r, c = cell_of(lon, lat, cell)
        k = mag_to_bortle(float(S[r, c]))[0]
        assert want_lo <= k <= want_hi, f"{name} is bortle {k}, expected {want_lo}-{want_hi}"
        assert land[r, c], f"{name} reads as ocean"
    r, c = cell_of(*config.OCEAN_CHECK, cell)
    assert not land[r, c], "the Strait of Georgia does not read as ocean"


def probe(S):
    """Print sky brightness, Bortle and limiting magnitude at each checkpoint."""
    cell = config.SKY_CELL_M
    print(f"{S.shape[1]}x{S.shape[0]} at {cell} m, S {S.min():.2f} to {S.max():.2f}")
    for name, (lon, lat, _, _) in config.CHECKPOINTS.items():
        r, c = cell_of(lon, lat, cell)
        v = float(S[r, c])
        k, label = mag_to_bortle(v)
        print(
            f"  {name:22s} S={v:5.2f}  bortle {k}  "
            f"nelm {float(mag_to_nelm(v)):4.2f}  {label}"
        )


if __name__ == "__main__":
    print(crop())
    print(f"peak {check_units():.2f} mcd/m2")
    S = build()
    check(S)
    probe(S)
    print("checks pass")
