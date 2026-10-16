/** Pure public-catalog functions. Public authorization must happen on the server. */
export const STAGES = ['forge', 'lexicon', 'canon'];
const EVIDENCE = ['verified', 'supported', 'reported', 'hypothetical', 'unknown'];
const text = value => typeof value === 'string' ? value.trim() : '';
const strings = value => Array.isArray(value) ? value.map(v => typeof v === 'string' ? v : text(v?.label || v?.name || v?.word)).filter(Boolean) : [];
export function fold(value) {
  return text(value).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('en');
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
      definitionStatus: text(raw.definitionStatus || raw.definition_status) || (text(raw.definition) ? 'working_definition' : 'awaiting_definition'),
      editorialReview: {shortReason: text(raw.editorialReview?.shortReason)},
      collections: strings(raw.collections),
      analysis: raw.analysis?.kind === 'ai_hypothesis' ? {kind:'ai_hypothesis', formationProposal:text(raw.analysis.formationProposal),interpretationProposal:text(raw.analysis.interpretationProposal),distinctionQuestion:text(raw.analysis.distinctionQuestion),limitations:typeof raw.analysis.limitations==='string'?raw.analysis.limitations:strings(raw.analysis.limitations).join(' ')} : null,
      classification: text(raw.classification) || 'Unclassified',
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
  return {schemaVersion: '1.0', terms, relations, versions, generatedAt: date(payload.generatedAt || payload.generated_at), publicationState: text(payload.publicationState), warnings: [...new Set(warnings)]};
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
export function searchScore(term, query) {
  const q = fold(query); if (!q) return 1;
  const head = fold(term.headword), forms = term.variants.map(fold);
  if (head === q) return 120;
  if (forms.includes(q)) return 110;
  if (head.startsWith(q)) return 95;
  if (head.endsWith(q)) return 90;
  if (head.includes(q) || forms.some(f => f.includes(q))) return 85;
  const haystack = fold([term.definition, term.formation, term.classification, ...term.components, ...term.domains, ...term.tags, ...term.senses.map(s => s.definition)].join(' '));
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.every(token => haystack.includes(token) || head.includes(token))) return 70;
  if (q.length >= 4 && q.length <= 64 && !q.includes(' ')) {
    const limit = q.length > 7 ? 2 : 1;
    const d = Math.min(...[head, ...forms].map(f => editDistance(q, f, limit)));
    if (d <= limit) return 35 - d;
  }
  return 0;
}
export function searchTerms(catalog, filters = {}) {
  const q = text(filters.q);
  const matches = catalog.terms.filter(t => (!filters.stage || t.stage === filters.stage) &&
    (!filters.definitionState || (filters.definitionState === 'defined' ? hasWorkingDefinition(t) : !hasWorkingDefinition(t))) &&
    (!filters.collection || t.collections.includes(filters.collection)) &&
    (!filters.domain || t.domains.includes(filters.domain)) && (!filters.formation || t.formation === filters.formation) &&
    (!filters.letter || fold(t.headword).startsWith(fold(filters.letter))))
    .map(term => ({term, score: searchScore(term, q)})).filter(row => row.score > 0);
  matches.sort((a, b) => (q && filters.sort !== 'alphabetical' ? b.score - a.score : 0) || a.term.headword.localeCompare(b.term.headword));
  if (filters.sort === 'documented') matches.sort((a, b) => (b.term.earliestAppearance || '').localeCompare(a.term.earliestAppearance || ''));
  return matches.map(row => row.term);
}
export function featuredTerms(catalog, limit = 3) {
  return catalog.terms.filter(hasWorkingDefinition).sort((a, b) =>
    (b.stage === 'lexicon') - (a.stage === 'lexicon') || b.domains.length - a.domains.length || a.headword.localeCompare(b.headword)).slice(0, limit);
}
export function hasWorkingDefinition(term) {
  return Boolean(text(term?.definition)) && term?.definitionStatus !== 'awaiting_definition' && !/^definition pending/i.test(term.definition);
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
  if (action === 'withdraw') return request;
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
      if (fields.definition.length > 20000 || fields.provenanceSummary.length > 3000) throw new Error('Definition or public provenance summary exceeds the supported length.');
      for (const field of ['roots','domains','variants','collections']) {
        let values;
        try {values = typeof input[field] === 'string' ? JSON.parse(input[field] || '[]') : input[field] || [];}
        catch {throw new Error(`${labelField(field)} must be a JSON array of text values.`);}
        if (!Array.isArray(values) || values.length > 100 || values.some(value => typeof value !== 'string' || !value.trim() || value.length > 500)) throw new Error(`${labelField(field)} must contain up to 100 nonempty text values.`);
        fields[field] = values.map(value => value.trim());
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
  return request;
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
    terms: catalog.terms.map(term => ({...term, roots: term.components, earliestVerifiedDate: term.earliestAppearance, evidenceStrength: term.evidence,
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
  const fields = ['id','slug','headword','stage','definitionStatus','classification','definition','formation','authorship','evidence','earliestAppearance','publishedAt'];
  return '\uFEFF' + [fields, ...catalog.terms.map(t => fields.map(key => t[key]))].map(row => row.map(cell).join(',')).join('\r\n');
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
