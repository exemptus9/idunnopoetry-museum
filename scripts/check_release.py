#!/usr/bin/env python3
"""Verify published release surfaces; optionally rasterize the exact SVG share card."""
import argparse
import json
import re
import struct
from html.parser import HTMLParser
from pathlib import Path
from datetime import date
import xml.etree.ElementTree as ET

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'museum-static'


class Page(HTMLParser):
    def __init__(self):
        super().__init__()
        self.metas, self.badges = {}, []
        self.in_badge = False
        self.in_anchor = False
        self.nested_anchor = False

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if tag == 'meta':
            self.metas[attrs.get('name') or attrs.get('property')] = attrs.get('content')
        if tag == 'a':
            self.nested_anchor |= self.in_anchor
            self.in_anchor = True
        if 'data-idp-version' in attrs:
            self.in_badge = True

    def handle_endtag(self, tag):
        if tag == 'a':
            self.in_anchor = self.in_badge = False

    def handle_data(self, data):
        if self.in_badge:
            self.badges.append(data.strip())


def settings():
    config = (SITE / 'museum-config.js').read_text()
    version = re.search(r"\bversion:\s*['\"]([0-9]+(?:\.[0-9]+)+)['\"]", config).group(1)
    released = re.search(r"\breleaseDate:\s*['\"]([0-9-]+)['\"]", config).group(1)
    return version, released


def validate_source():
    version, released = settings()
    label = 'v' + version
    page = Page()
    page.feed((SITE / 'index.html').read_text())
    assert not page.nested_anchor, 'Header contains nested links'
    assert page.badges == [label, label], 'Header/footer versions differ'
    assert page.metas['idp-museum-version'] == version, 'HTML version differs'
    assert (SITE / 'VERSION.txt').read_text().strip() == version, 'VERSION.txt differs'
    history = (SITE / 'data/version-history.js').read_text()
    assert re.search(r'current:\s*"' + re.escape(version) + '"', history), 'History version differs'
    assert re.search(r'version:\s*"' + re.escape(version) + r'"[^}]*status:\s*"current"', history), 'Current release history missing'
    manifest = json.loads((SITE / 'BUILD_MANIFEST.json').read_text())
    assert manifest['build_version'] == label, 'Manifest build version differs'
    assert manifest['archive_version'] == version, 'Manifest archive version differs'
    assert manifest['build_date'] == released, 'Manifest date differs'
    stamp = date.fromisoformat(released).strftime('%B %d, %Y').replace(' 0', ' ')
    assert f'Current public museum release: {label} · {stamp}' in (ROOT / 'README.md').read_text(), 'Root README is stale'
    assert f'Current museum line: **{label}**, {stamp}.' in (SITE / 'README.md').read_text(), 'Museum README is stale'
    expected = f'https://exemptus9.github.io/idunnopoetry-museum/assets/idp-museum-og-{label}.png'
    for key in ('og:image', 'og:image:secure_url', 'twitter:image'):
        assert page.metas[key] == expected, key + ' is stale'
    for key in ('og:image:alt', 'twitter:image:alt'):
        assert label in page.metas[key], key + ' is stale'
    svg = SITE / f'assets/idp-museum-og-{label}.svg'
    root = ET.fromstring(svg.read_text())
    text = ''.join(root.itertext())
    assert label in text, 'SVG version differs'
    for key in ('posts', 'topics', 'works'):
        assert f'{manifest["counts"][key]:,}' in text, 'SVG archive count differs'
    assert root.attrib['width'] == '1200' and root.attrib['height'] == '630'
    assert manifest['social_preview']['source'] == svg.relative_to(SITE).as_posix()
    assert manifest['social_preview']['path'] == svg.with_suffix('.png').relative_to(SITE).as_posix()
    return svg


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--render-preview', action='store_true')
    parser.add_argument('--source-only', action='store_true')
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    svg = validate_source()
    png = svg.with_suffix('.png')
    if args.render_preview:
        import cairosvg
        cairosvg.svg2png(url=str(svg), write_to=str(png))
    if not args.source_only:
        raw = png.read_bytes()
        assert raw[:8] == b'\x89PNG\r\n\x1a\n', 'Preview is not PNG'
        assert struct.unpack('>II', raw[16:24]) == (1200, 630), 'Preview dimensions differ'
    print(f'Release v{settings()[0]}: version labels, history, metadata and preview verified.')


if __name__ == '__main__':
    main()
