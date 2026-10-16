import {config} from './config.js';
import {normalizeCatalog, searchTerms, findPublicTerm, relatedTo, publicVersions, versionAt, csvExport, publicJsonExport, definitionDiff, safeUrl, fold} from './model.js';

const app = document.querySelector('#app');
const empty = {terms: [], relations: [], versions: [], generatedAt: null};
let catalog = empty, connection = 'loading', failure = '', page = 1;
const pageSize = 18;
const esc = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const label = value => String(value ?? '').replaceAll('_', ' ').replace(/\b\w/g, ch => ch.toUpperCase());
const announce = message => { document.querySelector('#announcement').textContent = message; };
const dateLabel = value => value ? value.slice(0, 10) : 'Not documented';
const termLink = term => `?term=${encodeURIComponent(term.slug)}`;
const badge = term => `<span class="badge stage-${esc(term.stage)}">${esc(label(term.stage))}</span>`;
const list = values => values.length ? values.map(esc).join(' · ') : '<span class="muted">Not documented</span>';
const external = (url, title) => { const href = safeUrl(url, location.href); return href ? `<a href="${esc(href)}" target="_blank" rel="noopener noreferrer">${esc(title)} <span class="visually-hidden">(opens in a new tab)</span>↗</a>` : esc(title); };

function navigate(href) {
  const url = new URL(href, location.href);
  history.pushState({}, '', url);
  render();
  document.querySelector('#main').focus({preventScroll: true});
  window.scrollTo({top: 0, behavior: 'instant'});
}
function viewName() { return location.hash.slice(1).split('?')[0] || 'home'; }
function statusNotice() {
  if (connection === 'loading') return '<aside class="notice" role="status">Connecting to the approved public catalog…</aside>';
  if (connection === 'unavailable') return `<aside class="notice warning"><strong>Catalog temporarily unavailable.</strong><p>${esc(failure)} No cached or private records are being substituted.</p><button class="text-button" data-action="retry">Try connection again</button></aside>`;
  if(catalog.warnings?.length) return `<aside class="notice warning"><strong>Catalog metadata requires review.</strong><p>${catalog.warnings.map(esc).join(' ')}</p></aside>`;
  if (!catalog.terms.length) return '<aside class="notice"><span class="status-dot" aria-hidden="true"></span><div><strong>Awaiting the first approved public entries.</strong><p>The public collection is empty. Editorial review and publication approval come before display; private drafts are never loaded here.</p></div></aside>';
  return '';
}
function card(term) {
  return `<article class="word-card"><div class="card-meta">${badge(term)}<span>${esc(term.formation || 'Formation under review')}</span></div><h3><a href="${termLink(term)}">${esc(term.headword)}</a></h3><p>${esc(term.definition || 'Definition not yet established.')}</p><p class="card-domains">${term.domains.slice(0, 3).map(esc).join(' / ') || esc(term.classification)}</p><span class="card-arrow" aria-hidden="true">↗</span></article>`;
}
function emptyPanel(title = 'Nothing public to display yet.', description = 'New material begins in a private workspace. Entries appear here only after an explicit publication decision.') {
  return `<div class="empty-state"><span class="empty-glyph" aria-hidden="true">○</span><h2>${esc(title)}</h2><p>${esc(description)}</p><a class="button secondary" href="#laboratory">Explore the formation laboratory <span aria-hidden="true">↗</span></a></div>`;
}
function home() {
  const selected = catalog.terms.slice(0, 3);
  return `<section class="hero section"><div class="hero-copy"><p class="eyebrow"><span class="status-dot" aria-hidden="true"></span>Language, under observation</p><h1>Every word<br>begins with<br><em>a becoming.</em></h1><p class="hero-description">A living record of the moment a thought finds its form. Follow language from its first spark through meaning, revision, and connection.</p><div class="hero-actions"><a class="button" href="#archive">Enter the word archive <span aria-hidden="true">↗</span></a><a class="quiet-link" href="#methodology">How we observe <span aria-hidden="true">→</span></a></div></div><div class="orbital-figure" aria-hidden="true"><div class="orbit orbit-one"></div><div class="orbit orbit-two"></div><div class="orbit orbit-three"></div><div class="orbit-cross x"></div><div class="orbit-cross y"></div><span class="orbit-label label-a">FORMATION</span><span class="orbit-label label-b">MEANING</span><span class="orbit-label label-c">CONNECTION</span><span class="orbital-center">Aa<span>THE LEXICAL GENOME</span></span><span class="orbital-note">Origin → Form → Meaning → Evolution</span></div></section>
  <section class="section status-section">${statusNotice()}</section>
  <section class="section"><div class="section-heading"><div><p class="eyebrow">Three states. An open history.</p><h2>From experiment to intention.</h2></div><p>Every stage can be revisited.<br>No original wording disappears.</p></div><div class="lifecycle-grid"><a class="stage-card" href="#archive?stage=forge"><span class="card-number">01 / FORGE</span><h3>The spark.</h3><p>A fragment, a sound, an unfinished thought. A word does not need a settled meaning to deserve a record.</p><span class="stage-foot">Experimental formation <span aria-hidden="true">↗</span></span></a><a class="stage-card" href="#archive?stage=lexicon"><span class="card-number">02 / LEXICON</span><h3>The instrument.</h3><p>A developed identity: definition, components, distinctions, and the evidence we can actually support.</p><span class="stage-foot">Documented vocabulary <span aria-hidden="true">↗</span></span></a><a class="stage-card" href="#archive?stage=canon"><span class="card-number">03 / CANON</span><h3>The decision.</h3><p>Explicit authorial approval. Neither an algorithm nor a popularity score can make this editorial choice.</p><span class="stage-foot">Author-approved meaning <span aria-hidden="true">↗</span></span></a></div></section>
  ${selected.length ? `<section class="section"><div class="section-heading"><div><p class="eyebrow">From the public collection</p><h2>Words worth a closer look.</h2></div><a href="#archive">Explore all ${catalog.terms.length} <span aria-hidden="true">→</span></a></div><div class="word-grid">${selected.map(card).join('')}</div></section>` : ''}
  <section class="section exhibition-grid"><a class="exhibition constellation-exhibit" href="#constellation"><span class="eyebrow">01 / Lexiconography</span><h2>Ideas have<br>neighbours.</h2><p>Follow documented relationships. See which connections are supported and which remain hypotheses.</p><span class="exhibition-link">Open the constellation ↗</span></a><a class="exhibition lab-exhibit" href="#laboratory"><span class="eyebrow">02 / Language laboratory</span><h2>Take a word<br>apart.</h2><p>Explore blending, compounding, derivation, and the small structural moves that make new language possible.</p><span class="exhibition-link">Enter the laboratory ↗</span></a></section>
  <section class="section manifesto"><p class="eyebrow">The observatory principle</p><blockquote>“Words are not merely invented.<br>They are observed becoming.”</blockquote><p>Document what is known. Label what is uncertain.<br>Leave room for the next meaning.</p></section>`;
}
function archive() {
  const hashParams = new URLSearchParams(location.hash.split('?')[1] || '');
  const params = new URLSearchParams(location.search);
  const filters = Object.fromEntries(['q','stage','domain','formation','letter','sort'].map(key => [key, params.get(key) || hashParams.get(key) || '']));
  const domainOptions = [...new Set(catalog.terms.flatMap(t => t.domains))].sort();
  const formationOptions = [...new Set(catalog.terms.map(t => t.formation).filter(Boolean))].sort();
  const options = (values, selected) => values.map(value => `<option value="${esc(value)}"${value === selected ? ' selected' : ''}>${esc(label(value))}</option>`).join('');
  const matching = searchTerms(catalog, filters);
  const visible = matching.slice(0, page * pageSize);
  return `<section class="section page-intro"><p class="eyebrow">The word archive</p><h1>Find a word.<br><em>Follow a thought.</em></h1><p>Search definitions, forms, roots, and conceptual families. Every result is explicitly approved for public display.</p></section><section class="section archive-section">${statusNotice()}<form id="search-form" class="search-panel" role="search"><label for="query" class="search-label">Search the public collection</label><div class="search-field"><span aria-hidden="true">⌕</span><input id="query" name="q" type="search" autocomplete="off" maxlength="160" value="${esc(filters.q)}" placeholder="A word, a root, a thought…"><button type="submit" class="button">Search</button></div><div class="filter-grid"><label>Stage<select name="stage"><option value="">All stages</option>${options(['forge','lexicon','canon'], filters.stage)}</select></label><label>Conceptual domain<select name="domain"><option value="">All domains</option>${options(domainOptions, filters.domain)}</select></label><label>Word formation<select name="formation"><option value="">All formations</option>${options(formationOptions, filters.formation)}</select></label><label>Order<select name="sort">${options(['relevance','alphabetical','documented'], filters.sort || 'relevance')}</select></label></div><input type="hidden" name="letter" value="${esc(filters.letter)}"><div class="alphabet" aria-label="Browse by first letter"><button type="button" data-letter="" aria-pressed="${!filters.letter}">All</button>${'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map(letter => `<button type="button" data-letter="${letter}" aria-pressed="${filters.letter === letter}">${letter}</button>`).join('')}</div></form><div class="results-heading"><p role="status">${connection === 'unavailable' ? 'Results unavailable' : `${matching.length} public ${matching.length === 1 ? 'entry' : 'entries'}${filters.q ? ` matching “${esc(filters.q)}”` : ''}`}</p><div class="export-actions"><button class="text-button" data-action="json">Export JSON</button><button class="text-button" data-action="csv">Export CSV</button></div></div>${visible.length ? `<div class="word-grid">${visible.map(card).join('')}</div>${visible.length < matching.length ? `<div class="load-more"><button class="button secondary" data-action="more">Show ${Math.min(pageSize, matching.length - visible.length)} more entries</button></div>` : ''}` : emptyPanel(catalog.terms.length ? 'No matching public entries.' : 'The archive starts with editorial care.', catalog.terms.length ? 'Try a shorter spelling, another domain, or fewer filters. Approximate spelling is supported for individual words of four or more letters.' : 'The infrastructure is open. The personal vocabulary remains private until the author approves individual entries for publication.')}</section>`;
}
function sources(records) {
  return records.length ? `<ul class="source-list">${records.map(s => `<li><strong>${s.url ? external(s.url, s.label) : esc(s.label)}</strong><span class="small-meta">Source date: ${esc(dateLabel(s.sourceDate))} · ${esc(label(s.evidence))}</span>${s.summary ? `<p>${esc(s.summary)}</p>` : ''}${s.originalWording ? `<blockquote>${esc(s.originalWording)}</blockquote>` : ''}</li>`).join('')}</ul>` : '<p class="muted">No approved public source witnesses are attached. This does not establish absence of earlier use.</p>';
}
function detail(slug) {
  const term = findPublicTerm(catalog, slug);
  if (!term) return `<section class="section">${statusNotice()}<p class="eyebrow">Public entry</p><h1>Entry unavailable.</h1><p>This address does not identify an approved public entry. It may be unpublished, withdrawn, or mistyped.</p><a class="button" href="#archive">Return to the public archive</a></section>`;
  const relations = relatedTo(catalog, term.id), versions = publicVersions(catalog, term.id);
  return `<section class="section detail-intro"><a class="back-link" href="#archive">← Word archive</a><div class="card-meta">${badge(term)}<span>${esc(term.classification)}</span></div><h1>${esc(term.headword)}</h1>${term.pronunciation ? `<p class="pronunciation">${esc(term.pronunciation)} ${term.ipa ? `/ ${esc(term.ipa)} /` : ''}</p>` : ''}<p class="definition">${esc(term.definition || 'A public experimental form; a settled definition has not been established.')}</p><div class="detail-actions"><button class="button secondary" data-action="copy-link">Copy permalink</button><button class="text-button" data-action="copy-definition">Copy definition</button><button class="text-button" data-action="certificate">Print record of emergence</button></div></section>
  <section class="section detail-layout"><div class="detail-main"><article class="paper-panel"><p class="eyebrow">The word genome</p><h2>A blueprint, with the gaps intact.</h2><div class="genome-flow" aria-label="Word formation sequence"><span>Origin<br><strong>${esc(term.authorship)}</strong></span><span>Components<br><strong>${term.components.length ? term.components.map(esc).join(' + ') : 'Not established'}</strong></span><span>Formation<br><strong>${esc(term.formation || 'Not classified')}</strong></span><span>Meaning<br><strong>${esc(term.domains.join(' / ') || 'Not classified')}</strong></span></div><dl class="record-grid"><dt>Part of speech</dt><dd>${esc(term.partOfSpeech || 'Not documented')}</dd><dt>Variant forms</dt><dd>${list(term.variants)}</dd><dt>Preferred capitalization</dt><dd>${esc(term.preferredCapitalization || term.headword)}</dd><dt>Literal interpretation</dt><dd>${esc(term.literalMeaning || 'Not documented')}</dd><dt>Figurative interpretation</dt><dd>${esc(term.figurativeMeaning || 'Not documented')}</dd><dt>Conceptual distinction</dt><dd>${esc(term.conceptualGap || 'Not documented')}</dd><dt>Domains</dt><dd>${list(term.domains)}</dd><dt>Tags</dt><dd>${list(term.tags)}</dd></dl></article>
  ${term.senses.length ? `<article class="paper-panel"><p class="eyebrow">Distinct senses</p><ol class="sense-list">${term.senses.map(s => `<li>${s.label ? `<strong>${esc(s.label)}</strong> ` : ''}${esc(s.definition)}</li>`).join('')}</ol></article>` : ''}
  ${term.examples.length ? `<article class="paper-panel"><p class="eyebrow">Approved examples</p>${term.examples.map(example => `<blockquote>${esc(example)}</blockquote>`).join('')}</article>` : ''}
  <article class="paper-panel"><p class="eyebrow">Definition archaeology</p><h2>Meaning has a history.</h2>${versions.length ? `<label class="time-machine">Inspect a documented public state<input id="time-at" type="date" aria-describedby="time-help"></label><p id="time-help" class="muted">Finds the latest approved public version on or before the date. Publication history may be incomplete; private revisions are never exposed.</p><div id="time-result" aria-live="polite"></div><ol class="timeline">${versions.map((v, i) => {const diff = i ? definitionDiff(versions[i-1].definition, v.definition) : null;return `<li><span class="small-meta">${esc(dateLabel(v.effectiveAt))}${v.stage ? ` · ${esc(label(v.stage))}` : ''}</span><p>${esc(v.definition)}</p>${v.note ? `<p class="muted">${esc(v.note)}</p>` : ''}${diff && (diff.added || diff.removed) ? `<details><summary>Show wording changes</summary><p>${esc(diff.unchangedStart)} ${diff.removed ? `<del>${esc(diff.removed)}</del>` : ''} ${diff.added ? `<ins>${esc(diff.added)}</ins>` : ''} ${esc(diff.unchangedEnd)}</p><p class="muted">Textual change only; this comparison does not infer a semantic shift.</p></details>` : ''}</li>`;}).join('')}</ol>` : '<p class="muted">No public historical definition versions are attached. The current definition is not evidence of an earlier wording.</p>'}</article>
  <article class="paper-panel"><p class="eyebrow">Source → Witness → Work → Revision → Lineage</p><h2>What can be supported?</h2>${term.provenanceSummary ? `<p>${esc(term.provenanceSummary)}</p>` : ''}${sources(term.witnesses)}</article><article class="paper-panel"><p class="eyebrow">Across the creative corpus</p><h2>Language in context.</h2>${sources(term.corpus)}</article></div>
  <aside class="detail-aside"><div class="aside-panel"><p class="eyebrow">Evidence &amp; attribution</p><dl><dt>Authorship status</dt><dd>${esc(term.authorship)}</dd><dt>Attribution</dt><dd>${esc(term.attribution || 'Not established')}</dd><dt>Evidence strength</dt><dd>${esc(label(term.evidence))}</dd><dt>Earliest documented appearance</dt><dd>${esc(dateLabel(term.earliestAppearance))}</dd><dt>Imported</dt><dd>${esc(dateLabel(term.importedAt))}</dd><dt>Published</dt><dd>${esc(dateLabel(term.publishedAt))}</dd>${term.stage === 'canon' ? `<dt>Canon approval</dt><dd>Explicit editorial decision · ${esc(dateLabel(term.canonApprovedAt))}</dd>` : ''}</dl><p class="evidence-note">${esc(term.originality || 'No claim of absolute originality is established by this record. A missing attestation is not proof of first invention.')}</p></div><div class="aside-panel"><p class="eyebrow">Conceptual neighbours</p>${relations.length ? `<ul class="relationship-list">${relations.map(({relation, term: other}) => `<li><a href="${termLink(other)}">${esc(other.headword)} <span aria-hidden="true">↗</span></a><span>${esc(relation.type)} · ${relation.inferred ? 'Inferred hypothesis' : esc(label(relation.evidence))}</span>${relation.explanation ? `<p>${esc(relation.explanation)}</p>` : ''}</li>`).join('')}</ul>` : '<p class="muted">No approved relationships are attached.</p>'}<a href="#constellation">Open the constellation →</a></div></aside></section>`;
}
function constellation() {
  return `<section class="section page-intro"><p class="eyebrow">Lexiconography</p><h1>Thought is<br><em>a constellation.</em></h1><p>Navigate relationships across the approved vocabulary. Solid lines represent documented associations; dotted lines represent explicit hypotheses. Similarity is never silently converted into etymology.</p></section><section class="section">${statusNotice()}${catalog.terms.length ? `<div class="graph-controls"><label>Highlight a term<input id="graph-search" type="search" placeholder="Search this constellation" maxlength="100"></label><label>Relationship evidence<select id="graph-evidence"><option value="all">All public relationships</option><option value="documented">Documented associations</option><option value="inferred">Inferred hypotheses</option></select></label><div class="graph-buttons"><button class="button secondary" data-graph="in" aria-label="Zoom in">+</button><button class="button secondary" data-graph="out" aria-label="Zoom out">−</button><button class="button secondary" data-graph="reset">Reset</button></div></div><p class="muted graph-help">Drag to pan; use the zoom buttons or arrow keys when the canvas is focused. All entries and connections are available in the list below. The visual displays at most 80 terms.</p><div id="graph" class="graph" tabindex="0" role="region" aria-label="Interactive lexical constellation. Arrow keys pan; plus and minus keys zoom."></div><div id="graph-list"></div>` : emptyPanel('No public constellation is populated yet.', 'Relationships appear only when their endpoints are public and the relationship itself has passed publication review.')}</section>`;
}
function evolution() {
  const events = catalog.terms.filter(t => t.earliestAppearance || t.publishedAt).map(t => ({term: t, date: t.earliestAppearance || t.publishedAt, type: t.earliestAppearance ? 'Earliest documented appearance' : 'Public publication'})).sort((a,b) => a.date.localeCompare(b.date));
  return `<section class="section page-intro"><p class="eyebrow">The evolutionarium</p><h1>Words change.<br><em>Keep the evidence.</em></h1><p>Explore documented appearances and public definition revisions. Capture, import, publication, and invention are different events.</p></section><section class="section">${statusNotice()}${events.length ? `<ol class="timeline evolution-timeline">${events.map(event => `<li><span class="small-meta">${esc(dateLabel(event.date))} · ${esc(event.type)}</span><h2><a href="${termLink(event.term)}">${esc(event.term.headword)}</a></h2><p>${esc(event.term.definition)}</p><p class="muted">${publicVersions(catalog, event.term.id).length} approved public historical versions</p></li>`).join('')}</ol>` : emptyPanel('A timeline requires documented dates.', 'Unknown dates remain unknown. Publication timestamps are never substituted for dates of invention.')}<div class="method-note"><h2>What is counted?</h2><p>The public catalog contains ${connection === 'unavailable' ? 'an unavailable number of' : catalog.terms.length} approved entries, ${connection === 'unavailable' ? 'an unavailable number of' : catalog.relations.length} public relationships, and ${connection === 'unavailable' ? 'an unavailable number of' : catalog.versions.length} public definition versions. These are records of documentation, not a count of all words invented or all historical revisions.</p>${catalog.generatedAt ? `<p class="small-meta">Projection generated: ${esc(catalog.generatedAt)}</p>` : ''}</div></section>`;
}
const formations = {
  blending: {title:'Blending', parts:['smoke','fog'], word:'smog', description:'Parts of two words overlap or compress into one form. The result carries elements of both source meanings.', note:'An established English example. This demonstration makes no claim about authorship or earliest use.'},
  compounding: {title:'Compounding', parts:['tooth','brush'], word:'toothbrush', description:'Complete words combine to name a concept. The relationship between components contributes to the combined meaning.', note:'A compound may be written closed, open, or hyphenated; spelling alone does not settle the classification.'},
  derivation: {title:'Derivation', parts:['kind','-ness'], word:'kindness', description:'An affix attaches to a base and changes its meaning or grammatical role. Here, an adjective becomes a noun.', note:'A productive pattern is not a guarantee that every possible formation will be useful or established.'},
  backformation: {title:'Back-formation', parts:['editor','remove apparent -or'], word:'edit', description:'A shorter form is created by removing a part interpreted as an affix. The longer word can precede the shorter one.', note:'Historical order requires evidence. Visual resemblance by itself cannot establish back-formation.'},
  extension: {title:'Semantic extension', parts:['mouse','computing context'], word:'mouse', description:'An existing word gains an additional sense. The form stays familiar while its semantic territory expands.', note:'A new sense is not automatically a new word or a claim of original invention.'},
};
function laboratory() {
  return `<section class="section page-intro"><p class="eyebrow">The language laboratory</p><h1>Small pieces.<br><em>New possibilities.</em></h1><p>Experiment with the mechanics of word formation. These established English examples are educational specimens, separate from the author’s lexical collection.</p></section><section class="section laboratory-layout"><div class="lab-selector"><label for="formation-specimen">Choose a formation process</label><select id="formation-specimen">${Object.entries(formations).map(([key,f]) => `<option value="${key}">${esc(f.title)}</option>`).join('')}</select><p>Watch the components, the operation, and the resulting form. A plausible construction still needs a useful meaning.</p></div><article id="specimen" class="specimen" aria-live="polite"></article></section><section class="section"><div class="method-note"><p class="eyebrow">Try a construction privately</p><h2>What could these pieces become?</h2><p>This local demonstration joins what you type. It does not save, publish, research, or claim originality for the result.</p><form id="construction-form" class="construction-form"><label>First piece<input name="first" maxlength="40" autocomplete="off" required placeholder="A base or fragment"></label><span aria-hidden="true">+</span><label>Second piece<input name="second" maxlength="40" autocomplete="off" required placeholder="Another piece"></label><button class="button" type="submit">Explore overlaps</button></form><div id="construction-result" aria-live="polite"></div></div></section>`;
}
function methodology() {
  return `<section class="section page-intro"><p class="eyebrow">Methodology</p><h1>Evidence first.<br><em>Wonder intact.</em></h1><p>The Observatory studies language as a developing record. A compelling interpretation is an invitation to investigate; it is not a historical fact.</p></section><section class="section method-grid"><article class="paper-panel"><span class="card-number">01 / EDITORIAL AUTHORITY</span><h2>The author holds the pen.</h2><p>Forge captures possibilities. Lexicon develops their identities. Canon requires an explicit authorial decision. Entries may move backward without losing the history of those decisions.</p><p>Publication is a separate decision from lexical maturity. Even a Canon entry may remain private. This public interface never performs editorial writes.</p></article><article class="paper-panel"><span class="card-number">02 / PROVENANCE</span><h2>Separate the clocks.</h2><p>Source date, earliest documented appearance, import time, revision time, and publication date are recorded separately. Unknown dates stay unknown.</p><p>Evidence may be verified, supported, reported, hypothetical, or unknown. Database timestamps alone do not establish legal priority.</p></article><article class="paper-panel"><span class="card-number">03 / AUTHORSHIP</span><h2>Attribution is a question.</h2><p>An author-created term, an AI suggestion, a collaborative revision, a borrowed word, and an undetermined origin are distinct claims. Inclusion in an archive does not establish original invention.</p><p>“No prior attestation found in the searched sources” remains a limited research finding. It is never proof that no prior use exists.</p></article><article class="paper-panel"><span class="card-number">04 / RELATIONSHIPS</span><h2>A line needs a reason.</h2><p>Shared roots, true derivation, conceptual association, and inferred semantic similarity are different relationships. Evidence and explanations travel with each connection.</p><p>Lexiconography is used here as a project concept for mapping lexical relationships, histories, and conceptual ecosystems. It is not asserted to be a newly discovered academic discipline.</p></article><article class="paper-panel"><span class="card-number">05 / PRIVACY</span><h2>A source can remain private.</h2><p>The public catalog receives only an approved projection. Private documents, correspondence, sensitive context, and unpublished manuscripts do not become public because they support a lexical record.</p><p>An approved public summary can describe evidence without exposing its source. Publication can be withdrawn independently of the original archival record.</p></article><article class="paper-panel"><span class="card-number">06 / INTELLIGENCE</span><h2>Suggestions require review.</h2><p>Any AI analysis, derivative, collision research, or proposed relationship must remain visibly a suggestion until a human reviews it. This interface does not claim to run live AI or continuous external research.</p><p>Search here uses exact and partial matching, variants, components, domains, and bounded spelling distance. No paid embedding or AI service is required.</p></article></section><section class="section integration-note"><p class="eyebrow">One archive, multiple windows</p><h2>Connected without competing copies.</h2><p>The Museum and Word Archive can read the same approved public projection. Authoritative editorial writes belong in the authenticated Word Archive workspace; this Museum interface is a read-only view. RhymeMosaic links and approved creative-source references connect readers to the broader work. <a href="https://exemptus9.github.io/artificial-continuity/">Visit the public Continuity project ↗</a>.</p><p>Continuity’s Source → Witness → Work/Seed → Revision → Lineage model informs the provenance structure. Automated ingestion and bidirectional synchronization are not represented as completed integrations.</p></section>`;
}
function render() {
  const slug = new URLSearchParams(location.search).get('term');
  const view = slug ? 'detail' : viewName();
  const pages = {home, archive, constellation, evolution, laboratory, methodology};
  app.innerHTML = slug ? detail(slug) : (pages[view] || home)();
  document.querySelectorAll('[data-nav]').forEach(link => link.setAttribute('aria-current', link.dataset.nav === view ? 'page' : 'false'));
  const term = slug ? findPublicTerm(catalog, slug) : null;
  document.title = term ? `${term.headword} · Lexical Observatory` : `${view === 'home' ? 'A living museum of language' : label(view)} · Lexical Observatory`;
  const description = term?.definition || 'Observe how words emerge, develop, connect, and become. Evidence, revision, and authorial judgment in a living lexical archive.';
  document.querySelector('meta[name="description"]').content = description.slice(0, 180);
  let robots = document.querySelector('meta[name="robots"]');
  if (!robots) {robots = document.createElement('meta'); robots.name='robots'; document.head.append(robots);}
  robots.content = slug && !term ? 'noindex, nofollow' : 'index, follow';
  updateCanonical(term);
  bind();
  if (view === 'constellation' && catalog.terms.length) setupGraph();
  if (view === 'laboratory') renderSpecimen('blending');
}
function updateCanonical(term) {
  document.querySelector('#term-schema')?.remove();
  if (!config.canonicalBase) return;
  const base = safeUrl(config.canonicalBase);
  if (!base) return;
  const url = term?.permalink ? new URL(term.permalink, base) : new URL(base); if (term && !term.permalink) url.searchParams.set('term', term.slug);
  let canonical = document.querySelector('link[rel="canonical"]');
  if (!canonical) {canonical = document.createElement('link'); canonical.rel='canonical'; document.head.append(canonical);}
  canonical.href = url.href;
  if (term) {
    const schema = document.createElement('script'); schema.id='term-schema'; schema.type='application/ld+json';
    schema.textContent = JSON.stringify({'@context':'https://schema.org','@type':'DefinedTerm',name:term.headword,description:term.definition,url:url.href,inDefinedTermSet:{'@type':'DefinedTermSet',name:'Lexical Observatory',url:base}});
    document.head.append(schema);
  }
}
function searchNavigate(form) {
  const data = new FormData(form), params = new URLSearchParams();
  for (const [key,value] of data) if (String(value).trim()) params.set(key, String(value).trim());
  page = 1;
  navigate(`?${params.toString()}#archive`);
  announce(`${searchTerms(catalog, Object.fromEntries(params)).length} public results`);
}
function bind() {
  document.querySelector('#search-form')?.addEventListener('submit', event => {event.preventDefault(); searchNavigate(event.currentTarget);});
  document.querySelectorAll('#search-form select').forEach(select => select.addEventListener('change', () => searchNavigate(document.querySelector('#search-form'))));
  document.querySelectorAll('[data-letter]').forEach(button => button.addEventListener('click', () => {const form=document.querySelector('#search-form');form.elements.letter.value=button.dataset.letter;searchNavigate(form);}));
  document.querySelector('#time-at')?.addEventListener('change', event => {
    const slug = new URLSearchParams(location.search).get('term'), term=findPublicTerm(catalog,slug);
    const version=versionAt(catalog,term.id,event.target.value);
    document.querySelector('#time-result').innerHTML=version ? `<div class="notice"><div><strong>Public version recorded ${esc(dateLabel(version.effectiveAt))}</strong><p>${esc(version.definition)}</p></div></div>` : '<p class="notice">No approved public version is recorded on or before this date.</p>';
  });
  document.querySelector('#formation-specimen')?.addEventListener('change', event => renderSpecimen(event.target.value));
  document.querySelector('#construction-form')?.addEventListener('submit', event => {
    event.preventDefault(); const data=new FormData(event.currentTarget),first=String(data.get('first')).trim(),second=String(data.get('second')).trim();
    let overlap=0;for(let i=1;i<=Math.min(first.length,second.length);i++) if(fold(first.slice(-i))===fold(second.slice(0,i))) overlap=i;
    const combined=first+second.slice(overlap);
    document.querySelector('#construction-result').innerHTML=`<div class="construction-output"><strong>${esc(combined)}</strong><p>${overlap ? `${overlap} overlapping ${overlap===1?'character':'characters'} at the join.` : 'No literal character overlap; the pieces are joined.'} This mechanical construction does not establish meaning, natural pronunciation, originality, or acceptance.</p></div>`;
  });
}
function renderSpecimen(key) {
  const f=formations[key] || formations.blending;
  document.querySelector('#specimen').innerHTML=`<p class="eyebrow">Specimen / ${esc(f.title)}</p><div class="specimen-parts">${f.parts.map(part=>`<span>${esc(part)}</span>`).join('<b aria-hidden="true">+</b>')}</div><span class="specimen-arrow" aria-hidden="true">↓</span><h2>${esc(f.word)}</h2><p>${esc(f.description)}</p><p class="small-meta">${esc(f.note)}</p>`;
}
function download(data, name, type) {
  const url=URL.createObjectURL(new Blob([data],{type})), a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);announce(`Downloaded ${name}`);
}
async function copy(text, success) {
  try {await navigator.clipboard.writeText(text);announce(success);}
  catch {announce('Clipboard access unavailable. Select and copy the page text, or copy the address from your browser.');}
}
document.addEventListener('click', event => {
  const anchor=event.target.closest('a');
  if(anchor && anchor.getAttribute('href') !== '#main' && !event.ctrlKey && !event.metaKey && !event.shiftKey && event.button===0) {
    const url=new URL(anchor.getAttribute('href'),location.href);
    if(url.origin===location.origin && url.pathname===location.pathname && (url.hash || url.searchParams.has('term'))) {
      event.preventDefault();if(anchor.getAttribute('href').startsWith('#'))url.search='';navigate(url.href);return;
    }
  }
  const button=event.target.closest('[data-action]'); if(!button)return;
  const action=button.dataset.action,slug=new URLSearchParams(location.search).get('term'),term=findPublicTerm(catalog,slug);
  if(action==='retry')loadCatalog();
  if(action==='json')download(JSON.stringify(publicJsonExport(catalog),null,2),'lexical-observatory-public.json','application/json');
  if(action==='csv')download(csvExport(catalog),'lexical-observatory-public.csv','text/csv;charset=utf-8');
  if(action==='more'){page++;const y=scrollY;render();window.scrollTo(0,y);announce('More public entries displayed.');}
  if(action==='copy-link')copy(term.permalink ? safeUrl(term.permalink, config.canonicalBase || location.href) : location.origin+location.pathname+termLink(term),'Public permalink copied.');
  if(action==='copy-definition')copy(`${term.headword}: ${term.definition}`,'Definition copied.');
  if(action==='certificate')window.print();
});
window.addEventListener('popstate', render);
window.addEventListener('hashchange', render);

async function loadCatalog() {
  connection='loading';render();const controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),config.requestTimeoutMs);
  try {
    const endpoint=safeUrl(config.catalogEndpoint,location.href);if(!endpoint)throw new Error('The public catalog endpoint has not been configured.');
    const response=await fetch(endpoint,{signal:controller.signal,credentials:'omit',headers:{Accept:'application/json'},cache:'no-cache'});
    if(!response.ok)throw new Error(`The public service returned HTTP ${response.status}.`);
    if(Number(response.headers.get('content-length'))>config.maxCatalogBytes)throw new Error('The catalog exceeds this client’s download limit.');
    const body=await response.text();if(body.length>config.maxCatalogBytes)throw new Error('The catalog exceeds this client’s download limit.');
    catalog=normalizeCatalog(JSON.parse(body));connection='ready';failure='';
  }catch(error){catalog=empty;connection='unavailable';failure=error.name==='AbortError'?'The public service did not respond in time.':error instanceof SyntaxError?'The public service did not return a valid catalog.':error.message;}
  finally{clearTimeout(timeout);render();}
}
function setupGraph() {
  const container=document.querySelector('#graph'),ns='http://www.w3.org/2000/svg';
  let zoom=1,dx=0,dy=0,drag=null;
  const terms=catalog.terms.slice(0,80),ids=new Set(terms.map(t=>t.id));
  const positions=new Map(terms.map((t,i)=>{const a=i*Math.PI*(3-Math.sqrt(5)),r=45+Math.sqrt(i/Math.max(1,terms.length-1))*230;return[t.id,{x:440+Math.cos(a)*r,y:320+Math.sin(a)*r}];}));
  function draw(){
    const query=fold(document.querySelector('#graph-search').value),evidence=document.querySelector('#graph-evidence').value;
    const relations=catalog.relations.filter(r=>ids.has(r.from)&&ids.has(r.to)&&(evidence==='all'||(evidence==='inferred'?r.inferred:!r.inferred)));
    const svg=document.createElementNS(ns,'svg');svg.setAttribute('viewBox','0 0 880 640');svg.setAttribute('aria-hidden','true');svg.setAttribute('focusable','false');
    const group=document.createElementNS(ns,'g');group.setAttribute('transform',`translate(${dx} ${dy}) translate(440 320) scale(${zoom}) translate(-440 -320)`);
    relations.forEach(r=>{const a=positions.get(r.from),b=positions.get(r.to),line=document.createElementNS(ns,'line');for(const[key,value]of Object.entries({x1:a.x,y1:a.y,x2:b.x,y2:b.y}))line.setAttribute(key,value);line.setAttribute('class',r.inferred?'graph-edge inferred':'graph-edge');group.append(line);});
    terms.forEach(t=>{const p=positions.get(t.id),a=document.createElementNS(ns,'a');a.setAttribute('href',termLink(t));a.setAttribute('tabindex','-1');a.setAttribute('class',`graph-node ${query&&!fold(t.headword).includes(query)?'dim':''}`);const dot=document.createElementNS(ns,'circle');dot.setAttribute('cx',p.x);dot.setAttribute('cy',p.y);dot.setAttribute('r',6);const name=document.createElementNS(ns,'text');name.setAttribute('x',p.x+12);name.setAttribute('y',p.y+5);name.textContent=t.headword;a.append(dot,name);group.append(a);});
    svg.append(group);container.replaceChildren(svg);
    const allRelations=catalog.relations.filter(r=>evidence==='all'||(evidence==='inferred'?r.inferred:!r.inferred));
    const filtered=catalog.terms.filter(t=>!query||fold(t.headword).includes(query));
    document.querySelector('#graph-list').innerHTML=`<h2 class="relationship-heading">Accessible relationship directory</h2><p class="muted">${filtered.length} public ${filtered.length===1?'term':'terms'}. The directory includes all matching records, including those outside the visual’s 80-term limit.</p><div class="relationship-directory">${filtered.map(t=>{const connections=allRelations.filter(r=>r.from===t.id||r.to===t.id);return `<article><h3><a href="${termLink(t)}">${esc(t.headword)}</a></h3>${connections.length?`<ul>${connections.map(r=>{const other=catalog.terms.find(o=>o.id===(r.from===t.id?r.to:r.from));return `<li>${esc(r.type)} → <a href="${termLink(other)}">${esc(other.headword)}</a> <span class="small-meta">(${r.inferred?'Inferred hypothesis':esc(label(r.evidence))})</span>${r.explanation?`<p>${esc(r.explanation)}</p>`:''}</li>`;}).join('')}</ul>`:'<p class="muted">No approved public connections.</p>'}</article>`;}).join('')}</div>`;
  }
  document.querySelector('#graph-search').addEventListener('input',draw);document.querySelector('#graph-evidence').addEventListener('change',draw);
  document.querySelectorAll('[data-graph]').forEach(button=>button.addEventListener('click',()=>{if(button.dataset.graph==='in')zoom=Math.min(3,zoom*1.2);if(button.dataset.graph==='out')zoom=Math.max(.5,zoom/1.2);if(button.dataset.graph==='reset'){zoom=1;dx=0;dy=0;}draw();}));
  container.addEventListener('keydown',event=>{const moves={ArrowLeft:[30,0],ArrowRight:[-30,0],ArrowUp:[0,30],ArrowDown:[0,-30]};if(moves[event.key]){event.preventDefault();dx+=moves[event.key][0];dy+=moves[event.key][1];draw();}else if(['+','=','-'].includes(event.key)){event.preventDefault();zoom=Math.max(.5,Math.min(3,zoom*(event.key==='-'?1/1.2:1.2)));draw();}});
  container.addEventListener('pointerdown',event=>{if(event.target.closest('a'))return;drag={x:event.clientX,y:event.clientY,dx,dy};container.setPointerCapture(event.pointerId);});
  container.addEventListener('pointermove',event=>{if(!drag)return;const scale=880/container.clientWidth;dx=drag.dx+(event.clientX-drag.x)*scale;dy=drag.dy+(event.clientY-drag.y)*scale;draw();});
  container.addEventListener('pointerup',()=>{drag=null;});container.addEventListener('pointercancel',()=>{drag=null;});draw();
}
const editor=safeUrl(config.editorialUrl,location.href);
if(editor){const target=document.querySelector('#editorial-link');target.innerHTML=`<a href="${esc(editor)}">Author’s private workbench ↗</a>`;}
loadCatalog();
