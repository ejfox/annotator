# Does a newspaper have a grammar?

Findings from annotating community print editions and trying to compress them into
reusable page templates.

**Status:** n=4 corpora, three publications. Both out-of-sample tests have now been run.
The headline claim split in two: one half generalises, the other is a house style.
Written 2026-07-15.
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
| Peninsula Beacon, **July 10 2026** | 16 | 65 | model, measured from its own pixels; **the cross-paper test** |
| San Diego Reader, **July 10 2026** (bound into the Beacon) | 8 | 28 | model, measured from its own pixels; **the cross-publication test** |

**Correction.** Earlier drafts of this document called the Beacon "24 pages, different
paper." That was asserted without opening the file. The 24-page PDF is a **16-page
Peninsula Beacon with an 8-page San Diego Reader bound into the middle** (PDF pp7–14 are
the Reader, with its own cover and its own page numbering restarting at 1). Beacon p*n* =
PDF *n* for n≤6 and PDF *n*+8 for n≥7. The Reader shares the Beacon's production shop
(same staff on both mastheads, same `media@numbersix.com`) but not its design language;
it is scored separately in §9 as the hardest available test.

Source PDFs pulled from Times of San Diego's Heyzine flip-books; rendered at 150dpi
(1707 × 1650 px). All three render to *identical* geometry (819 × 792 pt), which supports
the claim that these SDCNG titles share one paper preset. The Beacon being **16 pages, like
Beach & Bay** is itself a small result: the format is shared, not just the preset.

## 4. Result 1 — the grid is real on one axis, and was an artifact on the other

> **This section was substantially wrong until 2026-07-15 and is rewritten.** It claimed
> both axes; only one survives. The retraction is kept in place rather than quietly edited,
> because *how* it was wrong is the most transferable thing in this document.

### What went wrong

Every grid number here was originally computed from **annotations** — blocks drawn by a
human or a model, in an editor with **snap-to-grid on by default**, by an author who types
round numbers (`x=75`, `y=825`, `w=1557`). Then the annotations were measured and found to
be… on the grid.

That is circular, and it is the same circularity flagged as threat #2 for the July 3 pages.
It went unnoticed for longer on this axis because the output looked like a *measurement*
rather than a recollection. It was neither: it was the tool's snap setting, read back.

It surfaced only when EJ looked at a rendered page and said the blocks weren't lined up.
The inspector showed `AD 367×359 at X=0 Y=353` — round, grid-perfect, and nowhere near the
ink.

### The honest test

Ask the **pixels**, with no annotation in the loop. `detectEdges()` (ported from
[`src/lib/edges.js`](src/lib/edges.js)) finds ink boundaries directly. Interior edges only —
the page's outer bounds are trivially on the grid and would flatter any result:

| corpus | vertical (columns) | horizontal (stacking) |
|---|---|---|
| BBP May 8 | **65.6%** on grid · 21/64 on the 50% fold | 17.9% · 10/78 |
| Peninsula Beacon | **80.4%** on grid · 28/56 on the 50% fold | 14.1% · 15/170 |
| *chance baseline* | *6%* | *6%* |

*(tolerance ±0.01 of the content dimension; 3 interior lines at .25/.50/.75)*

**Vertical survives, decisively** — 11–13× chance, on two papers, measured from ink. And the
50% fold really is the master line: half the Beacon's interior column edges sit exactly on
it. No snapping can produce that; the detector never saw a block.

**Horizontal does not.** 2–3× chance is a faint signal, not a grid. The annotation-derived
figure said 79–91%; the ink says 14–24%. **That gap is the snapping.**

### Why the split is believable

It has a mechanism, which is the main reason to trust it over the tidier original claim.
**Columns are rigid** — they are the paper preset, and everything on the page is set into
them, so vertical edges have nowhere else to land. **Vertical position is fluid** — where a
story ends depends on how long the copy ran. A newspaper is a column grid with things
stacked into it at whatever height they happen to be, not a quarter-grid in both axes.

So templates may be authored to the **column** grid with confidence. Authoring block
*heights* to quarters is imposing a regularity the paper does not have — and every
annotation in this repo did exactly that, by ~22px on average (median 22, max 48).

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

## 9. Result 6 — the Reader, and the dissociation

Two predictions were registered for the Reader in an earlier revision of this file, before
it was annotated. **Prediction 1 was deliberately a prediction of failure** — a library that
matches everything is measuring nothing.

| # | prediction | outcome |
|---|---|---|
| 1 | **<50%** of pages match at ≥0.5 | **HOLDS — 38%** (3/8) |
| 2 | edges still land on the quarter grid | **HOLDS on the vertical axis only** — see §4; the horizontal half of this prediction was scored against contaminated numbers and is withdrawn |

### The result

Put the four corpora side by side, and the two things this project has been calling one
finding come apart:

| corpus | editorial distance | match ≥0.5 | column grid *(ink-derived)* |
|---|---|---|---|
| BBP May 8 | *in-sample* | 13/13 | 66% |
| BBP July 3 | same paper, +2 months | 15/15 | — |
| Peninsula Beacon | different paper, same shop | **75%** | 80% |
| San Diego Reader | different publication, same shop | **38%** | — |

**Archetype match collapses monotonically — 100 → 100 → 75 → 38. Column-grid adherence does
not.** The grid column figures are the ink-derived ones from §4 (11–13× chance); the
annotation-derived numbers this table used to carry were contaminated by snapping and are
withdrawn. Per-issue ink figures for July 3 and the Reader are not yet computed — the two
that are, on two different papers, already show the dissociation.

That is a dissociation, and it is the most useful thing here. The grid and the archetypes
co-varied perfectly in the n=1 data, so §4 and §5 read as two faces of one discovery. They
are not:

- **The column grid is a property of the paper preset** — of production. Everything coming
  out of this shop is set into the same columns with the 50% fold dominant, regardless of who
  is editing it. Block *heights* are not gridded (§4) — that half was an artifact.
- **The archetypes are a property of the house style** — of editorial. They degrade exactly
  as fast as editorial distance grows.

The mechanism is visible page by page. The Reader is magazine-style — full-bleed photo
cover, no INSIDE rail, no ad grid, wild art dominant. The library mostly fails on it, as it
should. But **Reader p3 scores 0.979** for `SPLIT_EDITORIAL_LEFT`, because p3 is the one
Reader page built like newsprint: story left, two stacked ads right. When the Reader does a
newsprint page, the library nails it cold. It isn't failing to recognise pages — it is
correctly reporting that most Reader pages are not newsprint pages.

**The Reader cover is the best abstention in the project**: 0.179 at Δ0.001. One full-bleed
photograph. Nothing in the library resembles it, and the matcher says so with a margin of
one part in a thousand rather than inventing a fit.

## 10. Threats to validity

Stated plainly, because the result is only worth what survives them.

1. **n=2, one paper, one publisher.** The grammar may be *this paper's* house style, not a
   property of community newspapers. The Beacon test is unrun.
2. **Two of the four transfer pages are circular.** For July 3 pp2–3 the layout was
   *recognised* and May 8's geometry applied, rather than measured from July 3's pixels.
   Identical scores follow trivially. They evidence that layouts repeat; they cannot also
   evidence that the matcher generalises. **p5 is the clean case** — annotated
   independently, genuinely different, still landed on the right family at "fair".
3. **Annotations are not measurements.** Every block in this repo was placed with snap-to-grid
   on, and the model's coordinates were eyeballed off downscaled renders — they sat a median
   **22px** (max 48) from the actual ink until re-derived from `detectEdges()` on 2026-07-15.
   Any statistic computed *from annotations* inherits the tool's snapping and the author's
   round numbers; §4 is what happens when you forget that. Statistics about the paper must
   come from the pixels.
4. **Most annotation is unreviewed model output.** Of 123 blocks across two issues, a human
   drew or corrected roughly 25. The archetypes are visually unmistakable and the grid
   absorbs coordinate error, but the block-level data is mostly not ground truth.
5. **The matcher was validated on the data that produced it.** 13/13 is a *consistency*
   check (can it invert its own derivation?), not a generalisation result. Section 7 is the
   generalisation result, and it is weaker: 3 strong of 15.
6. **No template has ever been rendered.** They pass NewsWell's real capacity and grid math
   (8 tests), which is not the same as producing a usable page.
7. **Author is the instrument.** The same model proposed the archetypes, annotated the
   pages, and wrote the matcher that scores them. Independent annotation would be worth more
   than any additional issue.

## 11. Falsifiable predictions — all scored

**Six predictions, registered before their data was opened: 3 held, 1 held narrowly, 1
failed, 1 half-failed.** The Beacon set is scored in §8, the Reader set in §9. Two lessons
worth keeping:

- **Prediction 4 was badly written.** "The masthead page (p2 by convention) matches
  `MASTHEAD_STORY`" bundles a position claim and a shape claim into one sentence, so it
  could half-fail — and did. One prediction, one claim.
- **The 80% threshold was guessed, not derived.** It happened to land right at the boundary
  (75% raw, 86% excluding known gaps), which is the least informative place a threshold can
  land. It should have been set from the Beach & Bay hit rate.

The one prediction that was *designed* to fail is the one that paid best. "The library
should score <50% here" forced a claim about the archetypes' **scope**, and scope is what
the whole question turned out to hinge on. Predicting success only ever tests whether the
thing works; predicting failure tests whether you know where its edges are.

Next, and now the cheapest falsification available: **a second SDCNG title that is neither
Beach & Bay nor a Reader-style magazine.** The dissociation predicts it lands near the
Beacon's 75% with the grid untouched at ~93%. If instead it scores like the Reader, the
archetypes are Beach & Bay's alone and the Beacon's 75% was luck.

## 12. Next experiments

1. **Ship `LEAD_TOP_AD_FULL`** — 5 sightings, 2 papers, consistent 0.595/Δ0.037 signature.
   The best-evidenced gap in the library.
2. **Separate the two products.** The grid generalises and the archetypes don't, so they
   should not ship as one thing. The grid is a *paper preset* — it belongs to every SDCNG
   title. The archetypes are a *per-title library* — Beach & Bay's shapes should not be
   offered to the Reader as defaults.
3. **A third title** — the test in §11.
4. **Independent measurement** of July 3 pp2–3 — removes threat #2 cheaply.
4. **Invert the matcher**: it currently answers *layout → template*. The production question
   is *content → template*. Same math, different input; NewsWell's `computeTemplateCapacity`
   scores words where this scores geometry, and the two compose — geometry shortlists,
   capacity breaks ties.
5. **A second annotator** (human or a different model) on the same issue, to measure how
   much of this is the paper and how much is one model's habits.

## 13. What can be claimed today

The original question — *does a newspaper have a grammar?* — has a sharper answer than
expected, because the thing being measured turned out to be two things.

- **Strong — the COLUMN grid is universal to the shop.** 66% / 80% of interior *ink* edges
  land on quarters against a 6% chance baseline, on two papers, with the 50% fold carrying
  a third to a half of them. Measured from pixels, no annotation in the loop. This is a
  production property and belongs in the paper preset.
- **Retracted — the horizontal grid.** Block heights land on quarters at 2–3× chance, which
  is not a grid. The original 79–91% figure measured the editor's snap setting and the
  author's round numbers, not the newspaper (§4).
- **Strong — the archetypes are a house style, not a law of newsprint.** They score 100% on
  Beach & Bay, 75% on a sister paper, 38% on a magazine from the same shop. That gradient is
  the finding. Anyone shipping these must scope them per-title.
- **Strong — Beach & Bay and the Beacon share a skeleton.** Back page, classifieds grid and
  puzzle page reproduce across titles, house fillers included, two pages scoring 0.97 against
  templates that never saw them. Layout on these titles is selection.
- **Reasonable — the matcher's confidence is honest.** It abstains on both covers (0.19 /
  0.18, margins of 0.02 and 0.001), and its thin-margin signature located a real library gap
  (`LEAD_TOP_AD_FULL`, 5 sightings) rather than noise.
- **Now known false:** the horizontal grid (§4); the ≥80% cross-paper threshold; that the
  masthead sits on p2; and that the Beacon is a 24-page paper (§3).
- **Still not tested:** a third title; whether any template renders a usable page in Studio.
  Six predictions have now been scored and the instrument is still its own author (threat #6),
  which remains the largest unaddressed weakness.
