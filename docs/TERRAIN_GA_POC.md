# Geoscience Australia terrain delivery proof of concept

This is **not enabled for production**. It is one bounded XYZ tile for testing terrain delivery and must not be interpreted as national coverage.

## Data and rights

Source: Geoscience Australia, **SRTM-derived 1 Second Digital Elevation Models Version 1.0**, unsmoothed DEM, eCat 72759; radar data acquired February 2000. Digital Earth Australia identifies the product, citation, approximately 1 arc-second source resolution and [CC BY 4.0 licence](https://knowledge.dea.ga.gov.au/data/external-data/ga-srtm-1-second-dem/). The [GA dataset user guide](https://www.ga.gov.au/bigobj/GA18067.pdf) identifies EGM96 heights and says no conversion to AHD71 was applied. Do not silently combine these heights with AHD, EGM2008, or other vertical datums. The DEM is approximate, includes artefacts and is not survey grade.

Attribution: © Commonwealth of Australia (Geoscience Australia), SRTM-derived 1 Second DEM v1.0, CC BY 4.0. Source citation: Gallant, J., Wilson, N., Dowling, T., Read, A., Inskeep, C. 2011. *SRTM-derived 1 Second Digital Elevation Models Version 1.0*. Geoscience Australia, Canberra.

The bounded source is retrieved from [GA's WCS](https://services.ga.gov.au/gis/services/DEM_SRTM_1Second_2024/MapServer/WCSServer?service=WCS&request=GetCapabilities). The WCS is used for one-off conversion, not as the production tile server. Its numeric output, not a visual map, was used. Source and service rights are distinct from the capacity, cost and hosting conditions of any delivery platform.

## Reproduce

Requires `/usr/bin/python3`, GDAL Python bindings, NumPy and Pillow. Use an empty output directory:

```sh
/usr/bin/python3 scripts/terrain/ga_srtm_tile.py --z 11 --x 1867 --y 1246 --output /tmp/landos-ga-alps --tile-base-url https://landbanker.vercel.app/terrain-poc
/usr/bin/python3 tests/terrain-ga-poc.test.py
```

The script obtains a WCS GeoTIFF with a small resampling margin, reprojects the **horizontal** coordinates to EPSG:3857 and converts elevations to 512-pixel Terrarium RGB PNG using `(R × 256 + G + B / 256) − 32768`. It refuses missing or out-of-range samples and limits each request to one tile, zoom 10–14, and at most 16 MiB. It does not perform vertical datum conversion. The generated sample is `public/terrain-poc/11/1867/1246.png`; TileJSON points at the intended production origin but is not configured in the application. Bounds: west 148.18359375, south -36.45663601, east 148.359375, north -36.31512515. Its pixel size is roughly 31 m on the ground at this latitude; zooming further only enlarges the same data. The generated raster range is approximately 427–2,223 m EGM96.

A WCS pixel at 148.263° E, 36.4° S was 1,763.6 m; the reprojected PNG's nearest pixel was 1,766.5 m. Pixel-centre alignment and interpolation on steep terrain cause differences. Browser testing of the static asset is separate from the deterministic synthetic DEM tests.

## Delivery and coverage limitations

The app's existing Next.js `public` directory can serve this approximately 532 KiB PNG and its TileJSON without introducing a new service; actual Vercel deployment compatibility, cache behaviour and account limits still require verification. Roughly 1,000 uncached transfers of this one tile would transfer about 520 MiB, excluding protocol overhead. Tile counts, storage, transfer, caching and any plan costs must be measured before expanding coverage. No paid resource has been provisioned.

The proof covers only the specified Alpine tile. Vermont South, Balliang, Lismore and Dunoon are **outside this proof's coverage**. Although the source advertises much wider coverage, those locations have not been converted or validated. Tile boundaries and data gaps must be handled without suggesting that missing DEM is flat terrain. The current app does not yet reliably warn that 3D relief is missing outside this tile. Do not set `NEXT_PUBLIC_TERRAIN_TILEJSON_URL` to this proof in production until broader coverage, no-data behaviour, mobile controls, source metadata, alignment and critical browser tests are complete.
