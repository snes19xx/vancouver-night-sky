from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

DATA_RAW = ROOT / "data_raw"
FALCHI_ZIP = DATA_RAW / "World_Atlas_2015.zip"
FALCHI_TIF = DATA_RAW / "World_Atlas_2015.tif"
FALCHI_CROP = DATA_RAW / "falchi_bbox.tif"
GEOFABRIK_ZIP = DATA_RAW / "british-columbia-260101-free.shp.zip"
ROADS_SHP = DATA_RAW / "bc_osm/gis_osm_roads_free_1.shp"
LAND_SHP = DATA_RAW / "ne_10m_land/ne_10m_land.shp"
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

# VIIRS DNB annual composite, texture only, never a statistic.
VIIRS_COLLECTION = "NOAA/VIIRS/DNB/ANNUAL_V21"
VIIRS_BAND = "average_masked"
VIIRS_YEAR = 2021

# nW/cm^2/sr floor, below this is sensor noise not light.
GLOW_FLOOR = 0.25
GLOW_GAMMA = 1.6

# Percentile of lit cells that saturates the texture; the max is one flare-bright pixel.
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

VANCOUVER = (-123.1207, 49.2827)

SPOT_COUNT = 30
SPOT_MIN_SEP_M = 5_000

# Cypress is dark on the ground, bright in the sky. If it reads as
# a dark site, something has regressed to ground-radiance logic.
CHECKPOINTS = {
    "downtown_vancouver": (-123.1207, 49.2827, 8, 9),
    "cypress_lookout": (-123.2058, 49.3706, 5, 6),
    "callaghan_valley": (-123.1200, 50.1400, 2, 3),
}

# Open water in the Strait of Georgia, must read as ocean after masking.
OCEAN_CHECK = (-123.5500, 49.3000)
