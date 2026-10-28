#!/usr/bin/python3
"""Build one bounded Terrarium tile from GA's CC BY 4.0 SRTM WCS.

Requires GDAL Python bindings, NumPy and Pillow. Output is experimental; see
TERRAIN_GA_POC.md. The program refuses partial or nodata tiles.
"""
import argparse
import json
import math
import os
import pathlib
import tempfile
import urllib.parse
import urllib.request

import numpy as np
from osgeo import gdal
from PIL import Image

gdal.UseExceptions()
parser = argparse.ArgumentParser()
parser.add_argument('--z', type=int, required=True)
parser.add_argument('--x', type=int, required=True)
parser.add_argument('--y', type=int, required=True)
parser.add_argument('--output', type=pathlib.Path, required=True)
parser.add_argument('--tile-base-url', required=True, help='HTTPS URL ending at the tile directory')
a = parser.parse_args()
if not 10 <= a.z <= 14 or not (0 <= a.x < 2**a.z and 0 <= a.y < 2**a.z):
    parser.error('one tile only; supported zooms 10–14')
url = urllib.parse.urlparse(a.tile_base_url)
if url.scheme != 'https' or not url.netloc or url.username or url.password or url.query or url.fragment:
    parser.error('tile base must be a credential-free HTTPS URL')
out = a.output
if out.exists() and any(out.iterdir()):
    parser.error('output directory must be empty')
n = 2 ** a.z
lon = lambda x: x / n * 360 - 180
lat = lambda y: math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * y / n))))
west, east = lon(a.x), lon(a.x + 1)
north, south = lat(a.y), lat(a.y + 1)
if west < 112 or east > 154 or south < -44 or north > -10:
    parser.error('tile is outside the source advertised Australian coverage')
# Include a margin for the reprojection resampling kernel; keep request small.
margin = .002
width = math.ceil((east-west+2*margin)*3600)
height = math.ceil((north-south+2*margin)*3600)
if max(width,height) > 2048:
    parser.error('WCS request exceeds bounded proof-of-concept limit')
params = {'service':'WCS','version':'1.0.0','request':'GetCoverage','coverage':'1',
          'crs':'EPSG:4326','bbox':f'{west-margin},{south-margin},{east+margin},{north+margin}',
          'width':width,'height':height,'format':'GeoTIFF'}
source = 'https://services.ga.gov.au/gis/services/DEM_SRTM_1Second_2024/MapServer/WCSServer?'+urllib.parse.urlencode(params)
with tempfile.TemporaryDirectory(prefix='landos-dem-') as temp:
    tif = os.path.join(temp, 'source.tif')
    with urllib.request.urlopen(source, timeout=30) as response:
        data = response.read(16*1024*1024+1)
    if len(data) > 16*1024*1024:
        raise RuntimeError('WCS response exceeds 16 MiB')
    pathlib.Path(tif).write_bytes(data)
    ds = gdal.Open(tif)
    if ds.RasterCount != 1 or ds.GetRasterBand(1).DataType not in (gdal.GDT_Float32, gdal.GDT_Float64):
        raise RuntimeError('WCS did not return numeric single-band elevation')
    # Exact XYZ tile in EPSG:3857. Do not transform the vertical datum.
    world = 20037508.342789244
    span = 2*world/n
    x0, x1 = -world+a.x*span, -world+(a.x+1)*span
    y1, y0 = world-a.y*span, world-(a.y+1)*span
    warped = gdal.Warp('', ds, format='MEM', dstSRS='EPSG:3857', outputBounds=(x0,y0,x1,y1), width=512, height=512, resampleAlg='bilinear', dstNodata=-999999)
    values = warped.ReadAsArray().astype(np.float64)
    if not np.isfinite(values).all() or (values < -32768).any() or (values >= 32768).any():
        raise RuntimeError('missing or out-of-range elevation: refusing to create partial tile')
    encoded = np.rint((values+32768)*256).astype(np.uint32)
    rgb = np.stack(((encoded >> 16)&255,(encoded >> 8)&255,encoded&255),axis=-1).astype(np.uint8)
    tile = out / str(a.z) / str(a.x) / f'{a.y}.png'
    tile.parent.mkdir(parents=True, exist_ok=True)
    Image.fromarray(rgb, mode='RGB').save(tile, optimize=True)
    attribution = '© Commonwealth of Australia (Geoscience Australia), SRTM-derived 1 Second DEM v1.0, CC BY 4.0'
    metadata = {'tilejson':'3.0.0','scheme':'xyz','tiles':[a.tile_base_url.rstrip('/')+'/{z}/{x}/{y}.png'],
                'minzoom':a.z,'maxzoom':a.z,'bounds':[west,south,east,north], 'attribution':attribution}
    (out/'tilejson.json').write_text(json.dumps(metadata, indent=2)+'\n')
    print(f'Wrote {tile}: {values.min():.2f}–{values.max():.2f} m EGM96, 512x512; coverage {west},{south},{east},{north}')
