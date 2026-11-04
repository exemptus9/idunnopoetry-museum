#!/usr/bin/env python3
"""Build both public directories from source cards and reviewed public metadata.
Only projects/updates.json introduces metadata. No private sources are read.
Run after the approved artwork renderer and before publication tests.
"""
from pathlib import Path
from html import escape, unescape
from collections import Counter
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
    for key in ('id','name','domain','category','icon','description'):
        if not isinstance(item.get(key), str) or not item[key]:
            raise ValueError('Missing concept field: ' + key)
    if not re.fullmatch(r'project-[a-z0-9-]+', item['id']):
        raise ValueError('Unsafe project ID')
    if not re.fullmatch(r'[a-z0-9-]+', item['icon']):
        raise ValueError('Unsafe icon')
    if not (SITE / 'assets/brand' / item['icon'] / 'icon.svg').is_file():
        raise ValueError('Missing concept icon')
    search = escape(' '.join([item['name'],item['category'],item['description'],'concept']).lower(), quote=True)
    return (f'<article class="card project" data-stage="building" data-phase="concept" data-domain="{escape(item["domain"])}" data-updated="" id="{escape(item["id"])}" data-search="{search}">'
            f'<div class="project-top"><span class="type">{escape(item["category"])}</span><span class="state state-concept">Concept</span></div>'
            f'<img class="project-emblem" src="../assets/brand/{escape(item["icon"])}/icon.svg" alt="" loading="lazy" decoding="async">'
            f'<h3>{escape(item["name"])}</h3><p>{escape(item["description"])}</p>'
            '<div class="project-bottom"><div class="project-datestamp"><span class="date-label">Concept retained; no current release</span><span>Implementation date not established</span></div><div class="project-links"><span class="unpublished">Concept · no public application</span></div></div></article>')

def update_card(card, change):
    previous = inspect(card)
    card = re.sub(r'(<h3>[\s\S]*?</h3>)<p>[\s\S]*?</p>', lambda m: m.group(1) + '<p>' + escape(change['description']) + '</p>', card, count=1)
    stamp = '<div class="project-datestamp"><span class="date-label">' + escape(change['dateLabel']) + '</span><time datetime="' + escape(change['date']) + '">' + escape(change['when']) + '</time></div>'
    card = re.sub(r'<div class="project-datestamp">[\s\S]*?</div>', lambda _: stamp, card, count=1)
    card = replace_attr(card, 'data-updated', change['date'])
    card = replace_attr(card, 'data-search', ' '.join([previous['name'], previous['domain'], previous['stage'], change['description']]).lower())
    after = inspect(card)
    for key in ('id','name','stage','domain','links'):
        if previous[key] != after[key]:
            raise ValueError('Unintended identity/audience/link change: ' + previous['id'] + '/' + key)
    return card

def now_panel(data, atlas):
    tiles=[]
    for item in data['now']:
        href=item['href']
        if href=='?ps=concept': href='?ps=concept' + ('#worlds' if atlas else '#group-building')
        tiles.append('<article><h3>'+escape(item['title'])+'</h3><p>'+escape(item['text'])+'</p><a href="'+escape(href,quote=True)+'">'+escape(item['linkLabel'])+' <span aria-hidden="true">↗</span></a></article>')
    return ('<!-- PUBLIC NOW START --><section id="now" class="public-now'+(' section-wrap' if atlas else '')+'" aria-labelledby="now-title">'
            '<div class="now-heading"><div><p class="now-eyebrow">A quick look / November 4, 2026</p><h2 id="now-title">What is taking shape.</h2></div>'
            '<a class="now-all" href="'+('#worlds' if atlas else '#group-live')+'">Explore all '+str(data['expectedCount'])+' projects ↓</a></div>'
            '<p class="now-intro">Published work, active development and early concepts—clearly separated. Reviewed <time datetime="'+data['reviewedOn']+'">November 4, 2026</time>. This is a dated editorial snapshot, not a promise that every project changed today.</p>'
            '<div class="now-grid">'+''.join(tiles)+'</div></section><!-- PUBLIC NOW END -->')

def finish_page(page, data, atlas=False):
    page=re.sub(r'<!-- PUBLIC NOW START -->[\s\S]*?<!-- PUBLIC NOW END -->', '', page)
    marker='<section id="worlds"' if atlas else '<section class="navigator"'
    if marker not in page: raise ValueError('Missing now-panel insertion anchor')
    page=page.replace(marker, now_panel(data,atlas)+'\n'+marker,1)
    if 'projects/now.css' not in page: page=page.replace('</head>','<link rel="stylesheet" href="../projects/now.css">\n</head>',1)
    if 'href="#now"' not in page:
        page=page.replace('<nav aria-label="Main navigation">','<nav aria-label="Main navigation"><a href="#now">Now</a>',1) if not atlas else page.replace('<nav class="topnav" aria-label="Atlas sections">','<nav class="topnav" aria-label="Atlas sections"><a href="#now">Now</a>',1)
    if '<option value="concept">' not in page:
        page=page.replace('<option value="all">All project stages</option>','<option value="all">All project stages</option><option value="concept">Concepts (5)</option>') if atlas else page.replace('<option value="all">All stages</option>','<option value="all">All stages</option><option value="concept">Concepts (5)</option>')
    page=re.sub(r'(<option value="building">In development \()\d+(\)</option>)',r'\g<1>28\2',page)
    page=re.sub(r'\b40(?= (?:projects|project|curated|source-labeled|creative|connected))','45',page)
    page=page.replace('Forty connected projects:', 'Forty-five connected projects:')
    page=re.sub(r'Directory reconciled <time datetime="[^"]+">[^<]+</time>', 'Directory reconciled <time datetime="2026-11-04">November 4, 2026</time>',page)
    page=page.replace('Status was reviewed on October 31, 2026.','Status was reviewed on November 4, 2026.')
    if any(v in page for v in PROTECTED): raise ValueError('Private endpoint exposed')
    return page

def patch_navigation():
    path=SITE/'atlas/worlds.js'
    code=path.read_text(encoding='utf-8')
    code=code.replace('stage:["all","live","preview","building","archive"]','stage:["all","live","preview","building","archive","concept"]')
    code=code.replace('(s==="all"||c.dataset.stage===s)','(s==="all"||(s==="concept"?c.dataset.phase==="concept":c.dataset.stage===s))')
    marker=' apply();\n search.addEventListener("input",change);'
    if 'function revealHash()' not in code:
        if marker not in code: raise ValueError('Project navigation changed; review integration')
        code=code.replace(marker,''' apply();
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
    if 'c.dataset.phase==="concept"' not in code: raise ValueError('Missing concept filter')
    path.write_text(code,encoding='utf-8')
    launch=SITE/'atlas/launchpad.js'
    original=launch.read_text(encoding='utf-8')
    launch.write_text(original.replace("new URL(a.getAttribute('href'),location.href)","new URL(a.getAttribute('href'),document.baseURI)"),encoding='utf-8')

def run():
    data=json.loads((SITE/'projects/updates.json').read_text(encoding='utf-8'))
    if data['schemaVersion']!=1: raise ValueError('Unsupported reconciliation schema')
    con_path=SITE/'projects/index.html'; atlas_path=SITE/'atlas/index.html'
    con=con_path.read_text(encoding='utf-8'); atlas=atlas_path.read_text(encoding='utf-8')
    concept_ids={c['id'] for c in data['concepts']}
    before=[inspect(c) for c in CARD.findall(con) if attr(c,'id') not in concept_ids]
    if len(before)!=data['baselineCount']: raise ValueError('Unexpected baseline inventory; reconcile before extending')
    con=CARD.sub(lambda m: '' if attr(m.group(),'id') in concept_ids else update_card(m.group(),data['updates'][attr(m.group(),'id')]) if attr(m.group(),'id') in data['updates'] else m.group(),con)
    start=con.index('<section class="group" aria-labelledby="group-building"')
    end=con.index('</section>',start)
    chunk=con[start:end]; position=chunk.rfind('</div>')
    chunk=chunk[:position]+'\n'.join(concept_card(c) for c in data['concepts'])+chunk[position:]
    chunk=re.sub(r'(<h2 id="group-building">[\s\S]*?<span class="count">)\d+(</span>)',r'\g<1>28\2',chunk,count=1)
    con=con[:start]+chunk+con[end:]
    cards=CARD.findall(con)
    records=[inspect(card) for card in cards]
    if len(records)!=data['expectedCount'] or len({r['id'] for r in records})!=len(records): raise ValueError('Duplicate or missing project')
    atlas_cards='\n'.join(c.replace('class="card project"','class="atlas-orbit"',1).replace('class="project-cover"','class="orbit-cover"').replace('class="project-emblem"','class="orbit-icon"').replace('href="./hydra/"','href="../projects/hydra/"') for c in cards)
    opening='<div class="worlds-grid" id="worlds-grid">'; closing='</div>\n  <div class="compendium-more">'
    a=atlas.index(opening)+len(opening); b=atlas.index(closing,a)
    atlas=atlas[:a]+atlas_cards+atlas[b:]
    con=finish_page(con,data);atlas=finish_page(atlas,data,True)
    if [inspect(c)['id'] for c in CARD.findall(con)] != [inspect(c)['id'] for c in ATLAS_CARD.findall(atlas)]: raise ValueError('Public directories diverged')
    catalog={'schemaVersion':1,'reviewedOn':data['reviewedOn'],'count':len(records),'stageCounts':dict(Counter(r['stage'] for r in records)),'conceptCount':len(concept_ids),'projects':records,'limits':data['boundaries']}
    (SITE/'projects/catalog.json').write_text(json.dumps(catalog,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    con_path.write_text(con,encoding='utf-8');atlas_path.write_text(atlas,encoding='utf-8')
    patch_navigation()
    print('Public compendium reconciled:',len(records),'projects;',len(concept_ids),'concepts; no audience changes.')

if __name__=='__main__': run()
