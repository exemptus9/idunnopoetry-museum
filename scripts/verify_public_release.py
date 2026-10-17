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
        for asset in ('public-request.js', 'blend-engine.js', 'laboratory.js'):
            if (lexical / asset).is_file():
                checks.append(asset)
        # Additional stylesheet names may change while the public entry page
        # imports them. Verify every local CSS asset included in this release.
        checks.extend(path.name for path in lexical.glob('*.css') if path.name not in checks)
        checks.extend(path.name for path in lexical.glob('*.svg') if path.name not in checks)
        if (lexical / 'history.json').exists():
            checks.append('history.json')
        catalog = json.loads((lexical / 'public.json').read_text())
        if catalog['terms']:
            checks.append('word/' + catalog['terms'][0]['slug'] + '/index.html')
        for path in checks:
            expected = hashlib.sha256((lexical / path).read_bytes()).digest()
            actual = hashlib.sha256(get('observatory/' + path)).digest()
            assert actual == expected, f'Public lexical file is stale: {path}'
        print(f'Public v{version} verified: Museum metadata and preview; {len(checks)} exact lexical files; {len(catalog["terms"])} public terms.')
        break
    except Exception:
        if attempt == 7:
            raise
        time.sleep(5)
