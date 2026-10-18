/** Pure public-catalog functions. Public authorization must happen on the server. */
export const STAGES = ['forge', 'lexicon', 'canon'];
export const DEFINITION_STATES = ['author_supplied','working_definition','awaiting_definition','conversation_recovered','inferred_definition'];
export const CLASSIFICATIONS = ['coinage_candidate','existing_form_reinterpreted','expression','term_seed','unclassified','proper_name','literary_wordplay','concept_label','ai_suggestion','existing_term'];
export const REVIEW_STATES = ['open','resolved','deferred'];
export const DEFINITION_BASES = ['author_supplied','conversation_recovered','archive_recovered','inferred','unknown'];
export const REVIEW_FLAGS = ['definition_conflict','definition_needed','meaning_inferred','classification_review','variant_review','attribution_review','source_needed','author_decision','duplicate_candidate'];
const EVIDENCE = ['verified', 'supported', 'reported', 'hypothetical', 'unknown'];
const normalizedCatalogs = new WeakSet(), normalizedTerms = new WeakSet(), searchIndexes = new WeakMap();
const text = value => typeof value === 'string' ? value.trim() : '';
const strings = value => Array.isArray(value) ? value.map(v => typeof v === 'string' ? v : text(v?.label || v?.name || v?.word)).filter(Boolean) : [];
export function normalizeReview(value) {
  const review = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {state:REVIEW_STATES.includes(review.state)?review.state:'open',
    flags:[...new Set(Array.isArray(review.flags)?review.flags.filter(flag=>REVIEW_FLAGS.includes(flag)):[])],
    definitionBasis:DEFINITION_BASES.includes(review.definitionBasis)?review.definitionBasis:'unknown',note:text(review.note).slice(0,2000)};
}
export function fold(value) {
  return text(value).normalize('NFKD').replace(/\p{M}/gu, '').toLocaleLowerCase('en');
}
export function slugify(value) {
  return fold(value).replace(/[’']/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}
export function safeUrl(value, base = 'https://example.invalid/') {
  if (typeof value !== 'string' || !value.trim()) return '';
  try { const url = new URL(value, base); return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password ? url.href : ''; }
  catch { return ''; }
}
export function isApprovedPublic(record) {
  if (!record || typeof record !== 'object') return false;
  return record.visibility === 'approved_public';
}
function date(value) {
  const s = text(value);
  if (!/^\d{4}(-\d{2})?(-\d{2})?(T[\d:.+Z-]+)?$/.test(s)) return null;
  const check = s.length === 4 ? `${s}-01-01` : s.length === 7 ? `${s}-01` : s;
  if (s.length >= 10) {
    const day = new Date(`${s.slice(0, 10)}T00:00:00Z`);
    if (!Number.isFinite(day.valueOf()) || day.toISOString().slice(0, 10) !== s.slice(0, 10)) return null;
  }
  return Number.isFinite(Date.parse(check)) ? s : null;
}
function sourceRecord(source) {
  return {
    id: text(source.id), label: text(source.label || source.title) || 'Approved source summary',
    summary: text(source.publicSummary || source.public_summary || source.summary),
    originalWording: text(source.approvedExcerpt || source.approved_excerpt),
    sourceDate: date(source.sourceDate || source.source_date),
    evidence: EVIDENCE.includes(source.evidence || source.evidenceStrength) ? (source.evidence || source.evidenceStrength) : 'unknown',
    url: safeUrl(source.url),
  };
}
export function normalizeCatalog(payload) {
  if (!payload || !Array.isArray(payload.terms) || !Array.isArray(payload.relations) || !Array.isArray(payload.versions)) {
    throw new Error('Catalog does not match the public projection contract.');
  }
  const seen = new Set(), slugs = new Set(), warnings = [];
  const terms = payload.terms.filter(isApprovedPublic).map(raw => {
    const headword = text(raw.headword || raw.term || raw.word);
    const id = text(raw.id), slug = text(raw.slug) || slugify(headword);
    if (!id || !headword || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || seen.has(id) || slugs.has(slug)) return null;
    const stage = STAGES.includes(raw.stage) ? raw.stage : 'forge';
    const canonApproved = Boolean(raw.canonApproval?.approvedAt) && Number.isInteger(raw.canonApproval?.revision) && raw.canonApproval.revision === raw.revision;
    if (stage === 'canon' && !canonApproved) {
      warnings.push('A public record with inconsistent Canon approval metadata was omitted.');
      return null;
    }
    seen.add(id); slugs.add(slug);
    return {
      id, slug, headword, visibility: 'approved_public', stage,
      permalink: text(raw.permalink) === `word/${slug}/` ? `word/${slug}/` : '',
      revision: Number.isInteger(raw.revision) ? raw.revision : null,
      publication: {approvedAt: date(raw.publication?.approvedAt), approvedRevision: Number.isInteger(raw.publication?.approvedRevision) ? raw.publication.approvedRevision : null, approvalMethod:text(raw.publication?.approvalMethod || raw.publication?.method)},
      definition: text(raw.definition || raw.currentDefinition || raw.current_definition),
      definitionStatus: DEFINITION_STATES.includes(raw.definitionStatus || raw.definition_status) ? (raw.definitionStatus || raw.definition_status) : (text(raw.definition) ? 'working_definition' : 'awaiting_definition'),
      review: normalizeReview(raw.review),
      editorialReview: {shortReason: text(raw.editorialReview?.shortReason)},
      collections: strings(raw.collections),
      analysis: raw.analysis?.kind === 'ai_hypothesis' ? {kind:'ai_hypothesis', formationProposal:text(raw.analysis.formationProposal),interpretationProposal:text(raw.analysis.interpretationProposal),distinctionQuestion:text(raw.analysis.distinctionQuestion),limitations:typeof raw.analysis.limitations==='string'?raw.analysis.limitations:strings(raw.analysis.limitations).join(' ')} : null,
      classification: CLASSIFICATIONS.includes(raw.classification) ? raw.classification : 'unclassified',
      preferredCapitalization: text(raw.preferredCapitalization || raw.preferred_capitalization),
      pronunciation: raw.pronunciationVerified === true || raw.pronunciation_verified === true ? text(raw.pronunciation) : '',
      ipa: raw.pronunciationVerified === true || raw.pronunciation_verified === true ? text(raw.ipa) : '',
      partOfSpeech: text(raw.partOfSpeech || raw.part_of_speech),
      formation: text(raw.formation || raw.formationType || raw.formation_type),
      variants: strings(raw.variants || raw.alternate_spellings), components: strings(raw.components || raw.roots),
      tags: strings(raw.tags), domains: strings(raw.domains || raw.semantic_domains),
      conceptualGap: text(raw.conceptualGap || raw.conceptual_gap),
      literalMeaning: text(raw.literalMeaning || raw.literal_meaning),
      figurativeMeaning: text(raw.figurativeMeaning || raw.figurative_meaning),
      examples: strings(raw.examples),
      senses: Array.isArray(raw.senses) ? raw.senses.filter(isApprovedPublic).map(s => ({id: text(s.id), definition: text(s.definition), label: text(s.label)})) : [],
      authorship: text(raw.authorship || raw.authorshipStatus || raw.authorship_status) || 'Origin undetermined',
      attribution: text(raw.attribution), evidence: EVIDENCE.includes(raw.evidence || raw.evidenceStrength) ? (raw.evidence || raw.evidenceStrength) : 'unknown',
      provenanceSummary: text(raw.provenanceSummary || raw.provenance_summary),
      originality: text(raw.originalityStatement || raw.originality_statement),
      earliestAppearance: date(raw.earliestAppearance || raw.earliest_appearance || raw.earliestVerifiedDate),
      importedAt: date(raw.importedAt || raw.imported_at), publishedAt: date(raw.publishedAt || raw.published_at || raw.publication?.approvedAt),
      modifiedAt: date(raw.modifiedAt || raw.updated_at),
      canonApprovedAt: canonApproved ? date(raw.canonApproval.approvedAt) : null,
      canonApproval: canonApproved ? {approvedAt: date(raw.canonApproval.approvedAt), revision: raw.canonApproval.revision} : null,
      witnesses: Array.isArray(raw.witnesses || raw.sources) ? (raw.witnesses || raw.sources).filter(isApprovedPublic).map(sourceRecord) : [],
      corpus: Array.isArray(raw.corpus) ? raw.corpus.filter(isApprovedPublic).map(sourceRecord) : [],
    };
  }).filter(Boolean);
  const ids = new Set(terms.map(t => t.id));
  const relations = payload.relations.filter(isApprovedPublic).map(r => ({
    id: text(r.id), from: text(r.from || r.source || r.sourceId || r.source_id || r.from_term_id),
    to: text(r.to || r.target || r.targetId || r.target_id || r.to_term_id),
    type: text(r.type || r.relation_type) || 'Related concept',
    evidence: EVIDENCE.includes(r.evidence || r.evidenceStrength) ? (r.evidence || r.evidenceStrength) : 'unknown',
    inferred: r.inferred === true || r.status === 'suggested' || r.status === 'inferred',
    explanation: text(r.explanation || r.publicExplanation || r.note),
  })).filter(r => ids.has(r.from) && ids.has(r.to) && r.from !== r.to);
  const versions = payload.versions.filter(isApprovedPublic).map(v => ({
    id: text(v.id), termId: text(v.termId || v.term_id), definition: text(v.definition),
    version: Number.isInteger(v.version || v.revision) ? (v.version || v.revision) : null,
    effectiveAt: date(v.effectiveAt || v.effective_at || v.created_at || v.date || v.approvedAt),
    note: text(v.note || v.changeSummary || v.change_summary),
    stage: STAGES.includes(v.stage) ? v.stage : null,
  })).filter(v => ids.has(v.termId) && v.definition);
  terms.forEach(term => normalizedTerms.add(term));
  const catalog = {schemaVersion: '1.0', terms, relations, versions, generatedAt: date(payload.generatedAt || payload.generated_at), publicationState: text(payload.publicationState), warnings: [...new Set(warnings)]};
  normalizedCatalogs.add(catalog);
  return catalog;
}
export function findPublicTerm(catalog, identifier) {
  return catalog.terms.find(term => term.id === identifier || term.slug === identifier) || null;
}
export function editDistance(a, b, limit = 2) {
  if (Math.abs(a.length - b.length) > limit) return limit + 1;
  let prior = Array.from({length: b.length + 1}, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const row = [i];
    for (let j = 1; j <= b.length; j++) row[j] = Math.min(row[j - 1] + 1, prior[j] + 1, prior[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    if (Math.min(...row) > limit) return limit + 1;
    prior = row;
  }
  return prior[b.length];
}
/** Search folds typography without making a punctuation-only query match everything. */
function searchText(value) {
  return fold(value).replace(/[’‘ʼʻ`´]/g, "'").replace(/[‐‑‒–—―−]/g, '-').replace(/\s+/g, ' ');
}
const compactKey = value => searchText(value).replace(/[^\p{L}\p{N}]/gu, '');
const alphabeticOrder = new Intl.Collator('en', {sensitivity:'base', numeric:true});
function searchField(field, label, value, weight) {
  const original = text(value);
  return original ? {field, label, text:original, folded:searchText(original), compact:compactKey(original), weight} : null;
}
function searchableRecord(term, connected = [], history = []) {
  const fields = [], add = (field, label, value, weight) => {
    const row = searchField(field, label, value, weight); if (row) fields.push(row);
  };
  add('headword', 'Word', term.headword, 180);
  for (const variant of term.variants) add('variant', 'Alternate spelling', variant, 170);
  add('definition', term.definitionStatus === 'inferred_definition' ? 'Provisional definition' : 'Definition', term.definition, 95);
  for (const component of term.components) add('component', 'Component', component, 100);
  for (const sense of term.senses) add('sense', sense.label ? `Sense: ${sense.label}` : 'Sense', sense.definition, 94);
  for (const domain of term.domains) add('domain', 'Semantic domain', domain, 92);
  for (const tag of term.tags) add('tag', 'Tag', tag, 90);
  add('formation', 'Formation', term.formation.replaceAll('_', ' '), 88);
  add('classification', 'Classification', term.classification.replaceAll('_', ' '), 86);
  for (const collection of term.collections) add('collection', 'Collection', collection, 84);
  for (const example of term.examples) add('example', 'Usage example', example, 82);
  for (const [field, label] of [['conceptualGap','Conceptual distinction'], ['literalMeaning','Literal meaning'], ['figurativeMeaning','Figurative meaning']]) add(field, label, term[field], 80);
  for (const source of term.witnesses) {
    for (const value of [source.label, source.summary, source.originalWording]) add('source', 'Approved source', value, 76);
  }
  for (const work of term.corpus) {
    for (const value of [work.label, work.summary, work.originalWording]) add('corpus', 'Approved literary use', value, 78);
  }
  add('provenance', 'Public provenance', term.provenanceSummary, 74);
  add('authorship', 'Authorship', term.authorship, 70);
  add('attribution', 'Attribution', term.attribution, 70);
  add('stage', 'Editorial stage', term.stage, 68);
  add('partOfSpeech', 'Part of speech', term.partOfSpeech, 67);
  add('pronunciation', 'Verified pronunciation', term.pronunciation, 66);
  add('ipa', 'Verified IPA', term.ipa, 66);
  add('id', 'Public record ID', term.id, 60);
  add('slug', 'Permanent word URL', term.slug, 61);
  for (const source of [...term.witnesses, ...term.corpus]) add('sourceDate', 'Recorded source date', source.sourceDate, 58);
  for (const {other, relation} of connected) {
    add('relationship', relation.inferred ? 'Proposed relation' : 'Related concept', other.headword, 72);
    for (const variant of other.variants) add('relationship', relation.inferred ? 'Proposed relation' : 'Related concept', variant, 71);
  }
  for (const version of history) {
    const details = [version.version === null ? '' : `version ${version.version}`, version.effectiveAt || ''].filter(Boolean);
    add('history', `Earlier public wording${details.length ? ` · ${details.join(' · ')}` : ''}`, version.definition, 48);
  }
  return {term, fields, forms:fields.filter(row => ['headword','variant'].includes(row.field))};
}
function matchesSearchFilters(term, filters) {
  return (!filters.stage || term.stage === filters.stage) &&
    (!filters.definitionState || (filters.definitionState === 'defined' ? hasWorkingDefinition(term) : !hasWorkingDefinition(term))) &&
    (!filters.collection || term.collections.includes(filters.collection)) &&
    (!filters.reviewState || term.review?.state === filters.reviewState) &&
    (!filters.reviewFlag || term.review?.flags.includes(filters.reviewFlag)) &&
    (!filters.definitionBasis || term.review?.definitionBasis === filters.definitionBasis) &&
    (!filters.classification || term.classification === filters.classification) &&
    (!filters.tag || term.tags.includes(filters.tag)) &&
    (!filters.domain || term.domains.includes(filters.domain)) && (!filters.formation || term.formation === filters.formation) &&
    (!filters.letter || (filters.letter === '#' ? !/^\p{L}/u.test(term.headword) : searchText(term.headword).startsWith(searchText(filters.letter))));
}
function makeQuery(value) {
  const q = searchText(text(value).slice(0, 200)), compact = compactKey(q);
  return {q, compact, tokens:q.match(/[\p{L}\p{N}]+/gu) || [], symbolsOnly:Boolean(q) && !compact};
}
function scoreSearchRecord(record, query) {
  const {q, compact, tokens, symbolsOnly} = query;
  if (!q) return {score:1, field:record.forms[0]};
  let best = null;
  const consider = (score, field) => {if (!best || score > best.score) best = {score, field};};
  for (const field of record.forms) {
    const variant = field.field === 'variant';
    if (field.folded === q) consider(variant ? 170 : 180, field);
    else if (!symbolsOnly && field.compact === compact) consider(variant ? 158 : 164, field);
    else if (field.folded.startsWith(q)) consider(variant ? 145 : 150, field);
    else if (field.folded.endsWith(q)) consider(variant ? 136 : 140, field);
    else if (field.folded.includes(q)) consider(variant ? 126 : 130, field);
    else if (!symbolsOnly && compact.length >= 2 && field.compact.includes(compact)) consider(variant ? 120 : 122, field);
  }
  // Punctuation alone is useful for finding expressive headwords, not every full stop in a source summary.
  if (symbolsOnly) return best;
  for (const field of record.fields) {
    if (field.field === 'headword' || field.field === 'variant') continue;
    if (field.folded.includes(q)) consider(field.weight + (field.folded === q ? 4 : 0), field);
    else if (tokens.length && tokens.every(token => field.folded.includes(token))) consider(field.weight - 3, field);
  }
  // A query can span a root and its definition, or a domain and its usage example.
  if (!best && tokens.length > 1 && tokens.every(token => record.fields.some(field => field.folded.includes(token)))) {
    const historicalToken = tokens.find(token => !record.fields.some(field => field.field !== 'history' && field.folded.includes(token)));
    const field = historicalToken ? record.fields.find(field => field.field === 'history' && field.folded.includes(historicalToken)) : record.fields.find(field => field.folded.includes(tokens[0]));
    consider(historicalToken ? 45 : 64, field);
  }
  if (!best && compact.length >= 4 && compact.length <= 64 && tokens.length === 1) {
    const limit = compact.length > 7 ? 2 : 1;
    for (const field of record.forms) {
      const distance = editDistance(compact, field.compact, limit);
      if (distance <= limit) consider((field.field === 'headword' ? 35 : 32) - distance - (field.folded === field.compact ? 0 : 1), field);
    }
  }
  return best;
}
function searchHit(record, scored, query) {
  const field = scored.field;
  const found = query.q ? field.folded.indexOf(query.q) : 0;
  const tokenAt = found < 0 && query.tokens.length ? field.folded.indexOf(query.tokens[0]) : found;
  const start = field.text.length > 280 ? Math.max(0, tokenAt - 60) : 0;
  const snippet = `${start ? '…' : ''}${field.text.slice(start, start + 278)}${start + 278 < field.text.length ? '…' : ''}`;
  return {term:record.term, score:scored.score, match:{field:field.field, label:field.label, text:snippet}};
}
/**
 * Build once per catalog load. Only the normalized, approved public projection is indexed;
 * Private fields and AI proposals are excluded. Approved older wording is searchable
 * only as an explicitly labeled historical match, never as the current definition.
 * Rebuild when replacing the catalog. Results carry the field that actually matched.
 */
export function createSearchIndex(input) {
  const catalog = normalizedCatalogs.has(input) ? input : normalizeCatalog(input);
  const connected = new Map(catalog.terms.map(term => [term.id, []])), byId = new Map(catalog.terms.map(term => [term.id, term]));
  const history = new Map(catalog.terms.map(term => [term.id, []]));
  const definitionKey = value => text(value).replace(/\s+/g, ' ').toLocaleLowerCase('en');
  const seenDefinitions = new Map(catalog.terms.map(term => [term.id, new Set([definitionKey(term.definition)])]));
  // Repeated version snapshots do not inflate lookup work or drown out current wording.
  const versions = [...catalog.versions].sort((a,b) => (b.effectiveAt || '').localeCompare(a.effectiveAt || '') || (b.version || 0) - (a.version || 0));
  for (const version of versions) {
    const seen = seenDefinitions.get(version.termId), key = definitionKey(version.definition);
    if (seen && key && !seen.has(key)) {seen.add(key);history.get(version.termId).push(version);}
  }
  for (const relation of catalog.relations) {
    connected.get(relation.from).push({other:byId.get(relation.to), relation});
    connected.get(relation.to).push({other:byId.get(relation.from), relation});
  }
  const records = catalog.terms.map(term => searchableRecord(term, connected.get(term.id), history.get(term.id)));
  return {
    size:records.length,
    search(value, {limit = 8, filters = {}} = {}) {
      const query = makeQuery(value), hits = [];
      for (const record of records) {
        if (!isApprovedPublic(record.term) || !matchesSearchFilters(record.term, filters)) continue;
        const scored = scoreSearchRecord(record, query);
        if (scored) hits.push(searchHit(record, scored, query));
      }
      hits.sort((a,b) => (query.q && filters.sort !== 'alphabetical' && filters.sort !== 'documented' ? b.score - a.score : 0) ||
        (filters.sort === 'documented' ? (b.term.earliestAppearance || '').localeCompare(a.term.earliestAppearance || '') : 0) ||
        alphabeticOrder.compare(a.term.headword, b.term.headword) || a.term.id.localeCompare(b.term.id));
      const count = limit === Infinity ? hits.length : Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : 8;
      return hits.slice(0, count);
    },
  };
}
export function searchScore(term, query) {
  const safe = normalizedTerms.has(term) ? term : normalizeCatalog({terms:[term],relations:[],versions:[]}).terms[0];
  return safe ? scoreSearchRecord(searchableRecord(safe), makeQuery(query))?.score || 0 : 0;
}
export function searchTerms(catalog, filters = {}) {
  if (!searchIndexes.has(catalog)) searchIndexes.set(catalog, createSearchIndex(catalog));
  return searchIndexes.get(catalog).search(filters.q, {limit:Infinity, filters}).map(hit => hit.term);
}
export function featuredTerms(catalog, limit = 3) {
  return catalog.terms.filter(hasWorkingDefinition).sort((a, b) =>
    (b.stage === 'lexicon') - (a.stage === 'lexicon') || b.domains.length - a.domains.length || a.headword.localeCompare(b.headword)).slice(0, limit);
}
export function hasWorkingDefinition(term) {
  return Boolean(text(term?.definition)) && term?.definitionStatus !== 'awaiting_definition' && !/^definition pending/i.test(term.definition);
}
export function validatePublicTransport(request) {
  const serialized=JSON.stringify(request,null,2);
  if (serialized.length>60000 || JSON.stringify({change_json:serialized,commit:false}).length>65535 || new TextEncoder().encode(serialized).length>150000)
    throw new Error('This public change exceeds the GitHub input limit. Reduce the submitted text or batch selection.');
  return request;
}
/** Builds a public-only request. GitHub Actions remains the authorization boundary. */
export function preparePublicChange(input, term = null) {
  const action = input.action;
  if (!['create','update','stage','withdraw','restore'].includes(action)) throw new Error('Choose a supported public editorial action.');
  const headword = text(input.headword || term?.headword);
  if (!headword || headword.length > 200) throw new Error('A headword of at most 200 characters is required.');
  const expectedRevision = action === 'create' ? 0 : Number(input.expectedRevision);
  if (action !== 'create' && (!term?.id || !Number.isInteger(expectedRevision) || expectedRevision < 1)) throw new Error('Reload a current public record or select a documented public history revision.');
  const request = {action, expectedRevision};
  if (action === 'create') {
    request.slug = text(input.slug) || slugify(headword);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(request.slug)) throw new Error('The permanent slug must use lowercase letters, numbers, and single hyphens.');
  } else request.id = term.id;
  const publicNote = text(input.publicNote);
  if (publicNote.length > 2000) throw new Error('Public editorial notes may contain at most 2000 characters.');
  if (publicNote) request.publicNote = publicNote;
  const confirmation = `${action === 'withdraw' ? 'WITHDRAW' : 'PUBLISH'} ${headword}`;
  if (input.confirmPublication !== confirmation) throw new Error(`Type “${confirmation}” exactly to confirm your public intention.`);
  if (action === 'withdraw') return validatePublicTransport(request);
  request.confirmPublication = confirmation;
  if (action === 'restore') {
    const revision = Number(input.restoreRevision);
    if (!Number.isInteger(revision) || revision < 1 || revision > expectedRevision) throw new Error('Choose an available earlier public snapshot revision.');
    request.restoreRevision = revision;
  } else {
    const stage = input.stage;
    if (!STAGES.includes(stage)) throw new Error('Choose Forge, Lexicon, or an explicitly confirmed Canon decision.');
    if (stage !== 'forge' && !hasWorkingDefinition(action === 'stage' ? term : input)) throw new Error('Develop a working definition before moving this entry to Lexicon or Canon.');
    if (action === 'stage') request.changes = {stage};
    else {
      const fields = {headword, stage, definition:text(input.definition), classification:text(input.classification) || (text(input.definition) ? 'coinage_candidate' : 'term_seed'), definitionStatus:text(input.definitionStatus) || (text(input.definition) ? 'working_definition' : 'awaiting_definition'), formation:text(input.formation), provenanceSummary:text(input.provenanceSummary)};
      if (!CLASSIFICATIONS.includes(fields.classification) || !DEFINITION_STATES.includes(fields.definitionStatus)) throw new Error('Choose a supported classification and definition status.');
      if (fields.definition.length > 20000 || fields.provenanceSummary.length > 3000) throw new Error('Definition or public provenance summary exceeds the supported length.');
      for (const field of ['roots','domains','variants','collections',...(Object.hasOwn(input,'tags')?['tags']:[])]) {
        let values;
        try {values = typeof input[field] === 'string' ? JSON.parse(input[field] || '[]') : input[field] || [];}
        catch {throw new Error(`${labelField(field)} must be a JSON array of text values.`);}
        if (!Array.isArray(values) || values.length > 100 || values.some(value => typeof value !== 'string' || !value.trim() || value.length > 500)) throw new Error(`${labelField(field)} must contain up to 100 nonempty text values.`);
        fields[field] = values.map(value => value.trim());
      }
      if (Object.hasOwn(input,'review')) {
        let review;
        try {review = typeof input.review === 'string' ? JSON.parse(input.review) : input.review;}
        catch {throw new Error('Review must be a public review object.');}
        if (!review || typeof review !== 'object' || Array.isArray(review) || Object.keys(review).sort().join(',') !== 'definitionBasis,flags,note,state' ||
          !REVIEW_STATES.includes(review.state) || !DEFINITION_BASES.includes(review.definitionBasis) || !Array.isArray(review.flags) || review.flags.length>REVIEW_FLAGS.length ||
          review.flags.some(flag=>!REVIEW_FLAGS.includes(flag)) || typeof review.note!=='string' || review.note.length>2000) throw new Error('Review contains unsupported fields, states, flags, or a nonpublic note.');
        fields.review = normalizeReview(review);
      }
      request.changes = action === 'create' ? fields : Object.fromEntries(Object.entries(fields).filter(([key,value]) => JSON.stringify(value) !== JSON.stringify(key === 'roots' ? term.components : term[key])));
      if (input.rejectAnalysis === true || input.rejectAnalysis === 'on') request.changes.analysis = null;
      if (!Object.keys(request.changes).length) throw new Error('No content changes are present. Edit a field before preparing an update.');
    }
  }
  if ((request.changes?.stage || term?.stage) === 'canon') {
    if (input.canonConfirmation !== `APPROVE CANON ${headword}`) throw new Error('Every Canon decision requires its separate exact authorial confirmation.');
    request.canonConfirmation = input.canonConfirmation;
  }
  return validatePublicTransport(request);
}
function labelField(field) { return field[0].toUpperCase() + field.slice(1); }
export function relatedTo(catalog, id) {
  return catalog.relations.filter(r => r.from === id || r.to === id).map(relation => ({relation, term: catalog.terms.find(t => t.id === (relation.from === id ? relation.to : relation.from))}));
}
export function publicVersions(catalog, termId) {
  return catalog.versions.filter(v => v.termId === termId).sort((a, b) => (a.effectiveAt || '').localeCompare(b.effectiveAt || ''));
}
export function versionAt(catalog, termId, at) {
  const cutoff = date(at); if (!cutoff) return null;
  return publicVersions(catalog, termId).filter(v => v.effectiveAt?.length >= 10 && v.effectiveAt.slice(0, 10) <= cutoff.slice(0, 10)).at(-1) || null;
}
export function publicJsonExport(catalog) {
  const sourceExport = source => ({visibility:'approved_public', id:source.id, label:source.label,
    publicSummary:source.summary, approvedExcerpt:source.originalWording, sourceDate:source.sourceDate,
    evidence:source.evidence, url:source.url});
  return {
    schemaVersion: 1,
    terms: catalog.terms.map(term => ({...term, review:normalizeReview(term.review), roots: term.components, earliestVerifiedDate: term.earliestAppearance, evidenceStrength: term.evidence,
      witnesses:term.witnesses.map(sourceExport), corpus:term.corpus.map(sourceExport)})),
    relations: catalog.relations.map(relation => ({visibility:'approved_public', source:relation.from, target:relation.to, type:relation.type, status:relation.inferred?'inferred':'confirmed', publicExplanation:relation.explanation})),
    versions: catalog.versions.map(version => ({visibility:'approved_public', termId:version.termId, version:version.version, definition:version.definition, date:version.effectiveAt, publicNote:version.note})),
    generatedAt: catalog.generatedAt,
  };
}
export function csvExport(catalog) {
  const cell = value => {
    let v = String(value ?? '');
    // Spreadsheets must not interpret an exported term or definition as a formula.
    if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
    return `"${v.replaceAll('"', '""')}"`;
  };
  const fields = ['id','slug','headword','revision','stage','definitionStatus','classification','definition','formation','authorship','evidence','earliestAppearance','publishedAt','reviewState','definitionBasis','reviewFlags','publicReviewNote','tags','collections','domains','variants','components'];
  return '\uFEFF' + [fields, ...catalog.terms.map(t => {
    const row={...t,reviewState:t.review?.state||'open',definitionBasis:t.review?.definitionBasis||'unknown',reviewFlags:t.review?.flags||[],publicReviewNote:t.review?.note||''};
    return fields.map(key=>Array.isArray(row[key])?JSON.stringify(row[key]):row[key]);
  })].map(row => row.map(cell).join(',')).join('\r\n');
}
export function definitionDiff(previous, current) {
  const oldWords = text(previous).split(/\s+/), nextWords = text(current).split(/\s+/);
  let prefix = 0, suffix = 0;
  while (prefix < oldWords.length && prefix < nextWords.length && oldWords[prefix] === nextWords[prefix]) prefix++;
  while (suffix < oldWords.length - prefix && suffix < nextWords.length - prefix && oldWords.at(-1 - suffix) === nextWords.at(-1 - suffix)) suffix++;
  return {
    unchangedStart: nextWords.slice(0, prefix).join(' '),
    removed: oldWords.slice(prefix, oldWords.length - suffix).join(' '),
    added: nextWords.slice(prefix, nextWords.length - suffix).join(' '),
    unchangedEnd: suffix ? nextWords.slice(-suffix).join(' ') : '',
  };
}
