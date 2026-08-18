import json

import numpy as np
import rasterio
from rasterio.transform import from_origin

import config


def grid_shape(cell_m):
    ny = round((config.FRAME_N - config.FRAME_S) / cell_m)
    nx = round((config.FRAME_E - config.FRAME_W) / cell_m)
    return ny, nx


def frame_transform(cell_m):
    """Affine transform of the frame grid, row 0 = north."""
    return from_origin(config.FRAME_W, config.FRAME_N, cell_m, cell_m)


def quantize(arr, lo, hi, levels):
    """Scale arr onto 0..levels-1 over [lo, hi]."""
    step = (hi - lo) / (levels - 1)
    q = np.clip(np.round((arr - lo) / step), 0, levels - 1)
    return q.astype(np.uint16 if levels > 256 else np.uint8), step


def write_png(name, arr):
    ny, nx = arr.shape
    path = config.ASSETS / f"{name}.png"
    path.parent.mkdir(parents=True, exist_ok=True)
    with rasterio.open(
        path, "w", driver="PNG", width=nx, height=ny, count=1, dtype="uint8"
    ) as dst:
        dst.write(arr.astype(np.uint8), 1)
    for aux in config.ASSETS.glob(f"{name}.png.aux.xml"):
        aux.unlink()
    print(f"wrote {path.relative_to(config.ROOT)} ({path.stat().st_size / 1e3:.0f} KB)")


def write_bin(name, arr):
    path = config.ASSETS / f"{name}.bin"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(arr.tobytes())
    print(f"wrote {path.relative_to(config.ROOT)} ({path.stat().st_size / 1e3:.0f} KB)")


def write_json(name, obj):
    path = config.ASSETS / f"{name}.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, separators=(",", ":")))
    print(f"wrote {path.relative_to(config.ROOT)} ({path.stat().st_size / 1e3:.0f} KB)")


def update_meta(name, meta):
    path = config.ASSETS / "layers.json"
    data = json.loads(path.read_text()) if path.exists() else {}
    data[name] = meta
    path.write_text(json.dumps(data, separators=(",", ":")))
