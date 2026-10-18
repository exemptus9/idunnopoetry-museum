# Find a word without finding the search page

The [Observatory](https://exemptus9.github.io/idunnopoetry-museum/observatory/) keeps a visible lookup field above the content. It remains available while scrolling and appears on every permanent word page.

Type a word, spelling variant, component, meaning, tag, or phrase from an approved public source. Results show the current definition and the field that matched. Diacritics, apostrophe styles, hyphen/space variants and bounded spelling mistakes are supported. A punctuation-only query looks for that punctuation in word forms rather than matching every sentence in the archive.

Only the approved public projection is searched. Private sources, private senses and unaccepted AI analysis do not enter the index. Earlier approved public wording is searchable with an **Earlier public wording** label; the preview continues to display the current definition. AI-origin entries and provisional definitions keep their labels. Search does not approve definitions or Canon.

## Quick paths

- Select a result to open its complete entry.
- For an exact word or variant, **Enter** opens the entry directly.
- Use **Up/Down**, then **Enter**, to choose another result.
- Use **See all results** or submit an idea query to browse the matches.
- **Escape** closes suggestions; **Tab** continues normal keyboard navigation.
- **/** or **Ctrl/Cmd K** focuses lookup when another text editor is not active.
- **Clear** starts over. No search history is written to local storage.

The home page puts definitions and A–Z browsing before the laboratory and constellation exhibits. Alphabet browsing is also visible in the archive, including a **#** group for initial numbers and symbols.

On the archive page, the primary lookup filters the directory as you type while retaining selected stage, domain and other filters. Typing updates the existing result region and replaces the current search URL; it preserves the input, caret and keyboard focus and does not add a browser-history entry per character. Opening a result adds one navigation step. **Browse all** explicitly resets the text query and filters. Advanced filtering, sorting and a scoped text field remain in the Filter & sort drawer.

Permanent HTML pages include a usable search form before JavaScript loads. The browser downloads the approved catalog once per document, then performs matching locally. Loading, an empty public collection, no matches and download failure have distinct states. Catalog arrival preserves any text already entered. There is no paid search service or query-specific API request.

## Implementation and checks

- `model.js`: a reusable index of approved current fields, source context, relations and clearly qualified public historical wording.
- `instant-search.js` / `search.css`: shared accessible combobox, keyboard controls and mobile-sized suggestion panel.
- `static-search.js`: bounded, single-download bootstrap for permanent pages.
- `app.js`: persistent lookup, reader-first home and archive updates that preserve focus.
- `build_lexical_publication.py`: search on every generated permanent page, alongside existing canonical/social metadata.

Regression coverage is in `test_lexical_model.mjs`, `test_lexical_search_dom.mjs`, `test_lexical_publication.py` and the existing application, editor and privacy suites. The permanent-page checks cover every actual public word page. Actual device layout, native browser behavior and screen-reader operation still require browser/device QA; DOM tests do not certify them.
