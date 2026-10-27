# Basemap and satellite source review

Reviewed 27 October 2026. The five existing OpenFreeMap vector styles remain available. OpenFreeMap's [service documentation](https://github.com/hyperknot/openfreemap) describes free public hosting without API keys and requires the underlying OpenStreetMap/OpenMapTiles attribution; individual style design credits remain visible where applicable. Availability is dependent on the external service.

## Digital Earth Australia satellite composite

The Satellite option uses Geoscience Australia's Digital Earth Australia OWS `ga_ls8cls9c_gm_cyear_3` layer, `simple_rgb` style, and the explicitly selected `2025-01-01` annual composite. The official [WMS capabilities](https://ows.dea.ga.gov.au/?service=WMS&request=GetCapabilities&version=1.3.0) list this layer as DEA GeoMAD (Landsat 8 and 9), an annual geometric median, with Australian bounds approximately 111.53°E–155.08°E and 44.34°S–8.51°S. The service advertises no fees and no access constraints. The [official OWS configuration](https://github.com/GeoscienceAustralia/dea-config/blob/master/prod/services/wms/ows_refactored/ows_root_cfg.py) credits © Commonwealth of Australia (Geoscience Australia) and states CC BY 4.0; the map retains that attribution. See the [product description](https://knowledge.dea.ga.gov.au/data/product/dea-geometric-median-and-median-absolute-deviation-landsat/) for details.

On 27 October 2026, actual 256-pixel WMS GetMap requests in EPSG:3857 returned PNG imagery and permissive CORS headers for both Vermont South, Victoria, and Lismore, NSW. The service and its current imagery remain external dependencies; no availability or performance guarantee is implied. These are approximately 30 m resolution annual satellite composites, not current high-resolution aerial photography: individual parcels and structures generally cannot be resolved. Outside the published Australian bounds imagery is unavailable. Hybrid overlays OpenFreeMap/OpenStreetMap place and road labels on the same satellite composite and displays both providers’ attribution.

The previously investigated NSW imagery and OpenAerialMap candidates remain disabled because their particular usage terms or scene licences and dependable coverage were not verified. No paid service or key is used.

## V2 high-resolution source check

On 27 October 2026 the NSW Spatial Services `public/NSW_Imagery/MapServer?f=pjson` metadata was reachable. It describes higher-resolution imagery at larger scales, but credits external imagery from AAM and Jacobs Group Ausimage as well as Landsat and does not establish the commercial reuse or hotlinking rights for every included scene. It is therefore not enabled. The V2 UI calls the existing DEA options Regional Satellite and Regional Hybrid and identifies the 2025 annual composite and approximately 30 m resolution. The verified DEA product and attribution are unchanged.
