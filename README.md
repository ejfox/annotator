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

On the Beach & Bay Press issue of May 8 2026, that ran: **page 1** hand-drawn → **page 2** predicted and hand-corrected (two fixes that became house rules) → **page 3** predicted and **accepted with zero edits** → **page 4** predicted, alignment-only fix → **pages 5–16** predicted in one pass. 16 pages, 61 blocks.

The rules it learned are in [`learning/lessons.md`](learning/lessons.md); the page-by-page record is in [`learning/template-provenance.md`](learning/template-provenance.md).

## What it does

- **Draw / move / resize / delete** blocks, snapped to the NewsWell grid, page margins, pixel-detected content edges, and neighbouring frames. Hold `Shift` to bypass snapping.
- **Real editor**: layers panel, numeric inspector (points), multi-select (shift-click, `Alt`-marquee, `⌘A`), align & distribute, copy/paste incl. paste-in-place across pages, undo/redo, zoom & pan.
- **AI first pass**: pages with a prediction in `predictions.json` auto-fill on load; the ✨ button re-applies one on demand.
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

- **`serve.py` running** → edits autosave to `annotations.local.json` on disk, and the app loads from it. One source of truth across every tab and profile.
- **Deployed static** → the endpoints 404 and it falls back to `localStorage`.

## Usage

A bundled sample project — *Beach & Bay Press, May 8 2026* — loads on first run. Its **page scans aren't committed** (copyrighted publication content, and heavy binaries don't belong in git), so you'll see blank pages at the correct dimensions until you supply them — see [`samples/README.md`](samples/README.md). Everything else works regardless: grid, snapping, blocks, predictions, export.

- **Draw** — drag empty page space. **Select** — click a frame. Move/resize via body or handles.
- **New project** — *New…* / *Add pages…* to load your own page images (PNG/JPG, named in page order).
- **Export JSON** — download the NewsWell block file.

## Develop

Pure static files, no build step:

```bash
python3 serve.py            # → http://localhost:8000
```

Edit `papers.json` (paper presets) and `types.json` (block taxonomy + colors) to add titles or adjust vocabulary — the app reads them at load. Edit `predictions.json` and open tabs hot-apply it.

## Deploy

Push to `main` → GitHub Pages via `.github/workflows/deploy.yml`. Point a CNAME record at Pages (the repo's `CNAME` sets the custom domain). The `/api/*` endpoints simply don't exist in production; the app degrades to `localStorage`.

## Layout

```
index.html        app shell + styles
app.js            editor (state, rendering, interaction, export, live-reload)
serve.py          local dev server + optional disk persistence (/api/load, /api/save, /api/version)
papers.json       NewsWell paper geometry presets
types.json        block taxonomy (kind, color, key, roles)
predictions.json  model first-pass blocks per page — auto-applied to empty pages
samples/          sample issue manifest + seed annotation (page scans NOT committed)
learning/         what the model learned, and where the templates came from
newskick-templates-from-bbpress.json   the distilled page templates, NewsWell-native
```

## Templates

Annotating a whole issue surfaced its grammar: every block edge lands on a **quarter grid**, with the **50% fold dominant on both axes**, and six archetypes cover all 16 pages — the two split forms, lead-over-ad-row, the news and classifieds ad grids, stacked features, and the masthead rail.

Those are distilled into `newskick-templates-from-bbpress.json` in NewsWell's `PageTemplate` schema (importable into Studio's template library), and shipped upstream in [ejfox/newswell#142](https://github.com/ejfox/newswell/pull/142). Each names the exact pages it came from.

## License

MIT © EJ Fox / NewsKick Studio
