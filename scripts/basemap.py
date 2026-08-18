import zipfile

import config
import geopandas as gpd
import pandas as pd
import rasterout
import roads
from shapely.ops import linemerge


def frame_box():
    """The frame as a projected bounding box."""
    return (config.FRAME_W, config.FRAME_S, config.FRAME_E, config.FRAME_N)


def unpack():
    """Extract the GSHHG and WDBII layers used here, if they are not already out."""
    want = [config.COAST_SHP, config.LAKES_SHP, config.ISLET_SHP, config.BORDER_SHP,
            *config.RIVER_SHPS]
    if all(p.exists() for p in want):
        return
    if not config.GSHHG_ZIP.exists():
        raise SystemExit(
            f"missing {config.GSHHG_ZIP.name}; download it from "
            "https://www.soest.hawaii.edu/pwessel/gshhg/"
        )
    stems = {p.with_suffix("").relative_to(config.GSHHG_DIR).as_posix() for p in want}
    with zipfile.ZipFile(config.GSHHG_ZIP) as z:
        members = [n for n in z.namelist() if n.rsplit(".", 1)[0] in stems]
        z.extractall(config.GSHHG_DIR, members=members)


def read(path, min_km2=None):
    """Read one layer inside the frame, reprojected and clipped to it."""
    box = (config.CROP_W, config.CROP_S, config.CROP_E, config.CROP_N)
    gdf = gpd.read_file(path, bbox=box, columns=[]).to_crs(config.CRS).clip(frame_box())
    gdf = gdf.explode(index_parts=False)
    gdf = gdf[~gdf.is_empty]
    if min_km2 is not None:
        gdf = gdf[gdf.area >= min_km2 * 1e6]
    return gdf.geometry


def land():
    """Land inside the frame: GSHHG coast, minus its lakes, plus the islands in them."""
    unpack()
    coast = read(config.COAST_SHP, config.COAST_MIN_KM2)
    lakes = read(config.LAKES_SHP, config.LAKE_MIN_KM2)
    islets = read(config.ISLET_SHP, config.COAST_MIN_KM2)
    solid = gpd.GeoSeries(pd.concat([coast, islets]), crs=config.CRS)
    if len(lakes):
        solid = solid.difference(lakes.union_all())
    return solid[~solid.is_empty].simplify(config.COAST_SIMPLIFY_M)


def rivers():
    """OSM rivers and canals inside the frame, merged into long runs."""
    roads.unpack(config.WATERWAYS_SHP)
    box = (config.CROP_W, config.CROP_S, config.CROP_E, config.CROP_N)
    gdf = gpd.read_file(config.WATERWAYS_SHP, columns=["fclass"], bbox=box)
    gdf = gdf[gdf.fclass.isin(config.RIVER_CLASSES)].to_crs(config.CRS)
    gdf = gdf.clip(frame_box()).explode(index_parts=False)
    merged = linemerge(list(gdf[gdf.geom_type == "LineString"].geometry))
    parts = list(merged.geoms) if merged.geom_type == "MultiLineString" else [merged]
    gs = gpd.GeoSeries(parts, crs=config.CRS)
    return gs[gs.length >= config.RIVER_MIN_M].simplify(config.RIVER_SIMPLIFY_M)


def rings(geom, decimals=5):
    """Yield rounded lon/lat rings for a polygon, exterior first."""
    parts = geom.geoms if geom.geom_type == "MultiPolygon" else [geom]
    for part in parts:
        for ring in [part.exterior, *part.interiors]:
            yield [[round(x, decimals), round(y, decimals)] for x, y in ring.coords]


def lines(geom, decimals=5):
    """Yield rounded lon/lat vertex lists for a line geometry."""
    parts = geom.geoms if geom.geom_type == "MultiLineString" else [geom]
    for part in parts:
        if len(part.coords) < 2:
            continue
        yield [[round(x, decimals), round(y, decimals)] for x, y in part.coords]


def build():
    """Write basemap.json: coast, lakes, rivers, the border and the place labels."""
    solid = land()
    lakes = read(config.LAKES_SHP, config.LAKE_MIN_KM2).simplify(config.COAST_SIMPLIFY_M)
    border = read(config.BORDER_SHP).simplify(config.COAST_SIMPLIFY_M)

    out = {
        "land": [r for g in solid.to_crs("EPSG:4326") for r in rings(g)],
        "lakes": [r for g in lakes.to_crs("EPSG:4326") for r in rings(g)],
        "rivers": [l for g in rivers().to_crs("EPSG:4326") for l in lines(g, 4)],
        "border": [l for g in border.to_crs("EPSG:4326") for l in lines(g)],
        "places": [[n, lon, lat] for n, lon, lat in config.PLACES],
    }
    rasterout.write_json("basemap", out)
    print("  " + "  ".join(
        f"{k} {len(v)}/{sum(len(p) for p in v)}" for k, v in out.items() if k != "places"
    ))
    return out


if __name__ == "__main__":
    build()
