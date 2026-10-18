#!/usr/bin/env python3
"""Verify Museum metadata and exact committed lexical publication bytes."""
import hashlib
import json
import os
from pathlib import Path
import struct
import time
from urllib.request import Request, urlopen
from check_release import settings

version, _ = settings()
base = os.environ['MUSEUM_PUBLIC_URL'].rstrip('/') + '/'
lexical = Path(__file__).resolve().parents[1] / 'museum-static/observatory'
unfinished = Path(__file__).resolve().parents[1] / 'museum-static/unfinished'
for attempt in range(8):
    try:
        query = '?verify=' + str(time.time_ns())
        def get(path):
            request = Request(base + path + query, headers={'Cache-Control': 'no-cache'})
            with urlopen(request, timeout=20) as response:
                return response.read()
        assert get('VERSION.txt').decode().strip() == version, 'Public VERSION.txt is stale'
        html = get('index.html').decode()
        assert f'name="idp-museum-version" content="{version}"' in html, 'Public HTML is stale'
        image = f'assets/idp-museum-og-v{version}.png'
        assert image in html, 'Public share image reference differs'
        png = get(image)
        assert png[:8] == b'\x89PNG\r\n\x1a\n' and struct.unpack('>II', png[16:24]) == (1200, 630), 'Public preview is invalid'
        checks = ['index.html', 'public.json', 'app.js', 'model.js', 'review.js', 'observatory.css', 'sitemap.xml']
        for asset in ('public-request.js', 'blend-engine.js', 'laboratory.js', 'share.js'):
            if (lexical / asset).is_file():
                checks.append(asset)
        # Additional stylesheet names may change while the public entry page
        # imports them. Verify every local CSS asset included in this release.
        checks.extend(path.name for path in lexical.glob('*.css') if path.name not in checks)
        checks.extend(path.name for path in lexical.glob('*.svg') if path.name not in checks)
        if (lexical / 'history.json').exists():
            checks.append('history.json')
        catalog = json.loads((lexical / 'public.json').read_text())
        checks.extend(['favicon.ico', 'apple-touch-icon.png', 'social/observatory.png'])
        if catalog['terms']:
            from lexical_social import social_name
            checks.append('word/' + catalog['terms'][0]['slug'] + '/index.html')
            checks.append('social/' + social_name(catalog['terms'][0]))
        for path in checks:
            expected = hashlib.sha256((lexical / path).read_bytes()).digest()
            actual = hashlib.sha256(get('observatory/' + path)).digest()
            assert actual == expected, f'Public lexical file is stale: {path}'
        # The Unfinished is deliberately isolated: only fictional demo
        # specimens ship here. Verify every required public-demo asset
        # against the exact committed bytes, not an HTML shell fallback.
        demo_files = ('index.html', 'app.js', 'samples.js', 'styles.css',
                      'icon.svg', 'manifest.webmanifest', 'service-worker.js')
        for path in demo_files:
            expected = hashlib.sha256((unfinished / path).read_bytes()).digest()
            actual = hashlib.sha256(get('unfinished/' + path)).digest()
            assert actual == expected, f'Public Unfinished demo file missing/stale: {path}'
        demo_html = (unfinished / 'index.html').read_text()
        demo_samples = (unfinished / 'samples.js').read_text()
        assert 'PUBLIC DEMO' in demo_html and 'FICTIONAL TEXT' in demo_html, 'Fictional sample notice missing'
        assert 'window.UNFINISHED_SAMPLES=' in demo_samples, 'Demo samples missing'
        assert 'Beyond Beautiful' not in demo_samples and 'THE WRECKAGE ARRANGED ME' not in demo_samples, 'Private title leakage in demo'
        print(f'Public v{version} verified: Museum metadata and preview; {len(checks)} exact lexical files; {len(catalog["terms"])} public terms; {len(demo_files)} exact fictional Unfinished demo assets.')
        break
    except Exception:
        if attempt == 7:
            raise
        time.sleep(5)
