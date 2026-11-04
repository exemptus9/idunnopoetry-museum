#!/usr/bin/env python3
"""Build both public directories from preserved cards and reviewed metadata.
Public website extensions require explicit HTTPS allowlisting. No private sources
are read, and publication of a website does not establish institutional status.
Run after approved artwork rendering and before publication tests.
"""
from pathlib import Path
from html import escape, unescape
from collections import Counter
from datetime import date
from urllib.parse import urlsplit
import json
import re

ROOT = Path(__file__).resolve().parents[1]
SITE = ROOT / 'museum-static'
CARD = re.compile(r'<article class="card project"[^>]*>[\s\S]*?</article>')
ATLAS_CARD = re.compile(r'<article class="atlas-orbit"[^>]*>[\s\S]*?</article>')
PROTECTED = ('brandon-mirror-private.idunnopoetry.chatgpt.site', 'threads-observatory-wordsmith.idunnopoetry.chatgpt.site', 'synchronicity-atlas-brandon.idunnopoetry.chatgpt.site', 'public-deception-atlas-b85.idunnopoetry.chatgpt.site')


def attr(card, key):
    result = re.search(r'\b' + re.escape(key) + r'="([^"]*)"', card)
    return unescape(result.group(1)) if result else ''


def replace_attr(card, key, value):
    rx = re.compile(r'\b' + re.escape(key) + r'="[^"]*"')
    if rx.search(card):
        return rx.sub(lambda _: key + '="' + escape(str(value), quote=True) + '"', card, count=1)
    return card.replace('<article ', '<article ' + key + '="' + escape(str(value), quote=True) + '" ', 1)


def name(card):
    return unescape(re.search(r'<h3>(.*?)</h3>', card).group(1))


def inspect(card):
    description = re.search(r'<h3>[\s\S]*?</h3><p>([\s\S]*?)</p>', card)
    links = []
    for href, label in re.findall(r'<a[^>]+href="([^"]+)"[^>]*>(.*?)</a>', card):
        links.append({'href': unescape(href), 'label': unescape(re.sub('<[^>]*>', '', label))})
    return {'id': attr(card, 'id'), 'name': name(card), 'stage': attr(card, 'data-stage'), 'phase': attr(card, 'data-phase') or 'project', 'domain': attr(card, 'data-domain'), 'activityDate': attr(card, 'data-updated') or None, 'description': unescape(description.group(1)) if description else '', 'links': links}


def concept_card(item):
    for key in ('id', 'name', 'domain', 'category', 'icon', 'description'):
        if not isinstance(item.get(key), str) or not item[key]:
            raise ValueError('Missing concept field: ' + key)
    if not re.fullmatch(r'project-[a-z0-9-]+', item['id']):
        raise ValueError('Unsafe project ID')
    if not re.fullmatch(r'[a-z0-9-]+', item['icon']):
        raise ValueError('Unsafe icon')
    if item['domain'] not in {'poetry', 'language', 'archive', 'technology', 'research', 'community'}:
        raise ValueError('Invalid project domain')
    if not (SITE / 'assets/brand' / item['icon'] / 'icon.svg').is_file():
        raise ValueError('Missing concept icon')
    search = escape(' '.join([item['name'], item['category'], item['description'], 'concept']).lower(), quote=True)
    return (f'<article class="card project" data-stage="building" data-phase="concept" data-domain="{escape(item["domain"])}" data-updated="" id="{escape(item["id"])}" data-search="{search}">'
            f'<div class="project-top"><span class="type">{escape(item["category"])}</span><span class="state state-concept">Concept</span></div>'
            f'<img class="project-emblem" src="../assets/brand/{escape(item["icon"])}/icon.svg" alt="" loading="lazy" decoding="async">'
            f'<h3>{escape(item["name"])}</h3><p>{escape(item["description"])}</p>'
            '<div class="project-bottom"><div class="project-datestamp"><span class="date-label">Concept retained; no current release</span><span>Implementation date not established</span></div><div class="project-links"><span class="unpublished">Concept · no public application</span></div></div></article>')


def public_site_card(item, allowlist):
    """Represent only an independently checked public website, not its wider claims."""
    url = item.get('url', '')
    if not isinstance(url, str) or any(ord(c) < 33 for c in url):
        raise ValueError('Unsafe public URL')
    parts = urlsplit(url)
    if (url not in allowlist or parts.scheme != 'https' or not parts.hostname
            or parts.username or parts.password or parts.fragment
            or any(host in url for host in PROTECTED)):
        raise ValueError('Unreviewed public URL')
    for key in ('date', 'dateLabel', 'when', 'linkLabel'):
        if not isinstance(item.get(key), str) or not item[key]:
            raise ValueError('Missing public website evidence: ' + key)
    date.fromisoformat(item['date'])
    card = concept_card(item)
    card = replace_attr(card, 'data-stage', 'live')
    card = replace_attr(card, 'data-phase', 'website')
    card = replace_attr(card, 'data-updated', item['date'])
    card = replace_attr(card, 'data-search', ' '.join([item['name'], item['category'], item['description'], 'public website']).lower())
    card = card.replace('<span class="state state-concept">Concept</span>', '<span class="state state-live">Public website</span>')
    stamp = '<div class="project-datestamp"><span class="date-label">' + escape(item['dateLabel']) + '</span><time datetime="' + escape(item['date']) + '">' + escape(item['when']) + '</time></div>'
    card = re.sub(r'<div class="project-datestamp">[\s\S]*?</div>', lambda _: stamp, card, count=1)
    link = '<a class="go" href="' + escape(url, quote=True) + '" rel="noopener noreferrer">' + escape(item['linkLabel']) + '</a>'
    return card.replace('<span class="unpublished">Concept · no public application</span>', link)


def update_card(card, change):
    previous = inspect(card)
    card = re.sub(r'(<h3>[\s\S]*?</h3>)<p>[\s\S]*?</p>', lambda m: m.group(1) + '<p>' + escape(change['description']) + '</p>', card, count=1)
    stamp = '<div class="project-datestamp"><span class="date-label">' + escape(change['dateLabel']) + '</span><time datetime="' + escape(change['date']) + '">' + escape(change['when']) + '</time></div>'
    card = re.sub(r'<div class="project-datestamp">[\s\S]*?</div>', lambda _: stamp, card, count=1)
    card = replace_attr(card, 'data-updated', change['date'])
    card = replace_attr(card, 'data-search', ' '.join([previous['name'], previous['domain'], previous['stage'], change['description']]).lower())
    after = inspect(card)
    for key in ('id', 'name', 'stage', 'domain', 'links'):
        if previous[key] != after[key]:
            raise ValueError('Unintended identity/audience/link change: ' + previous['id'] + '/' + key)
    return card


def now_panel(data, atlas):
    tiles = []
    for item in data['now']:
        href = item['href']
        if href == '?ps=concept':
            href += '#worlds' if atlas else '#group-building'
        if not (href.startswith(('https://', '#', '?', '../'))):
            raise ValueError('Unsafe Now navigation')
        tiles.append('<article><h3>' + escape(item['title']) + '</h3><p>' + escape(item['text']) + '</p><a href="' + escape(href, quote=True) + '">' + escape(item['linkLabel']) + ' <span aria-hidden="true">↗</span></a></article>')
    stamp = date.fromisoformat(data['reviewedOn']).strftime('%B %d, %Y').replace(' 0', ' ')
    return ('<!-- PUBLIC NOW START --><section id="now" class="public-now' + (' section-wrap' if atlas else '') + '" aria-labelledby="now-title">'
            '<div class="now-heading"><div><p class="now-eyebrow">A quick look / ' + stamp + '</p><h2 id="now-title">What is taking shape.</h2></div>'
            '<a class="now-all" href="' + ('#worlds' if atlas else '#group-live') + '">Explore all ' + str(data['expectedCount']) + ' projects ↓</a></div>'
            '<p class="now-intro">Published work, active development and early concepts—clearly separated. Reviewed <time datetime="' + data['reviewedOn'] + '">' + stamp + '</time>. This is a dated editorial snapshot, not a promise that every project changed today.</p>'
            '<div class="now-grid">' + ''.join(tiles) + '</div></section><!-- PUBLIC NOW END -->')


def finish_page(page, data, counts, atlas=False):
    page = re.sub(r'<!-- PUBLIC NOW START -->[\s\S]*?<!-- PUBLIC NOW END -->', '', page)
    marker = '<section id="worlds"' if atlas else '<section class="navigator"'
    if marker not in page:
        raise ValueError('Missing now-panel insertion anchor')
    page = page.replace(marker, now_panel(data, atlas) + '\n' + marker, 1)
    if 'projects/now.css' not in page:
        page = page.replace('</head>', '<link rel="stylesheet" href="../projects/now.css">\n</head>', 1)
    if 'href="#now"' not in page:
        page = page.replace('<nav aria-label="Main navigation">', '<nav aria-label="Main navigation"><a href="#now">Now</a>', 1) if not atlas else page.replace('<nav class="topnav" aria-label="Atlas sections">', '<nav class="topnav" aria-label="Atlas sections"><a href="#now">Now</a>', 1)
    concept_option = '<option value="concept">Concepts (' + str(len(data['concepts'])) + ')</option>'
    if '<option value="concept">' in page:
        page = re.sub(r'<option value="concept">[^<]*</option>', lambda _: concept_option, page)
    else:
        option = '<option value="all">All project stages</option>' if atlas else '<option value="all">All stages</option>'
        page = page.replace(option, option + concept_option)
    for stage, count in counts.items():
        option_rx = r'(<option value="' + re.escape(stage) + r'">[^<]*?)(?:\s*\(\d+\))?(</option>)'
        page = re.sub(option_rx, lambda m, n=count: re.sub(r'\s*\(\d+\)$', '', m.group(1)) + ' (' + str(n) + ')' + m.group(2), page)
        heading_rx = r'(<h2 id="group-' + re.escape(stage) + r'">[\s\S]*?<span class="count">)\d+(</span>)'
        page = re.sub(heading_rx, lambda m, n=count: m.group(1) + str(n) + m.group(2), page)
    page = re.sub(r'\b40(?= (?:projects|project|curated|source-labeled|creative|connected))', str(data['expectedCount']), page)
    if data['expectedCount'] == 45:
        page = page.replace('Forty connected projects:', 'Forty-five connected projects:')
    stamp = date.fromisoformat(data['reviewedOn']).strftime('%B %d, %Y').replace(' 0', ' ')
    page = re.sub(r'Directory reconciled <time datetime="[^"]+">[^<]+</time>', 'Directory reconciled <time datetime="' + data['reviewedOn'] + '">' + stamp + '</time>', page)
    page = re.sub(r'Status was reviewed on [A-Z][a-z]+ \d{1,2}, \d{4}\.', 'Status was reviewed on ' + stamp + '.', page)
    if any(v in page for v in PROTECTED):
        raise ValueError('Private endpoint exposed')
    return page


def patch_navigation():
    path = SITE / 'atlas/worlds.js'
    code = path.read_text(encoding='utf-8')
    code = code.replace('stage:["all","live","preview","building","archive"]', 'stage:["all","live","preview","building","archive","concept"]')
    code = code.replace('(s==="all"||c.dataset.stage===s)', '(s==="all"||(s==="concept"?c.dataset.phase==="concept":c.dataset.stage===s))')
    marker = ' apply();\n search.addEventListener("input",change);'
    if 'function revealHash()' not in code:
        if marker not in code:
            raise ValueError('Project navigation changed; review integration')
        code = code.replace(marker, ''' apply();
 function revealHash(){
   const target=location.hash.startsWith("#project-")?document.getElementById(location.hash.slice(1)):null;
   if(!target||!cards.includes(target))return;
   search.value="";stage.value="all";domain.value="all";limit=cards.length;apply();
   target.scrollIntoView({block:"center",behavior:"auto"});
 }
 window.addEventListener("hashchange",revealHash);
 document.addEventListener("click",event=>{
   const link=event.target.closest?.('a[href^="#project-"]');
   if(link){setTimeout(revealHash,0)}
 });
 search.addEventListener("input",change);''')
    if 'c.dataset.phase==="concept"' not in code:
        raise ValueError('Missing concept filter')
    path.write_text(code, encoding='utf-8')
    launch = SITE / 'atlas/launchpad.js'
    original = launch.read_text(encoding='utf-8')
    launch.write_text(original.replace("new URL(a.getAttribute('href'),location.href)", "new URL(a.getAttribute('href'),document.baseURI)"), encoding='utf-8')


def insert_group(page, stage, extra):
    if not extra:
        return page
    start = page.index('<section class="group" aria-labelledby="group-' + stage + '"')
    end = page.index('</section>', start)
    chunk = page[start:end]
    position = chunk.rfind('</div>')
    if position < 0:
        raise ValueError('Missing project grid')
    return page[:start] + chunk[:position] + '\n'.join(extra) + chunk[position:] + page[end:]


def run():
    data = json.loads((SITE / 'projects/updates.json').read_text(encoding='utf-8'))
    if data['schemaVersion'] != 1:
        raise ValueError('Unsupported reconciliation schema')
    published = data.get('publishedProjects', [])
    extension_ids = [c['id'] for c in data['concepts'] + published]
    if len(extension_ids) != len(set(extension_ids)):
        raise ValueError('Duplicate reviewed extension ID')
    extension_ids = set(extension_ids)
    con_path = SITE / 'projects/index.html'; atlas_path = SITE / 'atlas/index.html'
    con = con_path.read_text(encoding='utf-8'); atlas = atlas_path.read_text(encoding='utf-8')
    before = [inspect(c) for c in CARD.findall(con) if attr(c, 'id') not in extension_ids]
    if len(before) != data['baselineCount']:
        raise ValueError('Unexpected baseline inventory; reconcile before extending')
    baseline_ids = {r['id'] for r in before}
    if set(data['updates']) - baseline_ids:
        raise ValueError('Metadata update references an unknown project')
    con = CARD.sub(lambda m: '' if attr(m.group(), 'id') in extension_ids else update_card(m.group(), data['updates'][attr(m.group(), 'id')]) if attr(m.group(), 'id') in data['updates'] else m.group(), con)
    con = insert_group(con, 'building', [concept_card(c) for c in data['concepts']])
    con = insert_group(con, 'live', [public_site_card(c, data.get('publicSiteAllowlist', [])) for c in published])
    cards = CARD.findall(con)
    records = [inspect(card) for card in cards]
    if len(records) != data['expectedCount'] or len({r['id'] for r in records}) != len(records):
        raise ValueError('Duplicate or missing project')
    counts = dict(Counter(r['stage'] for r in records))
    atlas_cards = '\n'.join(c.replace('class="card project"', 'class="atlas-orbit"', 1).replace('class="project-cover"', 'class="orbit-cover"').replace('class="project-emblem"', 'class="orbit-icon"').replace('href="./hydra/"', 'href="../projects/hydra/"') for c in cards)
    opening = '<div class="worlds-grid" id="worlds-grid">'; closing = '</div>\n  <div class="compendium-more">'
    a = atlas.index(opening) + len(opening); b = atlas.index(closing, a)
    atlas = atlas[:a] + atlas_cards + atlas[b:]
    con = finish_page(con, data, counts); atlas = finish_page(atlas, data, counts, True)
    if [inspect(c)['id'] for c in CARD.findall(con)] != [inspect(c)['id'] for c in ATLAS_CARD.findall(atlas)]:
        raise ValueError('Public directories diverged')
    catalog = {'schemaVersion': 1, 'reviewedOn': data['reviewedOn'], 'count': len(records), 'stageCounts': counts, 'conceptCount': len(data['concepts']), 'projects': records, 'limits': data['boundaries']}
    (SITE / 'projects/catalog.json').write_text(json.dumps(catalog, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
    con_path.write_text(con, encoding='utf-8'); atlas_path.write_text(atlas, encoding='utf-8')
    patch_navigation()
    print('Public compendium reconciled:', len(records), 'projects;', len(data['concepts']), 'concepts;', len(published), 'explicitly reviewed public website extensions.')


if __name__ == '__main__':
    run()
