# The Lexical Observatory

Modern augmentation for the IDunnoPoetry → Brandon WordSmith → RhymeMosaic continuity project.

## Model

- **Forge** — every worthwhile recorded coinage, including provisional and unresolved lexical seeds.
- **Lexicon** — terms stable enough to function as conceptual tools.
- **Canon** — terms that earn durable status through repeated use, generativity, or independent transmission.

The app deliberately separates **lexical maturity** from **Continuity workflow / epistemic state**.

Each term can preserve:

- originating intent / problem / question
- conceptual role and birth condition
- word-first vs idea-first emergence
- epistemic type and confidence
- open questions and next development step
- definition versions and event history
- roots / parent forms
- source witnesses and external attestations
- conceptual relations and derivatives
- transmission distance
- provenance status

The guiding Continuity principle is **Capture now. Understand later.** Incomplete terms are allowed into the Forge without pretending their definitions or provenance are settled.

## Deployment

This directory is intentionally static and portable:

- `index.html`
- `observatory.css`
- `data.js`
- `app.js`

No build step or external JavaScript dependency is required.

The Admin view is a safe local MVP: browser edits persist in localStorage and can be exported to JSON/CSV. It does **not** write public Museum data. A separate Supabase-backed full-stack Observatory scaffold also exists for later persistent authenticated authoring.
