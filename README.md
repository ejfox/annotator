# NewsWell Annotator

A fast, keyboard-driven tool for drawing **NewsWell page-template blocks** — editorial, ad, filler — over print-edition page images, and exporting them as NewsWell-native JSON.

Built for [NewsKick Studio](https://newskickstudio.com). Static, no backend — runs entirely in the browser and deploys to any static host.

**Live:** [annotations.newskickstudio.com](https://annotations.newskickstudio.com)

---

## What it does

- Draw / move / resize / delete blocks over each page, snapped to the NewsWell grid, page margins, pixel-detected content edges, and neighbouring frames.
- Block taxonomy matches the app: **Editorial** (Article / Wild Art / What's Inside), **Ad**, **Filler**, with editorial **roles** (lead / secondary / brief).
- **Layers** panel, numeric **inspector** (coordinates in points), multi-select, alignment & distribution, copy / paste (incl. paste-in-place across pages), duplicate, undo / redo, zoom & pan.
- Live coverage % and overlap detection per page.
- Exports **NewsWell block JSON** — `kind` + geometry in points, content-relative (origin = top-left inside the margins), matching the studio's template format.

## Coordinate model

Page geometry comes from **paper presets** (`papers.json`), sourced from `newswell-studio/app/composables/usePaperSizes.ts`:

| | pt |
|---|---|
| Page | 819 × 792 |
| Margins | L/R 36, top 43, bottom 36 |
| Content | 747 × 713 |
| Grid | 4 col × 177.75 + 12pt gutters (also 10-col × 63.9) |

Export blocks are `{ id, kind, x, y, width, height }` in points, relative to the content area. `what-inside` carries `whatsInside.showPageNumbers`; editorial blocks may carry `role`.

## Usage

Open the app. A bundled sample — *Beach & Bay Press, May 8 2026* — loads on first run. Your work autosaves to the browser (localStorage).

- **Draw** — drag on an empty part of the page. **Select** — click a frame. Move/resize by dragging the body or handles.
- **New project** — *Add pages…* / *New…* to load your own page images (PNG/JPG, named in page order).
- **Export JSON** — download the NewsWell block file.

Press **?** in the app for the full keyboard reference.

## Develop

Pure static files — no build step. Serve the folder over http (needed so `papers.json` / `types.json` fetch; page images also work over `file://`):

```bash
python3 serve.py            # → http://localhost:8000
# or
npx serve .
```

Edit `papers.json` (paper presets) and `types.json` (block taxonomy + colors) to add titles or tweak the vocabulary — the app reads them at load.

## Deploy

Pushing to `main` deploys to GitHub Pages via `.github/workflows/deploy.yml`. Point `annotations.newskickstudio.com` at Pages with a CNAME DNS record (the repo `CNAME` file sets the custom domain).

## Layout

```
index.html      app shell + styles
app.js          editor (state, rendering, interaction, export)
papers.json     NewsWell paper geometry presets
types.json      block taxonomy (kind, color, key, roles)
samples/        bundled example issue (images + seed annotations)
serve.py        optional static dev server
```

## License

MIT © EJ Fox / NewsKick Studio
