# Sample issue — page images not included

The bundled sample project (*Beach & Bay Press, May 8 2026*) expects page images at
`beach-and-bay-press-2026-05-08/pages/p-01.png … p-16.png`.

**Those images aren't in this repo, on purpose.** They're scans of a copyrighted SDCNG
publication, and 26MB of binaries has no business in git. The app handles their absence —
you'll get a blank page at the correct dimensions and a prompt to load your own.

## Running the sample locally

Drop the 16 page PNGs into `beach-and-bay-press-2026-05-08/pages/`. To regenerate them
from the print PDF:

```bash
cd beach-and-bay-press-2026-05-08
pdftoppm -png -r 150 /path/to/beach-and-bay-press-may-8-2026.pdf pages/p
# → pages/p-01.png … p-16.png at 1707×1650, which is what the coordinates assume
```

Any other publication works too — just use **Add pages…** in the app.

## What *is* tracked here

The derived data, which is ours rather than the paper's:

| file | what |
|---|---|
| `project.json` | sample manifest — paper preset, page list, image dimensions |
| `annotations.seed.json` | the hand annotation of page 1 that started the whole loop |

Block coordinates for the rest of the issue live in `../predictions.json`, and the
templates distilled from them in `../newskick-templates-from-bbpress.json`.
