# IDunnoPoetry Messageboard Museum

**Current public museum release: v3.18 · September 24, 2026**

Public site: https://exemptus9.github.io/idunnopoetry-museum/

The deployable museum lives in `museum-static/`. It reconstructs the surviving IDunnoPoetry forum and poetry archive while excluding private-message bodies, credentials, historical email addresses, and IP addresses.

## IDunnoPoetry Museum release

Version metadata is centralized in `museum-static/museum-config.js` and mirrored in the public header, footer, About view, social metadata, and `museum-static/VERSION.txt`.

Release changes must update the header/footer, history, READMEs, manifest and share-card SVG together. Run `python3 scripts/check_release.py --source-only` to check the source. The Pages workflow renders the exact 1200×630 PNG from the SVG with CairoSVG, then verifies the entire release before publishing. To render locally, install `cairosvg` and run `python3 scripts/check_release.py --render-preview`.

Daily YouTube scans cover all available channel tabs and preserve curated mappings and review notes. Successful syncs explicitly trigger Pages through `workflow_run`; a bot commit alone does not trigger another push workflow.

---

# Welcome to your Lovable project

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Open your project in the [Lovable editor](https://lovable.dev) and keep building.

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: connect the project to GitHub and every change made in Lovable is committed straight to your repository.
- **Full ownership**: this code is yours. Push to your repository and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```

## Built with

- TanStack Start
- TypeScript
- React
- Tailwind CSS