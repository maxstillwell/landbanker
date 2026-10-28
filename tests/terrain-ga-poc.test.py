#!/usr/bin/python3
"""Offline checks on the committed one-tile GA proof of concept."""
import json
import math
from pathlib import Path
import unittest
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
DATA = ROOT / 'public/terrain-poc'

class TerrainProofTest(unittest.TestCase):
    def test_other_bounded_tiles_cover_sample_locations(self):
        samples = [
            ('vermont',145.182,-37.858,1849,1257),
            ('balliang',144.307,-37.804,1844,1256),
            ('lismore',153.279,-28.813,1895,1195),
            ('dunoon',153.329,-28.685,1896,1194),
        ]
        for name,lon,lat,x,y in samples:
            with self.subTest(name=name):
                root=ROOT/'public'/('terrain-poc-'+name)
                metadata=json.loads((root/'tilejson.json').read_text())
                west,south,east,north=metadata['bounds']
                self.assertTrue(west <= lon <= east and south <= lat <= north)
                self.assertEqual(metadata['minzoom'],11)
                with Image.open(root/'11'/str(x)/f'{y}.png') as image:
                    self.assertEqual(image.size,(512,512))

    def test_metadata_and_reference_pixel(self):
        metadata = json.loads((DATA / 'tilejson.json').read_text())
        self.assertEqual((metadata['minzoom'],metadata['maxzoom']), (11,11))
        self.assertEqual(metadata['bounds'],[148.18359375,-36.45663601159621,148.359375,-36.3151251474805])
        image = Image.open(DATA/'11/1867/1246.png').convert('RGB')
        self.assertEqual(image.size,(512,512))
        lon,lat = 148.263,-36.4
        n=2**11
        xf=(lon+180)/360*n
        yf=(1-math.asinh(math.tan(math.radians(lat)))/math.pi)/2*n
        red,green,blue=image.getpixel((int((xf-1867)*512),int((yf-1246)*512)))
        elevation=red*256+green+blue/256-32768
        # Independent WCS source pixel: 1763.63 m; resampling and pixel-centre
        # alignment can shift the sample slightly on steep terrain.
        self.assertLess(abs(elevation-1763.6326), 10)
        self.assertIn('Geoscience Australia', metadata['attribution'])

if __name__ == '__main__':
    unittest.main()
