import zipfile

import rasterio
from rasterio.windows import from_bounds

import config


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


def probe():
    """Print the raw cropped value and its ratio to natural at each checkpoint."""
    with rasterio.open(config.FALCHI_CROP) as src:
        print(f"{src.width}x{src.height} {src.dtypes[0]} {src.crs}")
        for name, (lon, lat) in config.CHECKPOINTS.items():
            v = float(next(src.sample([(lon, lat)]))[0])
            print(f"  {name:22s} L={v:9.3f} mcd/m2  {v / config.NATURAL_MCD:7.1f}x natural")


if __name__ == "__main__":
    print(crop())
    print(f"peak {check_units():.2f} mcd/m2")
    probe()
