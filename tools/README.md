# tools/

Offline analysis. Not shipped in the build; not imported by the app.

## `xycut.py` — derive block geometry from the page pixels

The model's block coordinates were originally eyeballed off downscaled renders and
sat a median ~22px from the actual ink, which is close enough to score an archetype
and far too coarse to hand someone as an annotation.

This does recursive XY-cut: find the widest whitespace gap in a region, split there,
recurse. The leaves give geometry; the existing annotation gives semantics — each
block claims the leaves that are ≥60% inside it and snaps to their union, which is
house rule 2 ("enclose the content fully") measured rather than typed.

Two things it took three tries to get right, both worth keeping in mind:

- **A gap must span the region's full extent.** Text lines don't align across
  columns, so leading never spans a multi-column region — which means the gap
  threshold can be small. It has to be: the gap above the cover's full-width ad is
  16 scaled px, and a threshold of 17 rejected it, stranding the entire body as one
  leaf. No vertical cut is reachable until a full-width element is separated off.
- **Snapping refines; it never relocates.** A leaf straddling two blocks belongs to
  neither, and corrections are clamped to ±60px. Without both guards a wide leaf (a
  photo caption) gets claimed by a narrow neighbour and drags it across the page.

Requires `pillow` + `numpy` (neither is a repo dependency — this is a one-off tool).
