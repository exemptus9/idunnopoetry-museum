# Using the Language Laboratory

Open the [Language Laboratory](https://exemptus9.github.io/idunnopoetry-museum/observatory/#laboratory).
The wordsmith's bench constructs possible blends from two or three source words,
shows which fragments contributed, and offers a provisional reading. It runs on
your device without an account, AI credits, or a paid language service.

## Make and inspect a blend

1. Choose **Two words** or **Three words · Portmantrés experiment**. Enter your
   sources, or choose a **Shuffle territory** and select **Surprise me**.
2. Check **Keep when shuffling** beside a source to retain it while changing the
   others. If all sources are pinned, uncheck one before shuffling. Separate decks
   for each territory and source count cycle through curated sets before
   repeating a complete set. Pinned combinations can alter the final selection;
   this is not a promise of unique words forever.
3. Open **What does it mean here?** to supply an intended meaning, especially for
   an unfamiliar source. **Steer the meaning** optionally states what the new
   word should express. **Reverse the ingredients** changes their order.
4. Select **Find the words between**. Inspect the spelling, fragments,
   construction method, and reading together. A pleasing spelling does not
   establish a useful meaning.
5. Choose **Copy** to take an experiment elsewhere, or **Keep** for this browser's
   specimen shelf. These actions never create a public archive entry.

The engine ranks literal shared-letter joins and clipped fragments. Every source
must contribute distinct letters; simply joining complete words is not offered
as a blend. A three-source result earns **Portmantrés candidate** only with two
literal overlaps and a distinct contribution from all three sources. Other
three-source constructions remain clipped or mixed blends. This spelling
criterion does not authenticate linguistic history.

Readings use supplied glosses, an available public term definition, or the
curated concept bank. Unknown meanings remain questions. The rule-based
interpretation and spelling heuristic do not test originality, verify
pronunciation, search dictionaries, prove etymology, or call a live AI model.
No result becomes an accepted definition or Canon automatically.

## Local shelf and offline limits

Generation and shuffling make no network calls of their own. Once the page and
its scripts have loaded, the engine works without a remote generation service.
There is no installed offline cache or service worker: opening or reloading the
site without a connection is not guaranteed. Public catalog loading and GitHub
publication still require access to their services.

Viewing or generating does not save an experiment. **Keep** explicitly stores up
to 12 specimens in this browser's local storage; keeping the same spelling again
replaces that item. **Release it** removes an item, and **Empty this shelf** clears
the device shelf. Storage may be unavailable or cleared. Copy important work
somewhere durable: the shelf is not synchronized, encrypted private archival
storage, a backup, or a publication queue.

To publish a chosen experiment, copy it and use
[Capture & edit](https://exemptus9.github.io/idunnopoetry-museum/observatory/#author),
then follow the [owner publication steps](lexical-publication.md). Retain its
experimental meaning and uncertain provenance. Laboratory activity grants
neither publication authority nor Canon approval.

## Other drawers and verification

The specimen drawer explains blending, compounding, derivation, back-formation,
and semantic extension using established examples, separate from the author's
vocabulary. The optional road scene starts only on request, can pause or reset,
and counts simulated distance at 60 mph. Reduced-motion preferences suppress
animation while distance can still count. The screen-name drawer is a local
pattern joke; it creates no accounts.

The interface is in
[`laboratory.js`](../museum-static/observatory/laboratory.js), construction and
shuffle logic in [`blend-engine.js`](../museum-static/observatory/blend-engine.js),
and styling in [`atelier.css`](../museum-static/observatory/atelier.css). Existing
checks are [`test_lexical_blends.mjs`](../scripts/test_lexical_blends.mjs) and
[`test_lexical_lab_dom.mjs`](../scripts/test_lexical_lab_dom.mjs). DOM checks execute
real interface logic; they do not establish real-device layout, complete
screen-reader behavior, or full WCAG conformance.
