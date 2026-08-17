import json

import config
import numpy as np


def load_objects():
    """Read assets/objects.json."""
    with open(config.ASSETS / "objects.json") as f:
        return json.load(f)


def luminance_to_mag(L):
    """Artificial luminance in mcd/m^2 -> total sky brightness in mag/arcsec^2."""
    return -2.5 * np.log10((config.NATURAL_MCD + np.asarray(L, float)) / config.L0_MCD)


def mag_to_bortle(S):
    """Sky brightness -> (Bortle class, label)."""
    for floor, k, label in config.BORTLE_BINS:
        if S >= floor:
            return k, label


def mag_to_nelm(S):
    """Sky brightness -> naked-eye limiting magnitude, the standard SQM relation."""
    return 7.93 - 5 * np.log10(10 ** (4.316 - np.asarray(S, float) / 5) + 1)


def visible_objects(S, objects):
    """Names still visible at S, split by which limit erases them."""
    nelm = mag_to_nelm(S)
    return {
        "stars": [o["name"] for o in objects["stars"] if o["mag"] < nelm],
        "extended": [o["name"] for o in objects["extended"] if S >= o["s_threshold"]],
    }


def check():
    """Assert the anchor and curve values every downstream number hangs off."""
    dark = float(luminance_to_mag(0.0))
    assert round(dark, 2) == 22.00, f"no artificial light gave S={dark}"
    assert mag_to_bortle(dark)[0] == 1, f"S={dark} is not Bortle 1"

    n21 = float(mag_to_nelm(21.0))
    assert abs(n21 - 6.11) < 0.01, f"S=21.0 gave NELM={n21}"

    last = 0
    for S in np.arange(22.0, 16.5, -0.05):
        k, label = mag_to_bortle(S)
        assert last <= k <= 9 and label, f"S={S:.2f} gave class {k} after {last}"
        last = k
    assert last == 9, f"bins bottom out at {last}, not 9"


if __name__ == "__main__":
    check()
    objects = load_objects()
    ns, ne = len(objects["stars"]), len(objects["extended"])
    print(f"{'S':>6} {'NELM':>5} {'B':>2}  {'stars':>7} {'deep':>5}  label")
    for S in [22.0, 21.9, 21.7, 21.0, 20.5, 20.2, 19.5, 18.9, 18.4, 17.8, 16.6]:
        k, label = mag_to_bortle(S)
        v = visible_objects(S, objects)
        print(
            f"{S:6.2f} {float(mag_to_nelm(S)):5.2f} {k:2d}"
            f"  {len(v['stars']):3d}/{ns:<3d} {len(v['extended']):2d}/{ne:<2d}  {label}"
        )
    print("checks pass")
