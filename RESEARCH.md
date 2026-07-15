# Does a newspaper have a grammar?

Findings from annotating community print editions and trying to compress them into
reusable page templates.

**Status:** n=2 issues, one paper. Suggestive, not settled. Written 2026-07-15.
**Artifacts:** [`learning/lessons.md`](learning/lessons.md) (rules as they were learned) ·
[`learning/template-provenance.md`](learning/template-provenance.md) (per-template sourcing) ·
[`src/lib/templateMatch.js`](src/lib/templateMatch.js) (matcher) ·
[`tests/templateMatch.spec.js`](tests/templateMatch.spec.js) (the guard)

---

## 1. The question

Newspaper pages *look* bespoke. Are they? If a paper's pages are actually drawn from a
small set of reusable skeletons, then laying out an issue is mostly **selection**, not
design — and a layout system only needs to know which skeleton, not where every rectangle
goes.

Three sub-questions:

1. **Compression.** How few shapes cover a whole issue?
2. **Recognition.** Given a page's blocks, can you identify its shape mechanically?
3. **Transfer.** Do shapes learned from one issue describe the *next* issue?

## 2. Method

Human-in-the-loop, one page at a time:

```
hand-annotate ONE page → model predicts the next → human corrects
        ↑                                              │
        └────────── distil the delta into a rule ──────┘
```

The corrections are the data. Each one was diffed against the model's guess and written
down as a rule before continuing. Four rules did nearly all the work, all learned from a
**single** hand-corrected page (p2 of the first issue):

1. **One block per region.** Don't over-split.
2. **Enclose content fully**, past the nominal margin — newsprint runs past its own margins.
3. **Boundaries sit on the true content edge**; side-by-side blocks share a line.
4. **Split distinct ads**; a *house* promo belongs to its region (learned later, from p13).

Blocks are stored in image pixels and converted to NewsWell content-points
(747 × 713) only at the boundary.

## 3. Data

| issue | pages | blocks | provenance |
|---|---|---|---|
| Beach & Bay Press, **May 8 2026** | 16 | 60 | p1 hand-drawn; p2/p4/p13 hand-corrected; p3 accepted verbatim; pp5–16 model |
| Beach & Bay Press, **July 3 2026** | 16 | 63 | p1 hand-drawn; pp2–16 model |
| Peninsula Beacon, **July 10 2026** | 24 | 0 | **untouched** — the real out-of-sample test |

Source PDFs pulled from Times of San Diego's Heyzine flip-books; rendered at 150dpi
(1707 × 1650 px). All three papers render to *identical* geometry (819 × 792 pt), which
supports the claim that these SDCNG titles share one paper preset.

## 4. Result 1 — the grid is real

Every block edge in the first issue lands on the same few lines, as a fraction of the
content area:

| axis | lines | edges on the 50% fold |
|---|---|---|
| vertical | 0 · 0.25 · **0.50** · 0.75 · 1.0 | 37 |
| horizontal | 0 · **0.50** · 0.75 · 1.0 | 21 |

Nothing is freeform. Pages are cut in halves and quarters, and the **50% fold on both axes
is the master line**. This is why per-page pixel error doesn't propagate: templates are
authored to the grid, not to eyeballed coordinates.

## 5. Result 2 — six shapes cover an issue (n=1)

| archetype | pages (May 8) |
|---|---|
| Split — editorial ▏ ads, either orientation | 5, 7, 8, 10, 11 |
| Lead on top / ad row beneath | 3, 14, 15, 16 |
| Header band + 4×2 ad matrix | 9, 12 |
| Two stacked full-width features | 6 |
| Masthead rail + story | 2 |
| Cover (bespoke) | 1 |

One page (p4 — a briefs band over a split) fit nothing. It was **deliberately not shipped**
as a seventh template: n=1 is a coincidence, not a pattern.

## 6. Result 3 — recognition works

`templateMatch.js`: normalise both sides to fractions of their content area, score every
(block, slot) pair as **IoU × kind-weight**, pair greedily, and score = **fraction of
combined *area* matched**. Area-weighting is load-bearing — getting the half-page lead
right must outrank missing a business-card ad, and a count-based score says the opposite.

Validated against ground truth (the templates were distilled *from* these pages, so it
must pick them back out):

- **13/13 top-1**, margins Δ0.4–0.5 over the runner-up
- **Abstains correctly**: the cover scores 0.19 with a Δ0.01 margin — "none of these"
- **Honest when right**: p16 scores only 0.59 for its own archetype because its bottom is
  one full-width ad where the template has two

Guarded by 30 tests. The suite immediately found a real defect (page→template emitted
`y+height = 724` into a 713-tall content area, because rule 2 means annotations
legitimately overflow the content box but templates can't) and caught the author
overclaiming a margin.

## 7. Result 4 — transfer (n=2)

May 8's templates, applied to the **July 3** issue they had never seen:

```
5×  LEAD_TOP_ADS_BOTTOM        3 strong · 7 fair · 5 weak   (15 pages)
4×  SPLIT_EDITORIAL_LEFT
2×  MASTHEAD_STORY
2×  SPLIT_EDITORIAL_RIGHT
1×  NEWS_ADGRID
1×  CLASSIFIEDS_ADGRID
```

**Every page found an archetype. No seventh shape appeared.**

The recurrence is stronger than "similar shapes" — the paper is built from a kit:

| | May 8 | July 3 |
|---|---|---|
| the 8-ad Home Service Guide | p12 | **p11** (0.906) |
| 6-ad grid, same two double-height cells, same advertisers | p9 | **p9** |
| Marc Mabile + Broken Yolk under a lead | p3 | **p3** (0.937) |
| back page: article over a full-width Scott Booth ad | p16 | **p16** |

Two months apart, the same advertisers occupy the same slots.

### The weak scores are the useful part

Five pages scored weak, and every one is diagnostic rather than broken:

- **p10, p16** — one full-width ad where the template has two halves. Real difference, flagged.
- **p4** — the hybrid. Weak on *both* issues. Still unshipped, now with evidence.
- **p5, p13** — a **split with ONE full-height ad** instead of two stacked. This is the
  mirror of `SPLIT_EDITORIAL_RIGHT` and it has no template. It appeared twice in this
  issue. **This is the candidate seventh archetype** — pending a third sighting, by the
  same standard that kept p4 out.

## 8. Threats to validity

Stated plainly, because the result is only worth what survives them.

1. **n=2, one paper, one publisher.** The grammar may be *this paper's* house style, not a
   property of community newspapers. The Beacon test is unrun.
2. **Two of the four transfer pages are circular.** For July 3 pp2–3 the layout was
   *recognised* and May 8's geometry applied, rather than measured from July 3's pixels.
   Identical scores follow trivially. They evidence that layouts repeat; they cannot also
   evidence that the matcher generalises. **p5 is the clean case** — annotated
   independently, genuinely different, still landed on the right family at "fair".
3. **Most annotation is unreviewed model output.** Of 123 blocks across two issues, a human
   drew or corrected roughly 25. The archetypes are visually unmistakable and the grid
   absorbs coordinate error, but the block-level data is mostly not ground truth.
4. **The matcher was validated on the data that produced it.** 13/13 is a *consistency*
   check (can it invert its own derivation?), not a generalisation result. Section 7 is the
   generalisation result, and it is weaker: 3 strong of 15.
5. **No template has ever been rendered.** They pass NewsWell's real capacity and grid math
   (8 tests), which is not the same as producing a usable page.
6. **Author is the instrument.** The same model proposed the archetypes, annotated the
   pages, and wrote the matcher that scores them. Independent annotation would be worth more
   than any additional issue.

## 9. Falsifiable predictions

If the grammar is real, then on the **Peninsula Beacon** (different paper, 24pp, unrun):

1. ≥80% of pages match an existing archetype at ≥0.5.
2. No more than **two** new archetypes are needed for full coverage.
3. Its block edges land on the same quarter grid, with the 50% fold dominant.
4. The masthead page (p2 by convention) matches `MASTHEAD_STORY`.

If the Beacon needs five new shapes, the finding is "Beach & Bay has a house style" — still
useful, much smaller.

## 10. Next experiments

1. **Run the Beacon.** The only test that can falsify anything right now.
2. **Independent measurement** of July 3 pp2–3 — removes threat #2 cheaply.
3. **Ship the one-ad split** if a third sighting lands.
4. **Invert the matcher**: it currently answers *layout → template*. The production question
   is *content → template*. Same math, different input; NewsWell's `computeTemplateCapacity`
   scores words where this scores geometry, and the two compose — geometry shortlists,
   capacity breaks ties.
5. **A second annotator** (human or a different model) on the same issue, to measure how
   much of this is the paper and how much is one model's habits.

## 11. What can be claimed today

- **Strong:** this paper is formulaic to a degree that surprised everyone involved. Same
  shapes, same advertisers, same slots, across two months. Layout here is selection.
- **Reasonable:** six shapes cover two issues of it, and a mechanical matcher identifies
  them with a usable, honest confidence signal that abstains rather than guessing.
- **Not yet:** that this generalises past one paper, or that the templates produce good
  pages in production. Both are cheap to test and neither has been.
