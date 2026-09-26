#!/usr/bin/env python3
"""Verify that Pages serves the committed release and its 1200x630 share image."""
import os
import struct
import time
from urllib.request import Request, urlopen
from check_release import settings

version, _ = settings()
base = os.environ['MUSEUM_PUBLIC_URL'].rstrip('/') + '/'
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
        print(f'Public v{version} verified: VERSION.txt, HTML metadata and 1200x630 PNG.')
        break
    except Exception:
        if attempt == 7:
            raise
        time.sleep(5)
