from pathlib import Path

import rasterio  # noqa: F401

ROOT = Path(__file__).resolve().parents[1]

DATA_RAW = ROOT / "data_raw"
FALCHI_ZIP = DATA_RAW / "World_Atlas_2015.zip"
FALCHI_TIF = DATA_RAW / "World_Atlas_2015.tif"
FALCHI_CROP = DATA_RAW / "falchi_bbox.tif"
GEOFABRIK_ZIP = DATA_RAW / "british-columbia-260101-free.shp.zip"
ROADS_SHP = DATA_RAW / "bc_osm/gis_osm_roads_free_1.shp"
WATERWAYS_SHP = DATA_RAW / "bc_osm/gis_osm_waterways_free_1.shp"
GSHHG_ZIP = DATA_RAW / "gshhg-shp-2.3.7.zip"
GSHHG_DIR = DATA_RAW / "gshhg"
COAST_SHP = GSHHG_DIR / "GSHHS_shp/f/GSHHS_f_L1.shp"
LAKES_SHP = GSHHG_DIR / "GSHHS_shp/f/GSHHS_f_L2.shp"
ISLET_SHP = GSHHG_DIR / "GSHHS_shp/f/GSHHS_f_L3.shp"
BORDER_SHP = GSHHG_DIR / "WDBII_shp/f/WDBII_border_f_L1.shp"
RIVER_SHPS = [GSHHG_DIR / f"WDBII_shp/f/WDBII_river_f_L0{k}.shp" for k in range(1, 6)]
VIIRS_TIF = DATA_RAW / "viirs_frame.tif"

ASSETS = ROOT / "assets"

CRS = "EPSG:3005"
FRAME_W, FRAME_S, FRAME_E, FRAME_N = 1099000.0, 426000.0, 1368000.0, 617000.0
FRAME_ASPECT = (FRAME_E - FRAME_W) / (FRAME_N - FRAME_S)

# BC Albers parameters
ALBERS_LAT1, ALBERS_LAT2 = 50.0, 58.5
ALBERS_LAT0, ALBERS_LON0 = 45.0, -126.0
ALBERS_X0, ALBERS_Y0 = 1_000_000.0, 0.0

SKY_CELL_M = 1_000
GLOW_CELL_M = 500

# VIIRS DNB annual composite texture only
VIIRS_COLLECTION = "NOAA/VIIRS/DNB/ANNUAL_V21"
VIIRS_BAND = "average_masked"
VIIRS_YEAR = 2021

# nW/cm^2/sr floor, below this is sensor noise.
GLOW_FLOOR = 0.25
GLOW_GAMMA = 1.6

# Percentile of lit cells that saturates the texture.
GLOW_CLIP_PCT = 99.5

# Lon/lat window to crop Falchi to
CROP_W, CROP_S, CROP_E, CROP_N = -124.70, 48.68, -120.76, 50.61

# mcd/m^2, = 22.00 mag/arcsec^2.
NATURAL_MCD = 0.174
L0_MCD = NATURAL_MCD * 10 ** (22.0 / 2.5)

# S in mag/arcsec^2 = Bortle k for the first bin whose floor S clears.
BORTLE_BINS = [
    (21.99, 1, "Excellent dark-sky site"),
    (21.89, 2, "Typical truly dark site"),
    (21.69, 3, "Rural sky"),
    (20.49, 4, "Rural / suburban transition"),
    (19.50, 5, "Suburban sky"),
    (18.94, 6, "Bright suburban sky"),
    (18.38, 7, "Suburban / urban transition"),
    (17.80, 8, "City sky"),
    (float("-inf"), 9, "Inner-city sky"),
]

# Fixed S range the uint8 sky texture spans. Values outside are clamped.
SKY_S_MIN, SKY_S_MAX = 16.6, 22.0

# OSM fclass -> the three tiers prototype.html draws roads in.
ROAD_TIERS = {
    "motorway": "major", "trunk": "major",
    "primary": "second", "secondary": "second",
    "tertiary": "minor", "unclassified": "minor",
    "residential": "minor", "living_street": "minor",
}
ROAD_SIMPLIFY_M = 40
ROAD_DECIMALS = 4
ROAD_BUDGET_MB = 3.0
ASSETS_BUDGET_MB = 6.0

VANCOUVER = (-123.1207, 49.2827)

# Places labelled on the map.
PLACES = [
    ("Vancouver", -123.12, 49.28),
    ("Abbotsford", -122.33, 49.05),
    ("Chilliwack", -121.95, 49.16),
    ("Squamish", -123.16, 49.70),
    ("Whistler", -122.95, 50.11),
    ("Sechelt", -123.76, 49.47),
    ("Hope", -121.44, 49.38),
    ("Nanaimo", -123.94, 49.16),
    ("Bellingham", -122.49, 48.75),
]

# Drop coast islands and lakes smaller than this.
COAST_MIN_KM2 = 0.5
LAKE_MIN_KM2 = 1.0
COAST_SIMPLIFY_M = 60

# Named rivers and canals only, and only runs this long once merged.
RIVER_CLASSES = ("river", "canal")
RIVER_MIN_M = 2_000
RIVER_SIMPLIFY_M = 150

SPOT_COUNT = 30
SPOT_MIN_SEP_M = 5_000

# A spot is the darkest land cell this far from its named anchor.
SPOT_ANCHOR_RADIUS_M = 17_000

DEM_COLLECTION = "COPERNICUS/DEM/GLO30_2024_1"

# Named areas a spot is picked in, one spot each.
SPOT_REGIONS = [
    ("Sunshine Coast", -123.90, 49.62),
    ("Tetrahedron Plateau", -123.58, 49.68),
    ("Jervis Inlet", -124.02, 49.92),
    ("Powell River hinterland", -124.32, 49.98),
    ("Howe Sound west", -123.35, 49.55),
    ("Squamish backcountry", -123.22, 49.88),
    ("Callaghan Valley", -123.12, 50.14),
    ("Pemberton Valley", -122.78, 50.30),
    ("Upper Pitt River", -122.62, 49.60),
    ("Indian Arm head", -122.88, 49.50),
    ("Golden Ears", -122.48, 49.46),
    ("Stave Lake north", -122.34, 49.56),
    ("Chehalis Lake", -121.96, 49.62),
    ("Harrison East", -121.72, 49.60),
    ("Fraser Canyon", -121.48, 49.88),
    ("Anderson River", -121.36, 49.74),
    ("Coquihalla summit", -121.14, 49.58),
    ("Manning Park approach", -121.22, 49.16),
    ("Chilliwack River valley", -121.58, 49.04),
    ("Mount Baker foothills", -121.88, 48.94),
]

# Cypress is dark on the ground, bright in the sky.
CHECKPOINTS = {
    "downtown_vancouver": (-123.1207, 49.2827, 8, 9),
    "cypress_lookout": (-123.2058, 49.3706, 5, 6),
    "callaghan_valley": (-123.1200, 50.1400, 2, 3),
}

# Open water in the Strait of Georgia.
OCEAN_CHECK = (-123.5500, 49.3000)
