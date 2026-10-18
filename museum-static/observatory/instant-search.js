import {createSearchIndex} from './model.js';

const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
const validPrefix = value => String(value || 'global').replace(/[^a-zA-Z0-9_-]/g, '') || 'global';
const preview = value => String(value || '').replace(/\s+/g, ' ').trim().slice(0, 220);
const editingTarget = target => Boolean(target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]'));

/** The same public lookup works in the application shell and on permanent word pages. */
export function instantSearchMarkup({base = './', idPrefix = 'global'} = {}) {
  const id = validPrefix(idPrefix);
  return `<form class="instant-search" data-instant-search role="search" aria-label="Public archive lookup" action="${escapeHtml(base)}" autocomplete="off">
    <div class="lookup-caption"><label for="${id}-query">Find a word. Follow a thought.</label><span data-search-count>Approved public archive</span></div>
    <div class="lookup-input-wrap">
      <svg class="lookup-icon" viewBox="0 0 24 24" width="21" height="21" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>
      <input id="${id}-query" data-search-input name="q" type="search" maxlength="160" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="${id}-options" aria-describedby="${id}-hint" enterkeyhint="search" placeholder="A word, a meaning, a root…" spellcheck="false">
      <button class="lookup-clear" data-search-clear type="button" aria-label="Clear search" hidden><span aria-hidden="true">×</span></button>
      <kbd class="lookup-key" aria-hidden="true">/</kbd>
      <button class="lookup-submit" type="submit" aria-label="Search the full public archive"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.6" aria-hidden="true"><path d="M4 12h15m-6-6 6 6-6 6"/></svg></button>
    </div>
    <span id="${id}-hint" class="visually-hidden">Search all public words, meanings, spelling variants, roots, tags, sources, and connected ideas. Use the arrow keys to choose a result, then Enter to open it.</span>
    <div class="lookup-popup" data-search-popup hidden>
      <p class="lookup-result-heading" data-search-heading>Words to begin with</p>
      <div id="${id}-options" data-search-options class="lookup-options" role="listbox" aria-label="Matching public entries"></div>
      <p class="lookup-message" data-search-message hidden></p>
      <a class="lookup-all" data-search-all href="${escapeHtml(base)}#archive"><span data-search-all-label>Browse the whole archive</span><span aria-hidden="true">→</span></a>
    </div>
    <span class="visually-hidden" data-search-status role="status" aria-live="polite" aria-atomic="true"></span>
  </form>`;
}

/** Matching uses the downloaded public catalog; refresh never replaces the input node. */
export function mountInstantSearch(root, {
  getCatalog,
  status = 'ready',
  onNavigate,
  onSearchAll,
  onQueryChange,
  base = './',
  initialQuery = '',
} = {}) {
  const form = root.matches?.('[data-instant-search]') ? root : root.querySelector('[data-instant-search]');
  if (!form) throw new Error('Instant search needs its search form.');
  const input = form.querySelector('[data-search-input]');
  const popup = form.querySelector('[data-search-popup]');
  const options = form.querySelector('[data-search-options]');
  const clear = form.querySelector('[data-search-clear]');
  const heading = form.querySelector('[data-search-heading]');
  const message = form.querySelector('[data-search-message]');
  const allLink = form.querySelector('[data-search-all]');
  const allLabel = form.querySelector('[data-search-all-label]');
  const count = form.querySelector('[data-search-count]');
  const announcement = form.querySelector('[data-search-status]');
  const document = form.ownerDocument;
  const window = document.defaultView;
  let snapshot = null, index = null, indexError = false, hits = [], active = -1, composing = false, destroyed = false;
  let announcementTimer, pendingPointer = false, lastAnnouncement = '';
  const removers = [];
  const listen = (element, name, handler, settings) => {
    element.addEventListener(name, handler, settings);
    removers.push(() => element.removeEventListener(name, handler, settings));
  };
  const getStatus = () => {
    try {
      const value = typeof status === 'function' ? status() : status;
      if (value === 'loading') return 'loading';
      if (value === 'unavailable' || value === 'error' || value === 'failed' || indexError) return 'unavailable';
      return index ? 'ready' : 'loading';
    } catch { return 'unavailable'; }
  };
  function announce(text) {
    window.clearTimeout(announcementTimer);
    announcementTimer = window.setTimeout(() => {
      if (destroyed || text === lastAnnouncement) return;
      announcement.textContent = text;
      lastAnnouncement = text;
    }, 220);
  }
  function close() {
    window.clearTimeout(announcementTimer);
    popup.hidden = true;
    input.setAttribute('aria-expanded', 'false');
    input.removeAttribute('aria-activedescendant');
    active = -1;
  }
  function activate(position) {
    const anchors = [...options.querySelectorAll('[data-search-option]')];
    active = position;
    anchors.forEach((anchor, offset) => {
      const selected = offset === active;
      anchor.setAttribute('aria-selected', String(selected));
      if (selected) {
        input.setAttribute('aria-activedescendant', anchor.id);
        anchor.scrollIntoView?.({block:'nearest', behavior:'instant'});
      }
    });
    if (position < 0) input.removeAttribute('aria-activedescendant');
  }
  function fullResults() {
    const query = input.value.trim();
    close();
    if (typeof onSearchAll === 'function') onSearchAll(query);
    else window.location.assign(`${base}#archive${query ? `?q=${encodeURIComponent(query)}` : ''}`);
  }
  function openResult(anchor) {
    const hit = hits[Number(anchor.dataset.searchOption)];
    close();
    if (typeof onNavigate === 'function') onNavigate(anchor.getAttribute('href'), {term:hit?.term, query:input.value.trim()});
    else window.location.assign(anchor.href);
  }
  function render({open = true} = {}) {
    if (destroyed || composing) return;
    clear.hidden = !input.value;
    const query = input.value.trim();
    const state = getStatus();
    options.replaceChildren();
    hits = [];
    activate(-1);
    message.hidden = true;
    allLink.href = `${base}#archive${query ? `?q=${encodeURIComponent(query)}` : ''}`;
    allLabel.textContent = query ? `See all results for “${query}”` : 'Browse the whole archive';
    if (state !== 'ready') {
      heading.textContent = state === 'loading' ? 'Opening the archive…' : 'Search is temporarily unavailable';
      message.textContent = state === 'loading'
        ? 'The approved public catalog is loading. Keep your thought here; results will follow.'
        : 'The public catalog could not be loaded. Browse the archive to try again.';
      message.hidden = false;
      announce(state === 'loading' ? 'Public archive loading.' : 'Public archive unavailable.');
    } else {
      hits = index.search(query, {limit:query ? 8 : 6});
      heading.textContent = query ? 'Matching entries' : 'Words to begin with';
      if (!hits.length) {
        message.textContent = query ? 'No matching entry yet. Try part of the word, a root, or an idea from its meaning.' : 'No approved public entries are available yet.';
        message.hidden = false;
      }
      hits.forEach((hit, position) => {
        const term = hit.term;
        const anchor = document.createElement('a');
        anchor.className = 'lookup-option';
        anchor.id = `${options.id}-${position}`;
        anchor.href = `${base}word/${encodeURIComponent(term.slug)}/`;
        anchor.setAttribute('role', 'option');
        anchor.setAttribute('aria-selected', 'false');
        anchor.setAttribute('tabindex', '-1');
        anchor.dataset.searchOption = String(position);
        const title = document.createElement('span');
        title.className = 'lookup-word';
        title.textContent = term.headword;
        const stage = document.createElement('span');
        stage.className = 'lookup-stage';
        const stateLabel = term.stage === 'canon' ? 'Canon' : term.stage === 'lexicon' ? 'Lexicon' : 'Forge';
        const qualification = [term.classification === 'ai_suggestion' ? 'AI suggestion' : '', term.definitionStatus === 'inferred_definition' ? 'Provisional interpretation' : ''].filter(Boolean);
        stage.textContent = [stateLabel, ...qualification].join(' · ');
        const definition = document.createElement('span');
        definition.className = 'lookup-definition';
        definition.textContent = term.definitionStatus === 'awaiting_definition' ? 'Meaning awaiting the author’s definition.' : preview(term.definition) || 'Meaning awaiting the author’s definition.';
        anchor.append(title, stage, definition);
        const field = hit.match?.field;
        if (query && field && field !== 'headword') {
          const match = document.createElement('span');
          match.className = 'lookup-match';
          const label = hit.match?.label || 'Related text';
          match.textContent = `${label}${hit.match?.text && !['definition', 'sense'].includes(field) ? ` · ${preview(hit.match.text).slice(0, 90)}` : ''}`;
          anchor.append(match);
        }
        options.append(anchor);
      });
      const exact=hits[0]?.score>=158 && ['headword','variant'].includes(hits[0]?.match?.field);
      announce(query ? hits.length ? `${hits.length} matching ${hits.length === 1 ? 'entry' : 'entries'} shown. ${exact?`Enter opens ${hits[0].term.headword}. Use See all results to browse the matches.`:'Use the arrow keys to choose, or Enter to see all results.'}` : 'No matching public entries.' : `${hits.length} public entries to begin with. Type a word or idea to search.`);
    }
    if (open) {
      popup.hidden = false;
      input.setAttribute('aria-expanded', 'true');
    }
  }
  function refresh() {
    if (destroyed) return;
    let next;
    try { next = typeof getCatalog === 'function' ? getCatalog() : getCatalog; }
    catch { indexError = true; }
    if (next && (next !== snapshot || indexError)) {
      try { index = createSearchIndex(next); snapshot = next; indexError = false; }
      catch { index = null; indexError = true; }
    }
    const total = index?.size || 0;
    count.textContent = getStatus() === 'ready' ? `${total} public ${total === 1 ? 'entry' : 'entries'}` : getStatus() === 'unavailable' ? 'Catalog unavailable' : 'Opening the archive…';
    clear.hidden = !input.value;
    if (!popup.hidden || document.activeElement === input) render();
  }
  listen(input, 'focus', () => render());
  const queryChanged=()=>{if(typeof onQueryChange==='function')onQueryChange(input.value);};
  listen(input, 'input', event => { if (!composing && !event.isComposing) {queryChanged();render();} });
  listen(input, 'search', () => { if (!composing) input.value ? render() : close(); });
  listen(input, 'compositionstart', () => { composing = true; });
  listen(input, 'compositionend', () => { composing = false; queryChanged();render(); });
  listen(input, 'keydown', event => {
    if (composing || event.isComposing || event.keyCode === 229) return;
    if (event.key === 'Escape') { event.preventDefault(); close(); return; }
    if (event.key === 'Tab') { close(); return; }
    if (event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      if (popup.hidden) render();
      if (!hits.length) return;
      activate(event.key === 'ArrowDown' ? (active + 1) % hits.length : active <= 0 ? hits.length - 1 : active - 1);
    } else if (event.key === 'Enter' && !popup.hidden && (active >= 0 || (input.value.trim() && hits[0]?.score >= 158 && ['headword','variant'].includes(hits[0]?.match?.field)))) {
      event.preventDefault();
      const anchor = options.querySelectorAll('[data-search-option]')[active >= 0 ? active : 0];
      if (anchor) openResult(anchor);
    }
  });
  listen(form, 'submit', event => { event.preventDefault(); if (!composing) fullResults(); });
  listen(clear, 'click', () => { input.value = ''; queryChanged();input.focus({preventScroll:true}); clear.hidden = true; close(); announce('Search cleared.'); });
  listen(options, 'pointerdown', () => { pendingPointer = true; });
  listen(options, 'click', event => {
    pendingPointer = false;
    const anchor = event.target.closest('[data-search-option]');
    if (!anchor || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof onNavigate === 'function') { event.preventDefault(); event.stopPropagation(); openResult(anchor); }
    else close();
  });
  listen(allLink, 'click', event => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (typeof onSearchAll === 'function') { event.preventDefault(); event.stopPropagation(); fullResults(); }
    else close();
  });
  listen(document, 'pointerdown', event => { if (!form.contains(event.target)) close(); });
  listen(document, 'click', event => { if (!form.contains(event.target)) close(); });
  listen(document, 'pointerup', () => { pendingPointer = false; });
  listen(form, 'focusout', event => {
    if (!form.contains(event.relatedTarget) && !pendingPointer) close();
  });
  listen(document, 'keydown', event => {
    if (event.defaultPrevented || event.isComposing || event.keyCode === 229 || editingTarget(event.target)) return;
    const slash = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey && !event.shiftKey;
    const commandK = event.key.toLowerCase() === 'k' && (event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey;
    if (!slash && !commandK) return;
    event.preventDefault();
    input.focus({preventScroll:true});
    render();
  });
  if (initialQuery) input.value = String(initialQuery).slice(0, 160);
  refresh();
  return {
    refresh,
    setQuery(value) {if(!destroyed){input.value=String(value||'').slice(0,160);clear.hidden=!input.value;if(!popup.hidden)render();}},
    focus() { if (!destroyed) { input.focus({preventScroll:true}); render(); } },
    destroy() { destroyed = true; window.clearTimeout(announcementTimer); removers.forEach(remove => remove()); close(); },
  };
}
