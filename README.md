# vancouver-night-sky

Interactive map of artificial sky brightness across Metro Vancouver, the
Sea-to-Sky corridor, and the Sunshine Coast. Click any square kilometre for
its Bortle class, naked-eye limiting magnitude, visible object count, and a
simulated sky patch comparing the site to a pristine sky.

A ranked list of the 20 darkest accessible sites is in the panel. Clicking
one flies the map there.

## How it works

The pipeline reprojects the Falchi raster to a 269x191 grid at 1 km in
BC Albers (EPSG:3005), encodes it as uint16 sky brightness in mag/arcsec^2,
and ships it as `sky.bin` (103 KB). The browser reads the binary, looks up
the local sky value at a click, and derives every statistic from the
constants in `sky.json`. Nothing is recomputed server-side.

A VIIRS ground-light texture, the OSM road network as a streetlight proxy,
GSHHG coastline, and Copernicus DEM elevations for the dark sites complete
the asset set. Total: ~3 MB.

The front end is vanilla JS + d3 on a single canvas, no framework, no build
step.

## Data sources

| Layer | Source | Vintage |
|-------|--------|---------|
| Sky brightness | [New World Atlas of Artificial Night Sky Brightness](https://doi.org/10.5880/GFZ.1.4.2016.001) (Falchi et al.) | 2016 (satellite data 2014) |
| Ground light | NOAA VIIRS/DNB annual composite via Earth Engine | 2021 |
| Roads | [Geofabrik OpenStreetMap extract](https://download.geofabrik.de/north-america/canada/british-columbia.html) for British Columbia | 2026-01-01 |
| Coastline & border | [GSHHG 2.3.7](https://www.soest.hawaii.edu/pwessel/gshhg/) (GSHHS + WDBII) | 2017 |
| Elevation | Copernicus GLO-30 DEM via Earth Engine | 2024 |

## Rebuild

Requires `mamba activate geo_env` (rasterio, geopandas, shapely, earthengine-api)
and `EE_PROJECT` set for the two Earth Engine stages.

Place in `data_raw/`:
- `World_Atlas_2015.zip` (Falchi, 2.9 GB)
- `british-columbia-260101-free.shp.zip` (Geofabrik, 1.96 GB)
- `gshhg-shp-2.3.7.zip` (GSHHG, 134 MB)

Then:

```
python scripts/run.py          # build all assets + verify
python scripts/run.py verify   # verify only
```
