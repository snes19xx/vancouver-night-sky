import sys

import basemap
import config
import glow
import roads
import sky
import spots
import visibility
from visibility import luminance_to_mag


def stage_sky():
    """Crop Falchi and write the sky layer."""
    sky.crop()
    sky.build()


STAGES = {
    "basemap": basemap.build,
    "sky": stage_sky,
    "glow": glow.build,
    "roads": roads.build,
    "spots": spots.build,
}


def verify():
    """Run every check and assert the asset budgets."""
    visibility.check()
    sky.check(luminance_to_mag(sky.to_frame(config.SKY_CELL_M)))
    spots.check()
    mb = (config.ASSETS / "roads.json").stat().st_size / 1e6
    assert mb <= config.ROAD_BUDGET_MB, f"roads.json is {mb:.2f} MB over budget"
    files = sorted(config.ASSETS.iterdir())
    total = sum(p.stat().st_size for p in files) / 1e6
    assert total <= config.ASSETS_BUDGET_MB, f"assets are {total:.2f} MB over budget"
    print(f"assets {total:.2f} MB in {len(files)} files")


def main(names):
    for name in names:
        print(f"[{name}]")
        STAGES[name]()
    try:
        verify()
    except AssertionError as e:
        print(f"FAIL {e}")
        return 1
    print("PASS")
    return 0


if __name__ == "__main__":
    args = sys.argv[1:] or list(STAGES)
    stages = [a for a in args if a != "verify"]
    unknown = [a for a in stages if a not in STAGES]
    if unknown:
        raise SystemExit(f"unknown stage {unknown[0]}, pick from {' '.join(STAGES)} verify")
    sys.exit(main(stages))
