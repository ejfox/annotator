# Does a newspaper have a grammar?

Findings from annotating community print editions and trying to compress them into
reusable page templates.

**Status:** n=3 issues, two papers. The cross-paper test has now been run — it
partly falsified the predictions. Written 2026-07-15.
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
| Peninsula Beacon, **July 10 2026** | 16 (+8) | 65 | model, measured from its own pixels; **the cross-paper test** |

**Correction.** Earlier drafts of this document called the Beacon "24 pages, different
paper." That was asserted without opening the file. The 24-page PDF is a **16-page
Peninsula Beacon with an 8-page San Diego Reader bound into the middle** (PDF pp7–14 are
the Reader, with its own cover and its own page numbering restarting at 1). Beacon p*n* =
PDF *n* for n≤6 and PDF *n*+8 for n≥7. The Reader shares the Beacon's production shop
(same staff on both mastheads, same `media@numbersix.com`) but not its design language;
it is **not scored below** and remains the harder, untouched test.

Source PDFs pulled from Times of San Diego's Heyzine flip-books; rendered at 150dpi
(1707 × 1650 px). All three render to *identical* geometry (819 × 792 pt), which supports
the claim that these SDCNG titles share one paper preset. The Beacon being **16 pages, like
Beach & Bay** is itself a small result: the format is shared, not just the preset.

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

## 8. Result 5 — the cross-paper test (the one that could falsify)

Four predictions were written down in this file **before** the Beacon was opened. All 16
Beacon pages were then annotated from their own pixels — not by stamping Beach & Bay's
geometry onto them, which is the circularity threat #2 warns about — and scored against the
unchanged May 8 library.

| # | prediction | outcome |
|---|---|---|
| 1 | ≥80% of pages match at ≥0.5 | **FAILED** — 12/16 = **75%** |
| 2 | ≤2 new archetypes for full coverage | **HOLDS** — exactly 2 |
| 3 | same quarter grid, 50% fold dominant | **HOLDS** — 94% v / 85% h on grid; 50% the largest bucket on both axes |
| 4 | masthead page (p2 by convention) → `MASTHEAD_STORY` | **HALF-FAILED** — the masthead is **p6**; the *shape* matched (0.598), the *position* claim was wrong |

```
5 strong · 7 fair · 4 weak        12/16 ≥0.5 · 65 blocks
6× LEAD_TOP_ADS_BOTTOM   3× SPLIT_EDITORIAL_LEFT   1× SPLIT_EDITORIAL_RIGHT
1× NEWS_ADGRID           1× CLASSIFIEDS_ADGRID     1× MASTHEAD_STORY
```

**Prediction 1 failed and the failure should not be explained away.** It is worth noting
*which* four pages missed, but the threshold was set in advance and 75% is not 80%:

- **p1 cover** (0.199, Δ0.022) — no cover template was ever shipped. A correct abstain, and
  it scores the same 0.19 the Beach & Bay cover does. Not a new failure; a known gap.
- **p11 puzzles** (0.236) — Beach & Bay p13 is also untemplated. Same known gap, and it
  reproduced *including* rule 4: the @sdnewsgroup Instagram house promo merges into the
  puzzle filler exactly as EJ merged it on BBP p13.
- **p2 full-page ad** (0.289) — genuinely new shape.
- **p5 Health & Beauty advertorial** (0.387) — genuinely new shape.

Excluding the two pre-existing known gaps gives 12/14 = 86%, but that is a post-hoc
threshold and is recorded here only for interpretation, not as a pass.

### What transferred — a different paper, the same skeleton

| | Beach & Bay | Peninsula Beacon |
|---|---|---|
| back page: article over **one full-width real-estate ad** | p16 (both issues) | **p16** (0.595) |
| classifieds/legals + 4×2 ad grid, **same "Home Service Guide" house filler** | p12 | **p10** (0.920) |
| puzzles + **same @sdnewsgroup Instagram house promo** | p13 | **p11** |
| lead over a 2-up ad row | p3, p14, p15 | **p4** (0.971), **p13** (0.978) |

Two different papers, and p4/p13 score **0.97** against templates distilled from a paper
they have never touched. The skeleton is shared across titles, not just across issues.

### The seventh archetype has now earned its place

`LEAD_TOP_AD_FULL` — full-width editorial over **one** full-width ad, where
`LEAD_TOP_ADS_BOTTOM` expects two half-width ads:

| issue | pages |
|---|---|
| BBP May 8 | p16 |
| BBP July 3 | p10, p16 |
| Beacon July 10 | **p3, p16** |

**Five sightings, three issues, two papers.** Every one scores 0.595 with a Δ0.037 margin
over `STACKED_FEATURES` — the identical thin-margin signature flagged as p16's "honest"
case in §6. That is not a coincidence: geometrically it *is* stacked-features, and only the
bottom block's kind separates them. This is the best-evidenced gap in the library and the
candidate that should ship. The one-ad split (§7) found **no** third sighting here and
stays out.

Two shapes with one sighting each — `FULL_PAGE_AD` (p2) and the advertorial section (p5) —
stay out under the same n=1 rule that kept p4 out.

## 9. Threats to validity

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

## 10. Falsifiable predictions — now scored

The Beacon predictions are scored in §8: **1 failed, 1 half-failed, 2 held.** The grammar
survived, the specific numbers did not. Two lessons worth keeping:

- **Prediction 4 was badly written.** "The masthead page (p2 by convention) matches
  `MASTHEAD_STORY`" bundles a position claim and a shape claim into one sentence, so it
  could half-fail — and did. One prediction, one claim.
- **The 80% threshold was guessed, not derived.** It happened to land right at the boundary
  (75% raw, 86% excluding known gaps), which is the least informative place a threshold can
  land. It should have been set from the Beach & Bay hit rate.

Next, for the **San Diego Reader** (8pp, genuinely different design language, same
production shop, untouched):

1. **<50%** of its pages match an existing archetype at ≥0.5 — the Reader is magazine-style
   (full-bleed photo cover, no INSIDE rail, no ad grid), and the library should mostly *fail*
   on it. If it matches well, the archetypes are capturing "newsprint" rather than a house style.
2. Its edges still land on the quarter grid — the grid is a paper-preset property and should
   outlive the shapes.

Prediction 1 is deliberately a prediction of **failure**. A library that matches everything
would be measuring nothing.

## 11. Next experiments

1. **Run the Reader.** Now the only untouched test, and the only genuinely different design
   language available.
2. **Independent measurement** of July 3 pp2–3 — removes threat #2 cheaply.
3. **Ship `LEAD_TOP_AD_FULL`** — 5 sightings, 2 papers, consistent 0.595/Δ0.037 signature.
4. **Invert the matcher**: it currently answers *layout → template*. The production question
   is *content → template*. Same math, different input; NewsWell's `computeTemplateCapacity`
   scores words where this scores geometry, and the two compose — geometry shortlists,
   capacity breaks ties.
5. **A second annotator** (human or a different model) on the same issue, to measure how
   much of this is the paper and how much is one model's habits.

## 12. What can be claimed today

- **Strong:** these papers are formulaic. Same shapes, same advertisers, same slots, across
  two months *and across two titles* — the Beacon's back page, classifieds grid and puzzle
  page reproduce Beach & Bay's, house fillers included. Layout here is selection.
- **Strong:** the quarter grid is a property of the paper preset, not of one title. It held
  at 94%/85% on a paper the templates had never seen.
- **Reasonable:** six shapes cover 75% of an unseen paper (86% excluding the cover and
  puzzle pages, which no template ever claimed). The matcher abstains rather than guessing,
  and its thin-margin signature reliably points at real gaps rather than noise.
- **Now known false:** the ≥80% threshold, and that the masthead sits on p2.
- **Not yet:** that this survives a genuinely different design language — the bound-in
  Reader is the test and it is unrun. And no template has still ever been rendered.
