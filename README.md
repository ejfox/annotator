# NewsWell Annotator

A keyboard-driven tool for marking up **NewsWell page-template blocks** — editorial, ad, filler — over print-edition pages, and a human-in-the-loop loop that learns your eye and pre-annotates the rest of the issue.

Static, no backend. Runs in the browser; deploys to any static host.

---

## The loop

The point isn't drawing rectangles. It's this:

```
hand-annotate one page  →  model predicts the next  →  you tune it
        ↑                                                   │
        └────────── it learns from your delta ──────────────┘
```

On the Beach & Bay Press issue of May 8 2026, that ran: **page 1** hand-drawn → **page 2** predicted and hand-corrected (two fixes that became house rules) → **page 3** predicted and **accepted with zero edits** → **page 4** predicted, alignment-only fix → **pages 5–16** predicted in one pass. 16 pages, 60 blocks.

The rules it learned are in [`learning/lessons.md`](learning/lessons.md); the page-by-page record is in [`learning/template-provenance.md`](learning/template-provenance.md).

**📄 [RESEARCH.md](RESEARCH.md) — the findings written up properly**: six archetypes tested across three issues and two papers, the matcher and its validation, six pre-registered predictions scored (3 held, 1 narrowly, 1 failed, 1 half-failed), and one headline finding **withdrawn** after it turned out to measure this editor's snap setting rather than the newspaper.

## What it does

- **Draw / move / resize / delete** blocks, snapped to the NewsWell grid, page margins, pixel-detected content edges, and neighbouring frames. Hold `Shift` to bypass snapping.
- **Real editor**: layers panel, numeric inspector (points), multi-select (shift-click, `Alt`-marquee, `⌘A`), align & distribute, copy/paste incl. paste-in-place across pages, undo/redo, zoom & pan.
- **AI first pass**: pages with a prediction in `predictions.json` auto-fill on load; the ✨ button re-applies one on demand.
- **Template matching**: ranks the page against the NewsWell template library and shows the best fit with a confidence score. Reads the live Studio library when it can, falls back to a bundled snapshot and says which it used. **Apply** stamps a template's slots onto the page.
- **Page → template**: turns the current page into a valid `PageTemplate` (infers `cover`/`ad`/`ad-editorial`, carries `role` + photo hints) for import into Studio.
- **Live reload**: publish a prediction and it appears in the open tab within a second; change the app code and the tab reloads itself.
- Live **coverage %** and **overlap detection** per page.
- **Exports NewsWell block JSON** — `kind` + geometry in points, content-relative, matching the studio's template format.

Press **?** in the app for the full keyboard reference.

## Coordinate model

Geometry comes from **paper presets** (`papers.json`), sourced from `newswell-studio/app/composables/usePaperSizes.ts`:

| | pt |
|---|---|
| Page | 819 × 792 |
| Margins | L/R 36, top 43, bottom 36 |
| Content | 747 × 713 |
| Grid | 4 col × 177.75 + 12pt gutters (also 10-col × 63.9) |

Exported blocks are `{ id, kind, x, y, width, height }` in points relative to the content area. `what-inside` carries `whatsInside.showPageNumbers`; editorial blocks carry `role`.

## Storage

Two tiers, so your work is never trapped in one browser profile:

- **Dev server running** → edits autosave to `annotations.local.json` on disk (via a small Vite plugin in `vite.config.js`), and the app loads from it. One source of truth across every tab and profile.
- **Deployed static** → those routes don't exist, and it falls back to `localStorage`.

## Usage

A bundled sample project — *Beach & Bay Press, May 8 2026* — loads on first run. Its **page scans aren't committed** (copyrighted publication content, and heavy binaries don't belong in git), so you'll see blank pages at the correct dimensions until you supply them — see [`samples/README.md`](samples/README.md). Everything else works regardless: grid, snapping, blocks, predictions, export.

- **Draw** — drag empty page space. **Select** — click a frame. Move/resize via body or handles.
- **New project** — *New…* / *Add pages…* to load your own page images (PNG/JPG, named in page order).
- **Export JSON** — download the NewsWell block file.

## Develop

Vue 3 + Vite. One command:

```bash
npm install
npm run dev                 # → http://localhost:8000
npm test                    # guards the matcher + the point math
```

Edit `public/papers.json` (paper presets) and `public/types.json` (block taxonomy + colors) to add titles or adjust vocabulary — the app reads them at load. Edit `public/predictions.json` and open tabs hot-apply it (Vite's HMR covers modules; predictions are runtime data, so a small poll handles those).

The dev server also provides `/api/load`, `/api/save` and `/api/version` via a plugin in `vite.config.js` — that's what puts your annotations in a file instead of one browser profile's localStorage. Production has none of it.

## Deploy

```bash
npm run build               # → dist/  (~160KB, no scans)
```

`.github/workflows/deploy.yml` installs, builds and uploads `dist/` to GitHub Pages. It's **manual-dispatch only** — it can't work until Pages is enabled (Settings → Pages → source: *GitHub Actions*) and DNS for the domain in `public/CNAME` points at Pages, and a `push` trigger would otherwise fail on every commit. Once both are set up, run it from the Actions tab or add the trigger back.

Note the hosted app has no sample scans (they aren't committed), so it opens as bring-your-own-pages via **Add pages…**.

## Layout

```
index.html        Vite entry
vite.config.js    build + dev-only persistence API + page-scan strip guard
src/
  main.js         mount
  App.vue         shell, keyboard, overlays, prediction hot-apply
  store.js        reactive state + every action
  style.css
  lib/            pure, framework-free — the part that must stay correct
    geometry.js     paper presets, px <-> content-point conversion, grid
    edges.js        pixel-contrast content edges
    newswell.js     block JSON in/out — the contract with newswell-studio
    minimap.js      black-and-white page schematic
    templateMatch.js  which template describes this page (area-weighted IoU)
    templates.js    template library source + page → PageTemplate
  components/     LeftRail · PageCanvas · RightPanel · Minimap · StatusBar · TemplatePanel
tests/            vitest — the pure lib/ modules, incl. the 13/13 matcher guard
public/
  papers.json     NewsWell paper geometry presets
  types.json      block taxonomy (kind, color, key, roles)
  predictions.json  model first-pass blocks per page — auto-applied to empty pages
  samples/        sample issue manifest + seed annotation (page scans NOT committed)
learning/         what the model learned, and where the templates came from
public/newskick-templates-from-bbpress.json   the distilled page templates, NewsWell-native
```

## Templates

Annotating a whole issue surfaced six archetypes that cover all 16 pages — the two split forms, lead-over-ad-row, the news and classifieds ad grids, stacked features, and the masthead rail. They transfer: they cover a second issue of the same paper, and 75% of a *different* paper's pages.

> This section used to claim a **quarter grid** with the *50% fold dominant on both axes*. **That was withdrawn** — the horizontal half measured the editor's own snap-to-grid setting, and the vertical half restated the definition of a 4-column preset. See [RESEARCH.md §4](RESEARCH.md). The archetypes below survived the same scrutiny; the grid did not.

Those are distilled into `public/newskick-templates-from-bbpress.json` in NewsWell's `PageTemplate` schema (importable into Studio's template library), and shipped upstream in [ejfox/newswell#142](https://github.com/ejfox/newswell/pull/142). Each names the exact pages it came from.

## License

MIT © EJ Fox / NewsKick Studio
