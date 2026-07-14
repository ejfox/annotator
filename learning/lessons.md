# Annotation lessons (human-in-the-loop flywheel)

Rules distilled from EJ's edits vs. the vision model's first-pass guesses.
Applied to every future `predictions.json` pass.

## Page 2 — CONFIRMED delta (model v1 → EJ's fix)

Model guessed **3** blocks; EJ kept **2**:

| | model v1 | EJ's fix | lesson |
|---|---|---|---|
| masthead rail | split: staff `filler` + promo `filler` | **one** `filler`, x75 y100 → y1599 | **Don't over-split. One block per region.** The whole standing-matter column is a single block. |
| article | x470 y100 w1162 **h1475** | x470 y100 w1162 **h1499** (→ y1599) | **Enclose fully.** Extend to the real content bottom (~y1599), past the nominal bottom margin (y1575). |
| kind | `filler` | `filler` (unchanged) | `filler` is correct for masthead/standing matter — no new kind needed. |
| horizontal | x/width correct | unchanged | left/right extents were right; only vertical needed work. |

**Distilled rules:**
1. **One block per region — don't split.** Match EJ's region-scale instinct ("this HALF / this QUARTER").
2. **Enclose content fully + small pad.** Size to the outer pixel edge; content must never lap past a block edge. Extend past nominal margins to the true content bottom.
3. Story photos stay **inside** the article block (not separate wild-art) — held from page 1, unchallenged on page 2.
4. Dominant/sole story on a page → role **lead**.

## Page 3 — model v2: ACCEPTED VERBATIM ✅

3 blocks (full-width **article/lead** + **two ads** bottom). EJ kept it with **zero
edits** — his saved page 3 == the prediction, byte for byte. The page-2 rules
(one-block-per-region + enclose-fully) generalized perfectly. First clean hit.

## Page 4 — model v3 prediction (4 regions)

Busier page. Predicted: full-width **article/brief** band up top (community briefs:
VOTE AT PB LIBRARY / EMPTY THE SHELTERS) + left-half **article/secondary** (the
"Summer Camps & Activities" editorial section, cols 1–2, to page bottom) + **two
stacked ads** on the right (PB Arts Center camps ad, then the big Jr. Theatre
"Summer Camps" ad).
**Result:** structure + all classifications accepted (kept 4 blocks, both ads,
summer-camps-as-editorial, folded promo, briefs-as-one). EJ fixed only **alignment**:
brief-band bottom 495→459, second-row tops 510→489 (left editorial + top ad moved
up together). → **New rule 3 (refined): region/row boundaries sit at the true
content edge (my estimates ran ~20–40px low), and side-by-side blocks share the
exact same top/bottom line.** No re-classification needed — judgment calls were all right.

## Page 5 — model v4 prediction

Left-half **article/lead** (homeless-count story, full height) + two stacked right-side
**ads** (RealestAgent realtor top, PB Elementary "Platinum Sponsors" bottom). Tops
aligned at y116, ad divider at ~y488, all enclosed to the page bottom.

## Full-issue pass (pages 6–16) — model v-final

Predicted all remaining pages in two batches, HMR-applied live. 61 blocks total
across 16 pages. Patterns held: full-width lead + stacked stories, left/right
editorial-vs-ad splits, ad grids as separate ad blocks, classifieds/legals/puzzles
as filler. **Judgment calls flagged for EJ's review (highest learning value):**
- p12 / p11: multi-ad service grids drawn as separate `ad` blocks (8 & 8) — group instead?
- p13: puzzles/legals page went coarse (legals filler + games filler + sudoku + IG ad).
- p7 / p10 / p11: small bordered briefs (SeaWorld Drone Shows, Mt. Soledad) folded
  into the adjacent article — pull out as their own block?
- p6: two stacked features labeled lead + secondary — both secondary?
