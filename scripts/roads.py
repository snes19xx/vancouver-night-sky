import json
import zipfile

import geopandas as gpd
from shapely.ops import linemerge

import config


def unpack():
    """Extract the roads shapefile from the Geofabrik zip if it isn't already there."""
    if config.ROADS_SHP.exists():
        return config.ROADS_SHP
    if not config.GEOFABRIK_ZIP.exists():
        raise SystemExit(
            f"missing {config.GEOFABRIK_ZIP.name}; download it from "
            "https://download.geofabrik.de/north-america/canada/"
        )
    stem = config.ROADS_SHP.stem
    with zipfile.ZipFile(config.GEOFABRIK_ZIP) as z:
        names = [n for n in z.namelist() if n.rsplit("/", 1)[-1].startswith(stem + ".")]
        z.extractall(config.ROADS_SHP.parent, members=names)
    return config.ROADS_SHP


def load():
    """Read the OSM roads inside the frame, tiered and reprojected to frame metres."""
    unpack()
    box = (config.CROP_W, config.CROP_S, config.CROP_E, config.CROP_N)
    gdf = gpd.read_file(config.ROADS_SHP, columns=["fclass"], bbox=box)
    gdf["tier"] = gdf.fclass.str.removesuffix("_link").map(config.ROAD_TIERS)
    gdf = gdf.dropna(subset=["tier"]).to_crs(config.CRS)
    gdf = gdf.clip((config.FRAME_W, config.FRAME_S, config.FRAME_E, config.FRAME_N))
    gdf = gdf.explode(index_parts=False)
    return gdf[gdf.geom_type == "LineString"]


def chains(gdf):
    """Join each tier's segments into the longest runs OSM's intersection splits allow."""
    out = {}
    for tier, sub in gdf.groupby("tier"):
        m = linemerge(list(sub.geometry))
        out[tier] = list(m.geoms) if m.geom_type == "MultiLineString" else [m]
    return out


def lines(geom, decimals):
    """Yield rounded lon/lat vertex lists for a projected line geometry."""
    parts = geom.geoms if geom.geom_type == "MultiLineString" else [geom]
    for part in parts:
        if len(part.coords) < 2:
            continue
        yield [[round(x, decimals), round(y, decimals)] for x, y in part.coords]


def build():
    """Write roads.json and assert it fits the payload budget."""
    gdf = load()
    tiers = {}
    for tier, parts in chains(gdf).items():
        gs = gpd.GeoSeries(parts, crs=config.CRS).simplify(config.ROAD_SIMPLIFY_M)
        tiers[tier] = [l for g in gs.to_crs("EPSG:4326") for l in lines(g, config.ROAD_DECIMALS)]

    path = config.ASSETS / "roads.json"
    path.write_text(json.dumps(tiers, separators=(",", ":")))
    mb = path.stat().st_size / 1e6
    counts = " ".join(f"{k} {len(v)}" for k, v in tiers.items())
    print(f"wrote {path.name} ({mb:.2f} MB) {counts}")
    assert mb <= config.ROAD_BUDGET_MB, (
        f"roads.json is {mb:.2f} MB over the {config.ROAD_BUDGET_MB} MB budget; "
        "split into major and minor files"
    )
    return tiers


if __name__ == "__main__":
    build()
